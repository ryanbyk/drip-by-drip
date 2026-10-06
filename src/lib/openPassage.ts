const HANDOFF_MS = 2000;

let pending = 0;

/**
 * Armed while a youversion:// anchor navigates. If the app does not take the
 * page, open the bible.com URL in this window.
 */
export function armSchemeFallback(webHref: string): void {
  window.clearTimeout(pending);
  const stop = () => {
    window.clearTimeout(pending);
    document.removeEventListener("visibilitychange", onHide);
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") stop();
  };
  document.addEventListener("visibilitychange", onHide);
  pending = window.setTimeout(() => {
    stop();
    if (document.visibilityState === "hidden") return;
    window.location.assign(webHref);
  }, HANDOFF_MS);
}
