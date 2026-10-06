import { type MouseEvent, type ReactNode } from "react";
import { launchPlan, passageLink, type LaunchContext, type LaunchPlan } from "../domain/bibleSource";
import { armSchemeFallback } from "../lib/openPassage";
import { useApp } from "../state/AppState";

export function OpenPassageLink({
  reference,
  className,
  online = true,
  children,
}: {
  reference: string;
  className?: string;
  online?: boolean;
  children?: ReactNode;
}) {
  const { snapshot } = useApp();
  const link = passageLink(reference, snapshot.prefs);
  const plan = link.href ? launchPlan(link, launchContext()) : null;
  const enabled = Boolean(online && plan);
  const anchor = plan ? anchorFor(plan) : null;
  const classes = [className, enabled ? "" : "is-disabled"].filter(Boolean).join(" ");

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!enabled || !plan || !anchor) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    // The href is already the handoff (universal link, intent, or scheme).
    // preventDefault would turn it back into a scripted navigation, which
    // iOS will not open in the YouVersion app.
    if (plan.kind === "scheme") armSchemeFallback(plan.fallbackHref);
  }

  return (
    <a
      className={classes}
      href={enabled ? anchor?.href : undefined}
      target={enabled ? anchor?.target : undefined}
      rel={enabled ? anchor?.rel : undefined}
      aria-disabled={!enabled}
      onClick={onClick}
    >
      {children ?? link.label}
    </a>
  );
}

function launchContext(): LaunchContext {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    standalone:
      nav.standalone === true ||
      window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches,
    touchPoints: nav.maxTouchPoints,
  };
}

function anchorFor(plan: LaunchPlan): { href: string; target?: "_blank"; rel?: string } {
  switch (plan.kind) {
    case "tab":
      return { href: plan.href, target: "_blank", rel: "noopener noreferrer" };
    case "universal":
    case "intent":
      return { href: plan.href };
    case "scheme":
      return { href: plan.appHref };
    default: {
      const exhaustive: never = plan;
      return exhaustive;
    }
  }
}
