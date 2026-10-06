import { FunctionsHttpError } from "@supabase/supabase-js";
import { authRedirectUrl, emailOtpType, fallbackDisplayName, type AuthProviderId } from "./auth";
import { supabase } from "./supabaseClient";

export function currentRedirect(): string {
  return authRedirectUrl(window.location.origin, import.meta.env.BASE_URL);
}

export async function requestMagicLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: currentRedirect(),
      shouldCreateUser: true,
    },
  });
  return error ? error.message : null;
}

export async function requestOAuth(provider: Extract<AuthProviderId, "apple" | "google">): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: currentRedirect(),
      scopes: provider === "apple" ? "name email" : "email profile",
    },
  });
  return error ? error.message : null;
}

export async function requestSignOut(): Promise<string | null> {
  const { error } = await supabase.auth.signOut();
  return error ? error.message : null;
}

type ProfileRow = { display_name: string | null };

export async function loadProfile(
  userId: string,
  metadata: Record<string, unknown> | undefined,
): Promise<{ displayName: string } | null> {
  const existing = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (!existing.error && existing.data) {
    const row = existing.data as ProfileRow;
    return { displayName: row.display_name?.trim() ?? "" };
  }
  const fallback = fallbackDisplayName(metadata);
  const inserted = await supabase.from("profiles").insert({
    id: userId,
    display_name: fallback || null,
  });
  if (inserted.error && inserted.error.code !== "23505") return null;
  const again = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (again.error || !again.data) return null;
  const row = again.data as ProfileRow;
  return { displayName: row.display_name?.trim() ?? "" };
}

export async function saveProfileName(userId: string, name: string): Promise<string | null> {
  const trimmed = name.trim().slice(0, 80);
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: trimmed || null,
  });
  return error ? error.message : null;
}

export async function deleteSignedInAccount(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>("delete-account", {
    method: "POST",
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        // Non-JSON body. The client message below is the fallback.
      }
    }
    return error.message;
  }
  if (data?.error) return data.error;
  return requestSignOut();
}

let settling: Promise<void> | null = null;

/** Exchanges a PKCE code or token_hash if the return URL has one. Hash tokens are handled by the client. */
export function settleAuthCallback(): Promise<void> {
  settling ??= settleOnce();
  return settling;
}

async function settleOnce(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = emailOtpType(url.searchParams.get("type"));
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) url.searchParams.delete("code");
  }
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
    }
  }
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const keepTokens = hashParams.has("access_token");
  for (const key of ["error", "error_description", "error_code"]) {
    url.searchParams.delete(key);
    if (!keepTokens) hashParams.delete(key);
  }
  const hash = hashParams.toString();
  const next = `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.replaceState({}, "", next);
}
