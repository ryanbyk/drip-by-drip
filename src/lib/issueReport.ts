import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  formatAttachmentSize,
  isImageContentType,
  isVideoContentType,
  ISSUE_CATEGORIES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  issueCategoryLabel,
  normalizeAttachmentContentType,
  validateAttachmentRequests,
  validateIssueReport,
  type AllowedAttachmentMimeType,
  type IssueAttachment,
  type IssueCategory,
  type IssueDiagnostics,
  type IssueReportInput,
} from "../../supabase/functions/report-issue/report";
import { appearanceLabel, type Appearance } from "../domain/appearance";
import { browserTimeZone } from "./webPush";
import { supabase } from "./supabaseClient";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

export {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  formatAttachmentSize,
  isImageContentType,
  isVideoContentType,
  ISSUE_CATEGORIES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  issueCategoryLabel,
  normalizeAttachmentContentType,
  validateAttachmentRequests,
  validateIssueReport,
  type AllowedAttachmentMimeType,
  type IssueAttachment,
  type IssueCategory,
  type IssueDiagnostics,
  type IssueReportInput,
};

const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 90_000;

export type IssueReportFetcher = typeof fetch;

export type IssueReportFailureReason = "invalid" | "rate_limited" | "unconfigured" | "network" | "failed";

export type IssueReportResult =
  | { ok: true; identifier: string | null }
  | { ok: false; reason: IssueReportFailureReason; message: string; retryAfterSeconds?: number };

export type IssueDiagnosticsRow = {
  label: string;
  value: string;
};

type PreparedUpload = {
  name: string;
  contentType: AllowedAttachmentMimeType;
  size: number;
  path: string;
  signedUrl: string;
  token: string;
  publicUrl: string;
};

export function validatePickedFiles(
  existingCount: number,
  picked: ReadonlyArray<Pick<File, "name" | "type" | "size">>,
): { ok: true } | { ok: false; error: string } {
  if (picked.length === 0) return { ok: true };
  if (existingCount + picked.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `You can attach up to ${MAX_ATTACHMENTS} files per report.` };
  }
  const result = validateAttachmentRequests(
    picked.map((file) => ({
      name: file.name,
      contentType: file.type,
      size: file.size,
    })),
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export function collectIssueDiagnostics(input: {
  appearance: Appearance;
  signedIn: boolean;
  syncEnabled: boolean;
  notificationsEnabled: boolean;
  standalone: boolean;
}): IssueDiagnostics {
  const diagnostics: IssueDiagnostics = {
    displayMode: input.standalone ? "standalone" : "browser",
    appearance: appearanceLabel(input.appearance),
    signedIn: input.signedIn,
    syncEnabled: input.signedIn ? input.syncEnabled : false,
    notificationsEnabled: input.notificationsEnabled,
  };
  if (typeof window !== "undefined") {
    diagnostics.appUrl = window.location.origin;
    diagnostics.path = window.location.pathname || "/";
    if (window.innerWidth > 0 && window.innerHeight > 0) {
      diagnostics.viewport = `${window.innerWidth}×${window.innerHeight}`;
    }
  }
  const timeZone = browserTimeZone();
  if (timeZone) diagnostics.timeZone = timeZone;
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    diagnostics.userAgent = navigator.userAgent;
  }
  return diagnostics;
}

