import { type MouseEvent, type ReactNode } from "react";
import { launchPlan, passageLink } from "../domain/bibleSource";
import { openPassageTarget } from "../lib/openPassage";
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
  const enabled = Boolean(online && link.href);
  const classes = [className, enabled ? "" : "is-disabled"].filter(Boolean).join(" ");

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!enabled || !link.href) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const plan = launchPlan(link, navigator.userAgent);
    if (!plan || plan.kind === "web") return;
    event.preventDefault();
    openPassageTarget(plan);
  }

  return (
    <a
      className={classes}
      href={enabled ? link.href ?? undefined : undefined}
      target={enabled ? "_blank" : undefined}
      rel={enabled ? "noopener noreferrer" : undefined}
      aria-disabled={!enabled}
      onClick={onClick}
    >
      {children ?? link.label}
    </a>
  );
}
