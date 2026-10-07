import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { authCallback } from "../lib/authCallback";
import {
  deleteSignedInAccount,
  loadProfile,
  requestEmailCode,
  requestMagicLink,
  requestOAuth,
  requestSignOut,
  saveProfileName,
  settleAuthCallback,
  verifyEmailCode as confirmEmailCode,
} from "../lib/authClient";
import { fallbackDisplayName, providerIdFromUser } from "../lib/auth";
import { readSyncEnabled, writeSyncEnabled } from "../lib/syncPreference";
import { dropLocalPushSubscription, releaseWebPush } from "../lib/webPush";
import { supabase } from "../lib/supabaseClient";
import { AuthContext, type AuthLanding, type AuthStatus, type AuthUser } from "./auth-context";

function toAuthUser(user: User, displayName: string): AuthUser {
  const identity = user.identities?.[0]?.provider;
  return {
    id: user.id,
    email: user.email ?? "",
    provider: providerIdFromUser(user.app_metadata?.provider, identity),
    displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(authCallback.error);
  const [landing, setLanding] = useState<AuthLanding | null>(null);
  const [syncEnabled, setSyncEnabledState] = useState(() => {
    try {
      return readSyncEnabled(localStorage);
    } catch {
      return true;
    }
  });
  const landed = useRef(false);

  const setSyncEnabled = useCallback((enabled: boolean) => {
    setSyncEnabledState(enabled);
    try {
      writeSyncEnabled(localStorage, enabled);
    } catch {
      // Private mode can reject storage. The switch still reflects this visit.
    }
  }, []);

  const acknowledgeLanding = useCallback(() => setLanding(null), []);

  useEffect(() => {
    void settleAuthCallback();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "guest");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authCallback.present || landed.current || status === "loading") return;
    landed.current = true;
    setLanding(status === "signed-in" ? "account" : "sign-in");
  }, [status]);

  useEffect(() => {
    const user = sessionUser;
    if (!user) {
      setProfileName(null);
      return;
    }
    let cancelled = false;
    const metadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : undefined;
    void loadProfile(user.id, metadata).then((profile) => {
      if (cancelled) return;
      setProfileName(profile ? profile.displayName : fallbackDisplayName(metadata));
    });
    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  const user = useMemo(() => {
    if (!sessionUser) return null;
    const metadata =
      sessionUser.user_metadata && typeof sessionUser.user_metadata === "object"
        ? (sessionUser.user_metadata as Record<string, unknown>)
        : undefined;
    return toAuthUser(sessionUser, profileName ?? fallbackDisplayName(metadata));
  }, [sessionUser, profileName]);

  const sendMagicLink = useCallback(async (email: string) => {
    setAuthError(null);
    return requestMagicLink(email);
  }, []);

  const sendEmailCode = useCallback(async (email: string) => {
    setAuthError(null);
    return requestEmailCode(email);
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    setAuthError(null);
    return confirmEmailCode(email, code);
  }, []);

  const signInWithProvider = useCallback(async (provider: "apple" | "google") => {
    setAuthError(null);
    return requestOAuth(provider);
  }, []);

  const signOut = useCallback(async () => {
    const cleanup = await releaseWebPush();
    if (cleanup) return cleanup;
    return requestSignOut();
  }, []);

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!sessionUser) return "Sign in again to save your name.";
      const error = await saveProfileName(sessionUser.id, name);
      if (!error) setProfileName(name.trim().slice(0, 80));
      return error;
    },
    [sessionUser],
  );

  const deleteAccount = useCallback(async () => {
    const error = await deleteSignedInAccount();
    if (!error) await dropLocalPushSubscription();
    return error;
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      authError,
      landing,
      syncEnabled,
      setSyncEnabled,
      acknowledgeLanding,
      sendMagicLink,
      sendEmailCode,
      verifyEmailCode,
      signInWithProvider,
      signOut,
      saveDisplayName,
      deleteAccount,
    }),
    [
      status,
      user,
      authError,
      landing,
      syncEnabled,
      setSyncEnabled,
      acknowledgeLanding,
      sendMagicLink,
      sendEmailCode,
      verifyEmailCode,
      signInWithProvider,
      signOut,
      saveDisplayName,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
