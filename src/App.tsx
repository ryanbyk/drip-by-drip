import { useEffect, useRef, useState, type ReactNode } from "react";
import { TabBar } from "./components/ui";
import { useApp } from "./state/AppState";
import { History } from "./screens/History";
import { Onboarding } from "./screens/Onboarding";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/today/Today";

type Tab = "today" | "history" | "settings";

export function App() {
  const { snapshot } = useApp();
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_TODAY") setTab("today");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (!snapshot.prefs.onboardingComplete) {
    return (
      <PhoneShell>
        <Onboarding />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {tab === "today" ? <Today onHistory={() => setTab("history")} /> : null}
      {tab === "history" ? <History onOpenToday={() => setTab("today")} /> : null}
      {tab === "settings" ? <Settings /> : null}
      <TabBar tab={tab} onTab={setTab} />
    </PhoneShell>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sync = () => {
      const scroller = root.querySelector<HTMLElement>(".screen");
      root.classList.toggle("is-scrolled", (scroller?.scrollTop ?? 0) > 0);
    };
    root.addEventListener("scroll", sync, true);
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true });
    sync();
    return () => {
      root.removeEventListener("scroll", sync, true);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="app-shell">
      <div className="phone" ref={ref}>
        {children}
      </div>
    </div>
  );
}
