import { describe, expect, it, vi } from "vitest";
import {
  buildLinearIssueInput,
  createMemoryRateLimiter,
  DEFAULT_LINEAR_BUG_LABEL_ID,
  DEFAULT_LINEAR_PROJECT_ID,
  DEFAULT_LINEAR_STATE_ID,
  DEFAULT_LINEAR_SUGGESTION_LABEL_ID,
  DEFAULT_LINEAR_TEAM_ID,
  extractClientIp,
  formatLinearDescription,
  issueTitleFromDescription,
  MAX_DESCRIPTION_LENGTH,
  validateIssueReport,
} from "../../supabase/functions/report-issue/report";
import {
  collectIssueDiagnostics,
  diagnosticsSummaryRows,
  submitIssueReport,
  type IssueReportFetcher,
} from "./issueReport";
import { SUPABASE_ANON_KEY } from "./supabaseConfig";

describe("issue report validation and Linear formatting", () => {
  it("validates a guest bug report and normalizes whitespace", () => {
    const result = validateIssueReport({
      category: "bug",
      description: "  Notifications did not open today’s ask.\r\nTried twice on iPhone.  ",
      contactEmail: "  reader@example.com ",
      diagnostics: {
        appUrl: "https://app.drip-by-drip.com",
        path: "/",
        displayMode: "standalone",
        appearance: "Dark",
        signedIn: false,
        syncEnabled: false,
        notificationsEnabled: true,
        viewport: "390×844",
        timeZone: "America/Chicago",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.category).toBe("bug");
    expect(result.report.description).toBe("Notifications did not open today’s ask.\nTried twice on iPhone.");
    expect(result.report.contactEmail).toBe("reader@example.com");
    expect(result.report.diagnostics.displayMode).toBe("standalone");
  });

  it("rejects short descriptions, invalid emails, and unknown categories", () => {
    expect(validateIssueReport({ category: "bug", description: "short" })).toMatchObject({
      ok: false,
      spam: false,
    });
    expect(
      validateIssueReport({
        category: "bug",
        description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
      }),
    ).toMatchObject({ ok: false, spam: false });
    expect(
      validateIssueReport({
        category: "other",
        description: "This is long enough to pass description checks.",
      }),
    ).toMatchObject({ ok: false, spam: false });
    expect(
      validateIssueReport({
        category: "suggestion",
        description: "Could we add a gentle weekly reminder summary?",
        contactEmail: "not-an-email",
      }),
    ).toMatchObject({ ok: false, spam: false });
  });

  it("flags honeypot submissions as spam without leaking validation errors", () => {
    const result = validateIssueReport({
      category: "bug",
      description: "Buy cheap links now!!",
      website: "https://spam.example",
    });
    expect(result).toEqual({ ok: false, spam: true });
  });

  it("derives crisp single-line titles and formats Linear markdown without private reading data", () => {
    const title = issueTitleFromDescription(
      "bug",
      "The bottom sheet cut off the Done button on iPhone SE. Also happened in dark mode.",
    );
    expect(title).toBe("[Bug] The bottom sheet cut off the Done button on iPhone SE.");

    const longTitle = issueTitleFromDescription(
      "suggestion",
      "It would be really lovely to have a small button on the history view to jump straight back to the current week without scrolling through months",
    );
    expect(longTitle.startsWith("[Suggestion] ")).toBe(true);
    expect(longTitle.length).toBeLessThanOrEqual(88);
    expect(longTitle.endsWith("…")).toBe(true);

    const validated = validateIssueReport({
      category: "suggestion",
      description: "Add a shortcut to jump back to today.",
      contactEmail: "",
      diagnostics: {
        appUrl: "https://app.drip-by-drip.com",
        path: "/",
        displayMode: "browser",
        appearance: "System",
        signedIn: true,
        syncEnabled: true,
        notificationsEnabled: false,
        viewport: "390×844",
        timeZone: "America/Chicago",
        userAgent: "Mozilla/5.0 `test`",
      },
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const input = buildLinearIssueInput(validated.report, {
      teamId: DEFAULT_LINEAR_TEAM_ID,
      projectId: DEFAULT_LINEAR_PROJECT_ID,
      stateId: DEFAULT_LINEAR_STATE_ID,
      bugLabelId: DEFAULT_LINEAR_BUG_LABEL_ID,
      suggestionLabelId: DEFAULT_LINEAR_SUGGESTION_LABEL_ID,
    });
    expect(input.teamId).toBe(DEFAULT_LINEAR_TEAM_ID);
    expect(input.projectId).toBe(DEFAULT_LINEAR_PROJECT_ID);
    expect(input.stateId).toBe(DEFAULT_LINEAR_STATE_ID);
    expect(input.labelIds).toEqual([DEFAULT_LINEAR_SUGGESTION_LABEL_ID]);

    const markdown = formatLinearDescription(validated.report);
    expect(markdown).toContain("Add a shortcut to jump back to today.");
    expect(markdown).toContain("**Category:** Suggestion");
    expect(markdown).toContain("**Contact:** Not provided");
    expect(markdown).toContain("- **Mode:** Browser tab");
    expect(markdown).toContain("- **Account:** Signed in (Sync on)");
    expect(markdown).toContain("`Mozilla/5.0 'test'`");
  });

  it("extracts client IP and enforces sliding-window rate limits", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
    expect(extractClientIp(headers)).toBe("203.0.113.10");

    const cfHeaders = new Headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "203.0.113.10" });
    expect(extractClientIp(cfHeaders)).toBe("198.51.100.7");

    const limiter = createMemoryRateLimiter(2, 60_000);
    expect(limiter.consume("user-a", 1_000)).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    expect(limiter.consume("user-a", 2_000)).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 0 });
    const blocked = limiter.consume("user-a", 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(51);
    expect(limiter.consume("user-a", 62_000).allowed).toBe(true);
  });
});

