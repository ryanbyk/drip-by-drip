import { useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth-context";

/** Storybook stand-in. It never calls Supabase. */
export function AuthFixtureProvider({ user: initial, children }: { user: AuthUser | null; children: ReactNode }) {
  const [user, setUser] = useState(initial);
  const [syncEnabled, setSyncEnabled] = useState(true);

  const value = useMemo(
    () => ({
      status: user ? ("signed-in" as const) : ("guest" as const),
      user,
      authError: null,
      landing: null,
      syncEnabled,
      setSyncEnabled,
      acknowledgeLanding: () => undefined,
      sendMagicLink: async () => null,
      signInWithProvider: async () => null,
      signOut: async () => null,
      saveDisplayName: async (name: string) => {
        setUser((current) => (current ? { ...current, displayName: name.trim() } : current));
        return null;
      },
      deleteAccount: async () => null,
    }),
    [user, syncEnabled],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
