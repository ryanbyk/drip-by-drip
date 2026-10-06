/** Shown when the API does not send its own Crossway notice. */
export const ESV_COPYRIGHT =
  "Scripture quotations are from the ESV® Bible, © 2001 by Crossway. Used by permission.";

export const ESV_SIGNUP_URL = "https://api.esv.org";

export type EsvReadReason = "off" | "missing-key" | "offline" | "error";

export type EsvReadMode = { show: "in-app" } | { show: "link-out"; reason: EsvReadReason };

/**
 * In-app ESV only when the toggle is on, a key is stored, and we can show text.
 * Offline, a missing key, a rejected key, or a failed fetch falls back to the
 * external Bible link so the reader is never a dead end.
 */
export function esvReadMode(input: {
  showInAppEsv: boolean;
  esvApiKey: string;
  online: boolean;
  cached?: boolean;
  fetchFailed?: boolean;
  keyRejected?: boolean;
}): EsvReadMode {
  if (!input.showInAppEsv) return { show: "link-out", reason: "off" };
  if (!input.esvApiKey.trim()) return { show: "link-out", reason: "missing-key" };
  if (input.keyRejected || input.fetchFailed) return { show: "link-out", reason: "error" };
  if (!input.online && !input.cached) return { show: "link-out", reason: "offline" };
  return { show: "in-app" };
}

/** Last four characters stay visible, matching the Bible source key field. */
export function maskEsvKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  const hidden = "•".repeat(8);
  if (trimmed.length <= 4) return hidden;
  return `${hidden}${trimmed.slice(-4)}`;
}