describe("issueReport client", () => {
  it("collects only safe device diagnostics and renders human-readable summary rows", () => {
    const diagnostics = collectIssueDiagnostics({
      appearance: "dark",
      signedIn: false,
      syncEnabled: true,
      notificationsEnabled: false,
      standalone: true,
    });
    expect(diagnostics.displayMode).toBe("standalone");
    expect(diagnostics.appearance).toBe("Dark");
    expect(diagnostics.signedIn).toBe(false);
    expect(diagnostics.syncEnabled).toBe(false);
    expect(diagnostics.notificationsEnabled).toBe(false);

    const rows = diagnosticsSummaryRows(diagnostics);
    expect(rows.find((row) => row.label === "Mode")?.value).toBe("Home Screen app");
    expect(rows.find((row) => row.label === "Account")?.value).toBe("Guest");
    expect(rows.find((row) => row.label === "Reminders")?.value).toBe("Off");
  });

  it("sends guest reports with the anon key and signed-in reports with the user token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: IssueReportFetcher = vi.fn(async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, identifier: "CW-95" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });

    const guestResult = await submitIssueReport(
      {
        category: "bug",
        description: "The ask screen froze after tapping Yes.",
      },
      { fetchImpl, accessToken: null },
    );
    expect(guestResult).toEqual({ ok: true, identifier: "CW-95" });
    expect(calls[0]?.url).toContain("/functions/v1/report-issue");
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`);

    const signedInResult = await submitIssueReport(
      {
        category: "suggestion",
        description: "Allow filtering History by Huh? notes.",
        contactEmail: "ryan@example.com",
      },
      { fetchImpl, accessToken: "user-session-jwt" },
    );
    expect(signedInResult).toEqual({ ok: true, identifier: "CW-95" });
    expect((calls[1]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer user-session-jwt");
  });

  it("maps rate-limit, unconfigured, and network errors cleanly", async () => {
    const rateLimited = await submitIssueReport(
      { category: "bug", description: "Something broke on History." },
      {
        accessToken: null,
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "Please wait a bit.", retryAfterSeconds: 120 }), { status: 429 }),
      },
    );
    expect(rateLimited).toEqual({
      ok: false,
      reason: "rate_limited",
      message: "Please wait a bit.",
      retryAfterSeconds: 120,
    });

    const unconfigured = await submitIssueReport(
      { category: "bug", description: "Something broke on History." },
      {
        accessToken: null,
        fetchImpl: async () => new Response(JSON.stringify({ error: "Not configured" }), { status: 503 }),
      },
    );
    expect(unconfigured).toMatchObject({ ok: false, reason: "unconfigured" });

    const offline = await submitIssueReport(
      { category: "bug", description: "Something broke on History." },
      {
        accessToken: null,
        fetchImpl: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(offline).toMatchObject({ ok: false, reason: "network" });
  });
});
