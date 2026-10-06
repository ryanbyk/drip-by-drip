import { useMemo, useState, type ReactNode } from "react";
import { PhoneShell } from "../components/PhoneShell";
import { TabBar } from "../components/ui";
import type { Snapshot } from "../domain/types";
import { AuthFixtureProvider } from "../state/AuthFixture";
import type { AuthUser } from "../state/auth-context";
import { AppProvider } from "../state/AppState";
import { createMemoryStorage } from "./memory";

export function StoryApp({
  snapshot,
  children,
  authUser = null,
}: {
  snapshot: Snapshot;
  children: ReactNode;
  authUser?: AuthUser | null;
}) {
  const storage = useMemo(() => createMemoryStorage(snapshot), [snapshot]);
  return (
    <AppProvider storage={storage} initialSnapshot={snapshot}>
      <AuthFixtureProvider user={authUser}>{children}</AuthFixtureProvider>
    </AppProvider>
  );
}

export function useFixture(create: () => Snapshot): Snapshot {
  const [snapshot] = useState(create);
  return snapshot;
}

export function Phone({
  children,
  tab,
  prepare,
}: {
  children: ReactNode;
  tab?: "today" | "history" | "settings";
  prepare?: (phone: HTMLElement) => void;
}) {
  return (
    <PhoneShell prepare={prepare}>
      {children}
      {tab ? <TabBar tab={tab} onTab={() => undefined} /> : null}
    </PhoneShell>
  );
}
