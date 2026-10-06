import { useLayoutEffect, useRef, type ReactNode } from "react";
import { statusGlassActive } from "../lib/statusGlass";

export function PhoneShell({
  children,
  prepare,
}: {
  children: ReactNode;
  /** Adjust the phone before the first glass sync. Stories use this to open already scrolled. */
  prepare?: (phone: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    prepareRef.current?.(root);
    const sync = () => {
      const scroller = root.querySelector<HTMLElement>(".screen");
      const band = root.querySelector<HTMLElement>(".status-glass");
      if (!scroller || !band) {
        root.classList.remove("is-scrolled");
        return;
      }
      const bandHeight = band.getBoundingClientRect().height;
      const paddingTop = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
      root.classList.toggle("is-scrolled", statusGlassActive(scroller.scrollTop, paddingTop, bandHeight));
    };
    root.addEventListener("scroll", sync, true);
    root.addEventListener("scrollend", sync, true);
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true });
    sync();
    return () => {
      root.removeEventListener("scroll", sync, true);
      root.removeEventListener("scrollend", sync, true);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="phone" ref={ref}>
        <div className="status-glass" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
