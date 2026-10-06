import { createContext, useContext } from "react";
import type { AuthProviderId } from "../lib/auth";

export type AuthUser = {
  id: string;
  email: string;
  provider: AuthProviderId;
  displayName: string;
};

export type AuthStatus = "loading" | "guest" | "signed-in";

export type AuthLanding = "account" | "sign-in";

export type AuthValue = {
  status: AuthStatus;
  user: AuthUser | null;
  authError: string | null;
  landing: AuthLanding | null;
  syncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
  acknowledgeLanding: () => void;
  sendMagicLink: (email: string) => Promise<string | null>;
  signInWithProvider: (provider: "apple" | "google") => Promise<string | null>;
  signOut: () => Promise<string | null>;
  saveDisplayName: (name: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an auth provider");
  return value;
}
