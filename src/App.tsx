import { useEffect, useState } from "react";
import { PhoneShell } from "./components/PhoneShell";
import { TabBar } from "./components/ui";
import { authCallback } from "./lib/authCallback";
import { useApp } from "./state/AppState";
import { useAuth } from "./state/auth-context";
import { History } from "./screens/History";
import { Onboarding } from "./screens/Onboarding";
import { Settings } from "./screens/Settings";
import { SignIn } from "./screens/SignIn";
import { Today } from "./screens/today/Today";

type Tab = "today" | "history" | "settings";

export function App() {
  const { snapshot } = useApp();
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>(authCallback.present ? "settings" : "today");
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_TODAY") {
        setTab("today");
        setAccountOpen(false);
        setSigningIn(false);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!snapshot.prefs.onboardingComplete || !auth.landing) return;
    setTab("settings");
    if (auth.landing === "account") {
      setAccountOpen(true);
      setSigningIn(false);
    } else {
      setAccountOpen(false);
      setSigningIn(true);
    }
    auth.acknowledgeLanding();
  }, [auth.landing, auth.acknowledgeLanding, snapshot.prefs.onboardingComplete]);

  useEffect(() => {
    if (!signingIn || auth.status !== "signed-in") return;
    setSigningIn(false);
    setTab("settings");
    setAccountOpen(true);
  }, [signingIn, auth.status]);

  function selectTab(next: Tab) {
    setTab(next);
    if (next !== "settings") {
      setAccountOpen(false);
      setSigningIn(false);
    }
  }

  if (!snapshot.prefs.onboardingComplete) {
    return (
      <PhoneShell>
        <Onboarding />
      </PhoneShell>
    );
  }

  if (signingIn) {
    return (
      <PhoneShell>
        <SignIn onSkip={() => setSigningIn(false)} />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {tab === "today" ? <Today onHistory={() => selectTab("history")} /> : null}
      {tab === "history" ? <History onOpenToday={() => selectTab("today")} /> : null}
      {tab === "settings" ? (
        <Settings accountOpen={accountOpen} onAccountOpen={setAccountOpen} onSignIn={() => setSigningIn(true)} />
      ) : null}
      <TabBar tab={tab} onTab={selectTab} />
    </PhoneShell>
  );
}
