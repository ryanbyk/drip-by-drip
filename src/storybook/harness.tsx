import { useMemo, useState, type ReactNode } from "react";
import { TabBar } from "../components/ui";
import type { Snapshot } from "../domain/types";
import { AppProvider } from "../state/AppState";
import { createMemoryStorage } from "./memory";

export function StoryApp({ snapshot, children }: { snapshot: Snapshot; children: ReactNode }) {
  const storage = useMemo(() => createMemoryStorage(snapshot), [snapshot]);
  return (
    <AppProvider storage={storage} initialSnapshot={snapshot}>
      {children}
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
}: {
  children: ReactNode;
  tab?: "today" | "history" | "settings";
}) {
  return (
    <div className="app-shell">
      <div className="phone">
        {children}
        {tab ? <TabBar tab={tab} onTab={() => undefined} /> : null}
      </div>
    </div>
  );
}
