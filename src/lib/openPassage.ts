import type { LaunchPlan } from "../domain/bibleSource";

const APP_FALLBACK_MS = 1200;

/**
 * Phone: open the YouVersion scheme, and if the app does not take the page,
 * send the bible.com link through a window opened during the click.
 * Desktop and other sources use that web link directly.
 */
export function openPassageTarget(plan: LaunchPlan): void {
  if (plan.kind === "web") {
    window.open(plan.href, "_blank", "noopener,noreferrer");
    return;
  }
  const popup = window.open("", "_blank");
  const web = plan.href;
  const timer = window.setTimeout(finish, APP_FALLBACK_MS);
  const onHide = () => {
    if (document.visibilityState !== "hidden") return;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onHide);
    popup?.close();
  };
  document.addEventListener("visibilitychange", onHide);
  window.location.assign(plan.appHref);

  function finish() {
    document.removeEventListener("visibilitychange", onHide);
    if (document.visibilityState === "hidden") {
      popup?.close();
      return;
    }
    if (popup) {
      popup.location.href = web;
      return;
    }
    window.location.assign(web);
  }
}