export function diagnosticsSummaryRows(diagnostics: IssueDiagnostics): IssueDiagnosticsRow[] {
  const rows: IssueDiagnosticsRow[] = [];
  if (diagnostics.appUrl || diagnostics.path) {
    const page =
      diagnostics.appUrl && diagnostics.path && !diagnostics.appUrl.endsWith(diagnostics.path)
        ? `${diagnostics.appUrl}${diagnostics.path}`
        : (diagnostics.appUrl ?? diagnostics.path);
    if (page) rows.push({ label: "Page", value: page });
  }
  if (diagnostics.displayMode) {
    rows.push({
      label: "Mode",
      value: diagnostics.displayMode === "standalone" ? "Home Screen app" : "Browser tab",
    });
  }
  if (diagnostics.appearance) {
    rows.push({ label: "Appearance", value: diagnostics.appearance });
  }
  if (diagnostics.signedIn !== undefined) {
    rows.push({
      label: "Account",
      value: diagnostics.signedIn
        ? diagnostics.syncEnabled
          ? "Signed in · Sync on"
          : "Signed in · Sync off"
        : "Guest",
    });
  }
  if (diagnostics.notificationsEnabled !== undefined) {
    rows.push({ label: "Reminders", value: diagnostics.notificationsEnabled ? "On" : "Off" });
  }
  if (diagnostics.viewport) {
    rows.push({ label: "Screen", value: diagnostics.viewport });
  }
  if (diagnostics.timeZone) {
    rows.push({ label: "Time zone", value: diagnostics.timeZone });
  }
  return rows;
}

async function currentAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(
  fetchImpl: IssueReportFetcher,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadIssueAttachments(
  files: ReadonlyArray<File>,
  options?: {
    fetchImpl?: IssueReportFetcher;
    accessToken?: string | null;
    endpoint?: string;
    onProgress?: (uploadedIndex: number, total: number) => void;
  },
): Promise<{ ok: true; attachments: IssueAttachment[] } | { ok: false; reason: IssueReportFailureReason; message: string }> {
  if (files.length === 0) return { ok: true, attachments: [] };
  const metadata = files.map((file) => ({
    name: file.name,
    contentType: file.type,
    size: file.size,
  }));
  const checked = validateAttachmentRequests(metadata);
  if (!checked.ok) {
    return { ok: false, reason: "invalid", message: checked.error };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? new URL("/functions/v1/report-issue", SUPABASE_URL).toString();
  const token = options?.accessToken !== undefined ? options.accessToken : await currentAccessToken();
  const bearer = token?.trim() || SUPABASE_ANON_KEY;

  let prepareResponse: Response;
  try {
    prepareResponse = await fetchJsonWithTimeout(
      fetchImpl,
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ mode: "prepare-uploads", files: checked.files }),
      },
      TIMEOUT_MS,
    );
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Couldn’t reach the server to upload your attachment. Check your connection and try again.",
    };
  }

  let prepareBody: { ok?: boolean; uploads?: PreparedUpload[]; error?: unknown } | null = null;
  try {
    prepareBody = (await prepareResponse.json()) as {
      ok?: boolean;
      uploads?: PreparedUpload[];
      error?: unknown;
    };
  } catch {
    prepareBody = null;
  }

  if (!prepareResponse.ok || !Array.isArray(prepareBody?.uploads) || prepareBody.uploads.length !== files.length) {
    const serverMessage =
      typeof prepareBody?.error === "string" && prepareBody.error.trim() ? prepareBody.error.trim() : null;
    if (prepareResponse.status === 400) {
      return { ok: false, reason: "invalid", message: serverMessage ?? "Check your attached files and try again." };
    }
    if (prepareResponse.status === 429) {
      return {
        ok: false,
        reason: "rate_limited",
        message: serverMessage ?? "You’ve uploaded several attachments recently. Please wait a bit before trying again.",
      };
    }
    if (prepareResponse.status === 503) {
      return {
        ok: false,
        reason: "unconfigured",
        message: "Attachment uploads aren’t turned on on the server yet.",
      };
    }
    return {
      ok: false,
      reason: "failed",
      message: serverMessage ?? "Couldn’t upload your attachment just now. Please try again in a moment.",
    };
  }

  const attachments: IssueAttachment[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const target = prepareBody.uploads[index]!;
    options?.onProgress?.(index + 1, files.length);
    try {
      const uploadResponse = await fetchJsonWithTimeout(
        fetchImpl,
        target.signedUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": target.contentType,
            "x-upsert": "false",
          },
          body: file,
        },
        UPLOAD_TIMEOUT_MS,
      );
      if (!uploadResponse.ok) {
        return {
          ok: false,
          reason: "failed",
          message: `Couldn’t upload ${target.name}. Please try again or send the report without it.`,
        };
      }
      attachments.push({
        name: target.name,
        contentType: target.contentType,
        size: target.size,
        url: target.publicUrl,
      });
    } catch {
      return {
        ok: false,
        reason: "network",
        message: `Uploading ${target.name} timed out or lost connection. Please try again.`,
      };
    }
  }

  return { ok: true, attachments };
}

