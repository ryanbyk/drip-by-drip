/** Shown when the API does not send its own Crossway notice. */
export const ESV_COPYRIGHT =
  "Scripture quotations are from the ESV® Bible, © 2001 by Crossway. Used by permission.";

export type EsvReadReason = "off" | "offline" | "error";

export type EsvReadMode = { show: "in-app" } | { show: "link-out"; reason: EsvReadReason };

/**
 * In-app ESV when the toggle is on and text can be shown.
 * Offline without a cached passage, or a failed proxy fetch, falls back to
 * the external Bible link so the reader is never a dead end.
 */
export function esvReadMode(input: {
  showInAppEsv: boolean;
  online: boolean;
  cached?: boolean;
  fetchFailed?: boolean;
  unavailable?: boolean;
}): EsvReadMode {
  if (!input.showInAppEsv) return { show: "link-out", reason: "off" };
  if (input.unavailable || input.fetchFailed) return { show: "link-out", reason: "error" };
  if (!input.online && !input.cached) return { show: "link-out", reason: "offline" };
  return { show: "in-app" };
}
