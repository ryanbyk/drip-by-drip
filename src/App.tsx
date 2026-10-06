import { useEffect, useState } from "react";
import { PhoneShell } from "./components/PhoneShell";
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
