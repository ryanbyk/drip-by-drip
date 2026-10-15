import { useMemo, type ReactNode } from "react";
import { GroupContext, idleGroups, type GroupValue } from "./group-context";

/** Storybook stand-in. It never calls Supabase. */
export function GroupFixtureProvider({ children, value }: { children: ReactNode; value?: Partial<GroupValue> }) {
  const full = useMemo(() => ({ ...idleGroups, ...value }), [value]);
  return <GroupContext.Provider value={full}>{children}</GroupContext.Provider>;
}
