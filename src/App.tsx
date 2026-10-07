import { useEffect, useRef, useState } from "react";
import { PhoneShell } from "./components/PhoneShell";
import { TabBar } from "./components/ui";
import { authCallback } from "./lib/authCallback";
import { useApp } from "./state/AppState";
import { useAuth } from "./state/auth-context";
import { usePartner } from "./state/partner-context";
import { History } from "./screens/History";
import { Onboarding } from "./screens/Onboarding";
import { Settings } from "./screens/Settings";
import { SignIn } from "./screens/SignIn";
import { Today } from "./screens/today/Today";

type Tab = "today" | "history" | "settings";

export function App() {
  const { snapshot } = useApp();
  const auth = useAuth();
  const partner = usePartner();
  const [tab, setTab] = useState<Tab>(authCallback.present ? "settings" : "today");
  const [accountOpen, setAccountOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const openedInvite = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_TODAY") {
        setTab("today");
        setAccountOpen(false);
        setPartnerOpen(false);
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
      if (partner.pendingInvite) {
        setPartnerOpen(true);
        setAccountOpen(false);
      } else {
        setAccountOpen(true);
        setPartnerOpen(false);
      }
      setSigningIn(false);
    } else {
      setAccountOpen(false);
      setPartnerOpen(false);
      setSigningIn(true);
    }
    auth.acknowledgeLanding();
  }, [auth.landing, auth.acknowledgeLanding, partner.pendingInvite, snapshot.prefs.onboardingComplete]);

  useEffect(() => {
    if (!signingIn || auth.status !== "signed-in") return;
    setSigningIn(false);
    setTab("settings");
    if (partner.pendingInvite) {
      setPartnerOpen(true);
      setAccountOpen(false);
    } else {
      setAccountOpen(true);
    }
  }, [signingIn, auth.status, partner.pendingInvite]);

  useEffect(() => {
    if (openedInvite.current || !partner.pendingInvite || auth.status === "loading") return;
    if (!snapshot.prefs.onboardingComplete) return;
    openedInvite.current = true;
    setTab("settings");
    if (auth.status === "guest") {
      setSigningIn(true);
      return;
    }
    setSigningIn(false);
    setPartnerOpen(true);
    setAccountOpen(false);
  }, [partner.pendingInvite, auth.status, snapshot.prefs.onboardingComplete]);

  function selectTab(next: Tab) {
    setTab(next);
    if (next !== "settings") {
      setAccountOpen(false);
      setPartnerOpen(false);
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
        <SignIn
          onSkip={() => {
            partner.dismissIncoming();
            setSigningIn(false);
          }}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {tab === "today" ? <Today onHistory={() => selectTab("history")} /> : null}
      {tab === "history" ? <History onOpenToday={() => selectTab("today")} /> : null}
      {tab === "settings" ? (
        <Settings
          accountOpen={accountOpen}
          onAccountOpen={setAccountOpen}
          partnerOpen={partnerOpen}
          onPartnerOpen={setPartnerOpen}
          onSignIn={() => setSigningIn(true)}
          onSignedOut={() => {
            setAccountOpen(false);
            setPartnerOpen(false);
            setSigningIn(true);
          }}
        />
      ) : null}
      <TabBar tab={tab} onTab={selectTab} />
    </PhoneShell>
  );
}