export async function submitIssueReport(
  input: IssueReportInput & { files?: ReadonlyArray<File> },
  options?: {
    fetchImpl?: IssueReportFetcher;
    accessToken?: string | null;
    endpoint?: string;
    onProgress?: (status: string) => void;
  },
): Promise<IssueReportResult> {
  const validated = validateIssueReport(input);
  if (!validated.ok) {
    if (validated.spam) return { ok: true, identifier: null };
    return { ok: false, reason: "invalid", message: validated.error };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? new URL("/functions/v1/report-issue", SUPABASE_URL).toString();
  const token = options?.accessToken !== undefined ? options.accessToken : await currentAccessToken();
  const bearer = token?.trim() || SUPABASE_ANON_KEY;

  let attachments = validated.report.attachments;
  if (input.files && input.files.length > 0) {
    const uploaded = await uploadIssueAttachments(input.files, {
      fetchImpl,
      accessToken: bearer,
      endpoint,
      onProgress: (index, total) => {
        options?.onProgress?.(total === 1 ? "Uploading attachment…" : `Uploading ${index} of ${total}…`);
      },
    });
    if (!uploaded.ok) return uploaded;
    attachments = [...attachments, ...uploaded.attachments].slice(0, MAX_ATTACHMENTS);
  }

  options?.onProgress?.("Sending…");

  try {
    const response = await fetchJsonWithTimeout(
      fetchImpl,
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          category: validated.report.category,
          description: validated.report.description,
          contactEmail: validated.report.contactEmail ?? "",
          website: input.website ?? "",
          diagnostics: validated.report.diagnostics,
          attachments,
        }),
      },
      TIMEOUT_MS,
    );

    let body: { ok?: boolean; identifier?: unknown; error?: unknown; retryAfterSeconds?: unknown } | null = null;
    try {
      body = (await response.json()) as {
        ok?: boolean;
        identifier?: unknown;
        error?: unknown;
        retryAfterSeconds?: unknown;
      };
    } catch {
      body = null;
    }

    if (response.ok) {
      const identifier = typeof body?.identifier === "string" && body.identifier.trim() ? body.identifier.trim() : null;
      return { ok: true, identifier };
    }

    const serverMessage = typeof body?.error === "string" && body.error.trim() ? body.error.trim() : null;

    if (response.status === 400) {
      return {
        ok: false,
        reason: "invalid",
        message: serverMessage ?? "Check your note and try again.",
      };
    }

    if (response.status === 429) {
      const retryAfterSeconds =
        typeof body?.retryAfterSeconds === "number" && body.retryAfterSeconds > 0
          ? body.retryAfterSeconds
          : undefined;
      return {
        ok: false,
        reason: "rate_limited",
        message: serverMessage ?? "You’ve sent a few reports already. Please wait a bit before sending another.",
        retryAfterSeconds,
      };
    }

    if (response.status === 503) {
      return {
        ok: false,
        reason: "unconfigured",
        message: "Issue reporting isn’t turned on on the server yet. Please try again later.",
      };
    }

    return {
      ok: false,
      reason: "failed",
      message: serverMessage ?? "Your report couldn’t be sent just now. Please try again in a moment.",
    };
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Couldn’t reach the server. Check your connection and try again.",
    };
  }
}
