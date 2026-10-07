import { useMemo, type ReactNode } from "react";
import { PartnerContext, idlePartner, type PartnerValue } from "./partner-context";

/** Storybook stand-in. It never calls Supabase. */
export function PartnerFixtureProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<PartnerValue>;
}) {
  const full = useMemo(() => ({ ...idlePartner, ...value }), [value]);
  return <PartnerContext.Provider value={full}>{children}</PartnerContext.Provider>;
}
