import { resolveTheme, type Appearance } from "../domain/appearance";

/** Toolbar color. Light keeps the existing accent; dark uses the pen $bg. */
const THEME_COLOR = {
  light: "#2E5C61",
  dark: "#121A1C",
} as const;

/**
 * Sets `data-theme` to the stored preference. Light and dark tokens are fixed.
 * System leaves the choice to `prefers-color-scheme` in CSS.
 * Returns a cleanup for the theme-color listener.
 */
export function syncDocumentTheme(appearance: Appearance): () => void {
  document.documentElement.dataset.theme = appearance;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const applyChrome = () => {
    const resolved = resolveTheme(appearance, media.matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
  };
  applyChrome();
  media.addEventListener("change", applyChrome);
  return () => media.removeEventListener("change", applyChrome);
}
