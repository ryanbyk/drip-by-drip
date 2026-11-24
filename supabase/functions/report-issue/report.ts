/**
 * Shared validation, formatting, attachment rules, and fallback rate-limiting
 * for in-app issue reports. Pure TypeScript (no DOM or Deno globals) so both
 * the report-issue Edge Function and Vitest can import and test the exact same rules.
 */

export const ISSUE_CATEGORIES = ["bug", "suggestion"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const MIN_DESCRIPTION_LENGTH = 8;
export const MAX_DESCRIPTION_LENGTH = 3000;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_TITLE_LENGTH = 88;
export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 900;
export const UPLOAD_PREPARE_MAX_REQUESTS = 15;

export const ISSUE_ATTACHMENTS_BUCKET = "issue-attachments";
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_FILENAME_LENGTH = 120;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedAttachmentMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const EXT_TO_MIME: Record<string, AllowedAttachmentMimeType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/**
 * Default Linear routing IDs for Crossway-Milwaukee -> Drip by drip (P-CW-6).
 * None of these UUIDs are secrets; Edge Function env vars can override any of them.
 */
export const DEFAULT_LINEAR_TEAM_ID = "8e20efe1-372c-40c4-a41f-27db27612ac7";
export const DEFAULT_LINEAR_PROJECT_ID = "769c2e65-a296-4de6-9c27-7532121ebb2d";
export const DEFAULT_LINEAR_STATE_ID = "29e99c5f-64b8-4b39-8010-06081fcb613f";
export const DEFAULT_LINEAR_BUG_LABEL_ID = "17fb425e-48c7-41fa-bba6-5a9f37ca878c";
export const DEFAULT_LINEAR_SUGGESTION_LABEL_ID = "8b804aec-126c-43ba-b45c-c58edae61b4b";
export const DEFAULT_LINEAR_USER_FEEDBACK_LABEL_ID = "a274a6d5-3df3-47fd-9e11-59628a1c17b3";

export type IssueDiagnostics = {
  appUrl?: string;
  path?: string;
  displayMode?: "standalone" | "browser";
  appearance?: string;
  signedIn?: boolean;
  syncEnabled?: boolean;
  notificationsEnabled?: boolean;
  userAgent?: string;
  viewport?: string;
  timeZone?: string;
  appVersion?: string;
};

export type IssueAttachmentRequest = {
  name: string;
  contentType: AllowedAttachmentMimeType;
  size: number;
};

export type IssueAttachment = {
  name: string;
  contentType: AllowedAttachmentMimeType;
  size: number;
  url: string;
};

export type IssueReportInput = {
  category: IssueCategory;
  description: string;
  contactEmail?: string;
  website?: string;
  diagnostics?: IssueDiagnostics;
  attachments?: IssueAttachment[];
};

export type NormalizedIssueReport = {
  category: IssueCategory;
  description: string;
  contactEmail: string | null;
  diagnostics: IssueDiagnostics;
  attachments: IssueAttachment[];
};

export type IssueValidationResult =
  | { ok: true; report: NormalizedIssueReport }
  | { ok: false; spam: true }
  | { ok: false; spam: false; error: string };

export type AttachmentValidationResult =
  | { ok: true; files: IssueAttachmentRequest[] }
  | { ok: false; error: string };

export type LinearRoutingConfig = {
  teamId: string;
  projectId?: string;
  stateId?: string;
  bugLabelId?: string;
  suggestionLabelId?: string;
  userFeedbackLabelId?: string;
};

export type LinearIssueCreateInput = {
  teamId: string;
  title: string;
  description: string;
  projectId?: string;
  stateId?: string;
  labelIds?: string[];
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function cleanSingleLine(value: unknown, maxLength: number): string | undefined {
  const cleaned = cleanString(value, maxLength);
  if (!cleaned) return undefined;
  return cleaned.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === "string" && (ISSUE_CATEGORIES as readonly string[]).includes(value);
}

export function issueCategoryLabel(category: IssueCategory): string {
  switch (category) {
    case "bug":
      return "Bug";
    case "suggestion":
      return "Suggestion";
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

export function isAllowedAttachmentMimeType(value: string): value is AllowedAttachmentMimeType {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value);
}

export function normalizeAttachmentContentType(rawType: string, filename = ""): AllowedAttachmentMimeType | null {
  const normalized = rawType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "image/jpg") return "image/jpeg";
  if (isAllowedAttachmentMimeType(normalized)) return normalized;
  const ext = filename.split(".").pop()?.trim().toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export function extensionForAttachment(contentType: AllowedAttachmentMimeType): string {
  return MIME_TO_EXT[contentType];
}

export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function isInlineMarkdownImageType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/jpeg" ||
    contentType === "image/webp" ||
    contentType === "image/gif"
  );
}

export function isVideoContentType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function cleanAttachmentFilename(raw: unknown, fallbackExt: string): string {
  const rawName = typeof raw === "string" ? raw : "";
  const base = rawName.split(/[\\/]/).pop()?.replace(/[\r\n[\]()<>`]/g, "").trim() ?? "";
  if (!base) return `attachment.${fallbackExt}`;
  return base.slice(0, MAX_FILENAME_LENGTH);
}

export function validateAttachmentRequests(raw: unknown): AttachmentValidationResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Choose at least one screenshot or recording to upload." };
  }
  if (raw.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `You can attach up to ${MAX_ATTACHMENTS} files per report.` };
  }
  const files: IssueAttachmentRequest[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "One of the selected files couldn’t be read." };
    }
    const candidate = item as Record<string, unknown>;
    const rawType = typeof candidate.contentType === "string" ? candidate.contentType : "";
    const rawName = typeof candidate.name === "string" ? candidate.name : "";
    const contentType = normalizeAttachmentContentType(rawType, rawName);
    if (!contentType) {
      return {
        ok: false,
        error: "Only screenshots (PNG, JPEG, WebP, GIF, HEIC) and recordings (MP4, MOV, WebM) can be attached.",
      };
    }
    const size = typeof candidate.size === "number" ? candidate.size : Number.NaN;
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: "One of the selected files appears to be empty." };
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "Each file must be 25 MB or smaller." };
    }
    files.push({
      name: cleanAttachmentFilename(rawName, extensionForAttachment(contentType)),
      contentType,
      size: Math.round(size),
    });
  }
  return { ok: true, files };
}

export function sanitizeAttachments(raw: unknown, allowedUrlPrefix?: string): IssueAttachment[] {
  if (!Array.isArray(raw)) return [];
  const prefix = allowedUrlPrefix?.trim() ?? "";
  const attachments: IssueAttachment[] = [];
  for (const item of raw.slice(0, MAX_ATTACHMENTS)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (prefix && !url.startsWith(prefix)) continue;
    const rawType = typeof candidate.contentType === "string" ? candidate.contentType : "";
    const rawName = typeof candidate.name === "string" ? candidate.name : "";
    const contentType = normalizeAttachmentContentType(rawType, rawName);
    if (!contentType) continue;
    const size =
      typeof candidate.size === "number" && Number.isFinite(candidate.size) && candidate.size > 0
        ? Math.min(Math.round(candidate.size), MAX_ATTACHMENT_BYTES)
        : 0;
    attachments.push({
      name: cleanAttachmentFilename(rawName, extensionForAttachment(contentType)),
      contentType,
      size,
      url,
    });
  }
  return attachments;
}

export function sanitizeDiagnostics(raw: unknown): IssueDiagnostics {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const displayMode =
    source.displayMode === "standalone" || source.displayMode === "browser" ? source.displayMode : undefined;
  const out: IssueDiagnostics = {};
  const appUrl = cleanSingleLine(source.appUrl, 200);
  const path = cleanSingleLine(source.path, 120);
  const appearance = cleanSingleLine(source.appearance, 24);
  const userAgent = cleanSingleLine(source.userAgent, 300);
  const viewport = cleanSingleLine(source.viewport, 32);
  const timeZone = cleanSingleLine(source.timeZone, 80);
  const appVersion = cleanSingleLine(source.appVersion, 32);
  const signedIn = cleanBoolean(source.signedIn);
  const syncEnabled = cleanBoolean(source.syncEnabled);
  const notificationsEnabled = cleanBoolean(source.notificationsEnabled);

  if (appUrl) out.appUrl = appUrl;
  if (path) out.path = path;
  if (displayMode) out.displayMode = displayMode;
  if (appearance) out.appearance = appearance;
  if (signedIn !== undefined) out.signedIn = signedIn;
  if (syncEnabled !== undefined) out.syncEnabled = syncEnabled;
  if (notificationsEnabled !== undefined) out.notificationsEnabled = notificationsEnabled;
  if (viewport) out.viewport = viewport;
  if (timeZone) out.timeZone = timeZone;
  if (appVersion) out.appVersion = appVersion;
  if (userAgent) out.userAgent = userAgent;
  return out;
}

export function validateIssueReport(
  raw: unknown,
  options?: { allowedAttachmentPrefix?: string },
): IssueValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, spam: false, error: "Please include a short note about what happened." };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return { ok: false, spam: true };
  }

  const category = body.category;
  if (!isIssueCategory(category)) {
    return { ok: false, spam: false, error: "Choose Bug or Suggestion before sending." };
  }

  const description = typeof body.description === "string" ? body.description.replace(/\r\n/g, "\n").trim() : "";
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    return { ok: false, spam: false, error: "Add a few words about what happened or what you’d like to see." };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      spam: false,
      error: `Keep your note under ${MAX_DESCRIPTION_LENGTH} characters.`,
    };
  }

  let contactEmail: string | null = null;
  if (typeof body.contactEmail === "string" && body.contactEmail.trim().length > 0) {
    const trimmed = body.contactEmail.trim();
    if (trimmed.length > MAX_EMAIL_LENGTH || !SIMPLE_EMAIL.test(trimmed)) {
      return { ok: false, spam: false, error: "Enter a valid email address, or leave it blank." };
    }
    contactEmail = trimmed;
  }

  return {
    ok: true,
    report: {
      category,
      description,
      contactEmail,
      diagnostics: sanitizeDiagnostics(body.diagnostics),
      attachments: sanitizeAttachments(body.attachments, options?.allowedAttachmentPrefix),
    },
  };
}

export function issueTitleFromDescription(category: IssueCategory, description: string): string {
  const prefix = `[${issueCategoryLabel(category)}] `;
  const firstLine =
    description
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find(Boolean) ?? description.trim();
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  const sentenceMatch = collapsed.match(/^(.+?[.!?])(?:\s|$)/);
  const candidate = sentenceMatch && sentenceMatch[1].length >= 16 ? sentenceMatch[1] : collapsed;
  const maxBody = MAX_TITLE_LENGTH - prefix.length;
  if (candidate.length <= maxBody) return `${prefix}${candidate}`;
  const slice = candidate.slice(0, maxBody - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const clipped = lastSpace >= Math.floor(maxBody * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${prefix}${clipped.trimEnd()}…`;
}

function escapeInlineCode(value: string): string {
  return value.replace(/`/g, "'");
}

export function formatLinearDescription(report: NormalizedIssueReport): string {
  const lines: string[] = [report.description];

  if (report.attachments.length > 0) {
    lines.push("", "### Attachments");
    for (const attachment of report.attachments) {
      const sizeText = attachment.size > 0 ? ` (${formatAttachmentSize(attachment.size)})` : "";
      if (isInlineMarkdownImageType(attachment.contentType)) {
        lines.push("", `![${attachment.name}](${attachment.url})`, `*${attachment.name}${sizeText}*`);
      } else if (isVideoContentType(attachment.contentType)) {
        lines.push(`- [Screen recording: ${attachment.name}${sizeText}](${attachment.url})`);
      } else {
        lines.push(`- [Screenshot: ${attachment.name}${sizeText}](${attachment.url})`);
      }
    }
  }

  lines.push(
    "",
    "---",
    "",
    `**Reported from:** Drip by drip (in-app)`,
    `**Category:** ${issueCategoryLabel(report.category)}`,
    `**Contact:** ${report.contactEmail ?? "Not provided"}`,
  );

  const diag = report.diagnostics;
  const contextRows: string[] = [];
  if (diag.appUrl || diag.path) {
    const page = diag.appUrl && diag.path && !diag.appUrl.endsWith(diag.path) ? `${diag.appUrl}${diag.path}` : (diag.appUrl ?? diag.path);
    if (page) contextRows.push(`- **Page:** ${page}`);
  }
  if (diag.displayMode) {
    contextRows.push(`- **Mode:** ${diag.displayMode === "standalone" ? "Home Screen app" : "Browser tab"}`);
  }
  if (diag.appearance) {
    contextRows.push(`- **Appearance:** ${diag.appearance}`);
  }
  if (diag.signedIn !== undefined) {
    const account = diag.signedIn
      ? diag.syncEnabled === undefined
        ? "Signed in"
        : diag.syncEnabled
          ? "Signed in (Sync on)"
          : "Signed in (Sync off)"
      : "Guest";
    contextRows.push(`- **Account:** ${account}`);
  }
  if (diag.notificationsEnabled !== undefined) {
    contextRows.push(`- **Reminders:** ${diag.notificationsEnabled ? "On" : "Off"}`);
  }
  if (diag.viewport) {
    contextRows.push(`- **Viewport:** ${diag.viewport}`);
  }
  if (diag.timeZone) {
    contextRows.push(`- **Time zone:** ${diag.timeZone}`);
  }
  if (diag.appVersion) {
    contextRows.push(`- **App version:** ${diag.appVersion}`);
  }
  if (diag.userAgent) {
    contextRows.push(`- **User agent:** \`${escapeInlineCode(diag.userAgent)}\``);
  }

  if (contextRows.length > 0) {
    lines.push("", "### Device context", ...contextRows);
  }

  return lines.join("\n");
}

export function buildLinearIssueInput(
  report: NormalizedIssueReport,
  config: LinearRoutingConfig,
): LinearIssueCreateInput {
  const categoryLabelId = report.category === "bug" ? config.bugLabelId : config.suggestionLabelId;
  const labelIds = Array.from(
    new Set([categoryLabelId, config.userFeedbackLabelId].filter((id): id is string => Boolean(id))),
  );
  const input: LinearIssueCreateInput = {
    teamId: config.teamId,
    title: issueTitleFromDescription(report.category, report.description),
    description: formatLinearDescription(report),
  };
  if (config.projectId) input.projectId = config.projectId;
  if (config.stateId) input.stateId = config.stateId;
  if (labelIds.length > 0) input.labelIds = labelIds;
  return input;
}

export function extractClientIp(headers: Pick<Headers, "get">): string {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct && direct.trim()) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function createMemoryRateLimiter(
  limit = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000,
) {
  const hits = new Map<string, number[]>();
  return {
    consume(key: string, nowMs = Date.now()): RateLimitDecision {
      const cutoff = nowMs - windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? nowMs;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }
      recent.push(nowMs);
      hits.set(key, recent);
      return {
        allowed: true,
        remaining: Math.max(limit - recent.length, 0),
        retryAfterSeconds: 0,
      };
    },
    clear() {
      hits.clear();
    },
  };
}
