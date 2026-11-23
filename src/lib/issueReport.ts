import {
  ISSUE_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  issueCategoryLabel,
  validateIssueReport,
  type IssueCategory,
  type IssueDiagnostics,
  type IssueReportInput,
} from "../../supabase/functions/report-issue/report";
import { appearanceLabel, type Appearance } from "../domain/appearance";
import { browserTimeZone } from "./webPush";
import { supabase } from "./supabaseClient";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

export {
  ISSUE_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  issueCategoryLabel,
  validateIssueReport,
  type IssueCategory,
  type IssueDiagnostics,
  type IssueReportInput,
};

const TIMEOUT_MS = 15_000;

export type IssueReportFetcher = typeof fetch;

export type IssueReportFailureReason = "invalid" | "rate_limited" | "unconfigured" | "network" | "failed";

export type IssueReportResult =
  | { ok: true; identifier: string | null }
  | { ok: false; reason: IssueReportFailureReason; message: string; retryAfterSeconds?: number };

export type IssueDiagnosticsRow = {
  label: string;
  value: string;
};

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

export async function submitIssueReport(
  input: IssueReportInput,
  options?: {
    fetchImpl?: IssueReportFetcher;
    accessToken?: string | null;
    endpoint?: string;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(endpoint, {
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
      }),
      signal: controller.signal,
    });

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
  } finally {
    clearTimeout(timer);
  }
}
