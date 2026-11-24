import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildLinearIssueInput,
  createMemoryRateLimiter,
  DEFAULT_LINEAR_BUG_LABEL_ID,
  DEFAULT_LINEAR_PROJECT_ID,
  DEFAULT_LINEAR_STATE_ID,
  DEFAULT_LINEAR_SUGGESTION_LABEL_ID,
  DEFAULT_LINEAR_TEAM_ID,
  DEFAULT_LINEAR_USER_FEEDBACK_LABEL_ID,
  extensionForAttachment,
  extractClientIp,
  ISSUE_ATTACHMENTS_BUCKET,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  UPLOAD_PREPARE_MAX_REQUESTS,
  validateAttachmentRequests,
  validateIssueReport,
  type LinearRoutingConfig,
  type RateLimitDecision,
} from "./report.ts";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
      }
    }
  }
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fallbackReportLimiter = createMemoryRateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS * 1000);
const fallbackUploadLimiter = createMemoryRateLimiter(UPLOAD_PREPARE_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS * 1000);

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function envOrDefault(name: string, fallback: string): string {
  const value = Deno.env.get(name);
  if (value === undefined) return fallback;
  return value.trim();
}

function linearRoutingFromEnv(): LinearRoutingConfig {
  return {
    teamId: envOrDefault("LINEAR_TEAM_ID", DEFAULT_LINEAR_TEAM_ID),
    projectId: envOrDefault("LINEAR_PROJECT_ID", DEFAULT_LINEAR_PROJECT_ID) || undefined,
    stateId: envOrDefault("LINEAR_STATE_ID", DEFAULT_LINEAR_STATE_ID) || undefined,
    bugLabelId: envOrDefault("LINEAR_BUG_LABEL_ID", DEFAULT_LINEAR_BUG_LABEL_ID) || undefined,
    suggestionLabelId: envOrDefault("LINEAR_SUGGESTION_LABEL_ID", DEFAULT_LINEAR_SUGGESTION_LABEL_ID) || undefined,
    userFeedbackLabelId:
      envOrDefault("LINEAR_USER_FEEDBACK_LABEL_ID", DEFAULT_LINEAR_USER_FEEDBACK_LABEL_ID) || undefined,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function optionalUserId(req: Request, supabaseUrl: string | undefined, anonKey: string | undefined): Promise<string | null> {
  if (!supabaseUrl || !anonKey) return null;
  const authorization = req.headers.get("Authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token === anonKey) return null;
  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function checkRateLimit(
  fingerprint: string,
  limit: number,
  fallback: ReturnType<typeof createMemoryRateLimiter>,
  supabaseUrl: string | undefined,
  serviceKey: string | undefined,
): Promise<RateLimitDecision> {
  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("consume_issue_report_slot", {
        p_fingerprint: fingerprint,
        p_limit: limit,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!error && data && typeof data === "object") {
        const result = data as { allowed?: unknown; remaining?: unknown; retry_after_seconds?: unknown };
        if (typeof result.allowed === "boolean") {
          return {
            allowed: result.allowed,
            remaining: typeof result.remaining === "number" ? result.remaining : 0,
            retryAfterSeconds: typeof result.retry_after_seconds === "number" ? result.retry_after_seconds : 0,
          };
        }
      }
    } catch {
      // Fall back to isolate-level rate limiting if the migration has not been pushed yet.
    }
  }
  return fallback.consume(fingerprint);
}

function allowedAttachmentPrefix(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${ISSUE_ATTACHMENTS_BUCKET}/reports/`;
}

async function handlePrepareUploads(
  body: Record<string, unknown>,
  fingerprint: string,
  supabaseUrl: string | undefined,
  serviceKey: string | undefined,
): Promise<Response> {
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Attachment uploads are not configured on the server." }, 503);
  }
  const validated = validateAttachmentRequests(body.files);
  if (!validated.ok) {
    return json({ error: validated.error }, 400);
  }

  const uploadFingerprint = await sha256Hex(`upload:${fingerprint}`);
  const limitDecision = await checkRateLimit(
    uploadFingerprint,
    UPLOAD_PREPARE_MAX_REQUESTS,
    fallbackUploadLimiter,
    supabaseUrl,
    serviceKey,
  );
  if (!limitDecision.allowed) {
    return json(
      {
        error: "You’ve uploaded several attachments recently. Please wait a bit before trying again.",
        retryAfterSeconds: limitDecision.retryAfterSeconds,
      },
      429,
      { "Retry-After": String(limitDecision.retryAfterSeconds) },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const uploads: Array<{
    name: string;
    contentType: string;
    size: number;
    path: string;
    signedUrl: string;
    token: string;
    publicUrl: string;
  }> = [];

  for (const file of validated.files) {
    const ext = extensionForAttachment(file.contentType);
    const path = `reports/${monthPrefix}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await admin.storage.from(ISSUE_ATTACHMENTS_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data.token) {
      return json({ error: "Could not prepare file upload right now. Please try again in a moment." }, 502);
    }
    const { data: pub } = admin.storage.from(ISSUE_ATTACHMENTS_BUCKET).getPublicUrl(path);
    uploads.push({
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      path,
      signedUrl: data.signedUrl,
      token: data.token,
      publicUrl: pub.publicUrl,
    });
  }

  return json({ ok: true, uploads }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const linearApiKey = Deno.env.get("LINEAR_API_KEY")?.trim() ?? "";
  const routing = linearRoutingFromEnv();
  if (!linearApiKey || !routing.teamId) {
    return json({ error: "Issue reporting is not configured." }, 503);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request payload." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const salt = Deno.env.get("REPORT_RATE_LIMIT_SALT")?.trim() || supabaseUrl || "drip-by-drip";

  const userId = await optionalUserId(req, supabaseUrl, anonKey);
  const identity = userId ? `user:${userId}` : `ip:${extractClientIp(req.headers)}`;
  const fingerprint = await sha256Hex(`${salt}:${identity}`);

  if (payload && typeof payload === "object" && (payload as Record<string, unknown>).mode === "prepare-uploads") {
    return handlePrepareUploads(payload as Record<string, unknown>, fingerprint, supabaseUrl, serviceKey);
  }

  const validated = validateIssueReport(payload, {
    allowedAttachmentPrefix: allowedAttachmentPrefix(supabaseUrl),
  });
  if (!validated.ok) {
    if (validated.spam) return json({ ok: true, identifier: null }, 200);
    return json({ error: validated.error }, 400);
  }

  const limitDecision = await checkRateLimit(
    fingerprint,
    RATE_LIMIT_MAX_REQUESTS,
    fallbackReportLimiter,
    supabaseUrl,
    serviceKey,
  );
  if (!limitDecision.allowed) {
    return json(
      {
        error: "You’ve sent a few reports already. Please wait a bit before sending another.",
        retryAfterSeconds: limitDecision.retryAfterSeconds,
      },
      429,
      { "Retry-After": String(limitDecision.retryAfterSeconds) },
    );
  }

  const issueInput = buildLinearIssueInput(validated.report, routing);

  let linearResponse: Response;
  try {
    linearResponse = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: linearApiKey,
      },
      body: JSON.stringify({
        query: CREATE_ISSUE_MUTATION,
        variables: { input: issueInput },
      }),
    });
  } catch {
    return json({ error: "Could not reach Linear right now. Please try again in a moment." }, 502);
  }

  let linearBody: {
    data?: { issueCreate?: { success?: boolean; issue?: { id?: string; identifier?: string } | null } };
    errors?: Array<{ message?: string }>;
  } | null = null;
  try {
    linearBody = await linearResponse.json();
  } catch {
    linearBody = null;
  }

  if (!linearResponse.ok || !linearBody?.data?.issueCreate?.success) {
    const status = linearResponse.status === 401 || linearResponse.status === 403 ? 503 : 502;
    return json(
      {
        error:
          status === 503
            ? "Issue reporting is not configured."
            : "Could not save your report just now. Please try again in a moment.",
      },
      status,
    );
  }

  const identifier = linearBody.data.issueCreate.issue?.identifier ?? null;
  return json({ ok: true, identifier }, 201);
});
