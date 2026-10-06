export type AuthProviderId = "apple" | "google" | "email";

const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function authRedirectUrl(origin: string, base: string): string {
  const url = new URL(base, origin.endsWith("/") ? origin : `${origin}/`);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function authProviderId(provider: unknown): AuthProviderId {
  switch (provider) {
    case "apple":
    case "google":
    case "email":
      return provider;
    default:
      return "email";
  }
}

export function providerIdFromUser(provider: unknown, identityProvider: unknown): AuthProviderId {
  if (typeof provider === "string" && provider) return authProviderId(provider);
  if (typeof identityProvider === "string" && identityProvider) return authProviderId(identityProvider);
  return "email";
}

export function signedInWith(provider: AuthProviderId): string {
  switch (provider) {
    case "apple":
      return "Signed in with Apple";
    case "google":
      return "Signed in with Google";
    case "email":
      return "Signed in with email";
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
}

export function accountLine(email: string, provider: AuthProviderId): string {
  const how = signedInWith(provider);
  const trimmed = email.trim();
  return trimmed ? `${trimmed} · ${how}` : how;
}

export function fallbackDisplayName(metadata: Record<string, unknown> | undefined): string {
  const full = metadata?.full_name ?? metadata?.name;
  return typeof full === "string" ? full.trim() : "";
}

export function profileHeading(displayName: string, email: string): string {
  const named = displayName.trim();
  if (named) return named;
  const local = email.split("@")[0]?.trim();
  return local || "Account";
}

export function initialsFor(name: string, email: string): string {
  const heading = profileHeading(name, email);
  const parts = heading.split(/[\s._-]+/).filter(Boolean);
  if (name.trim() && parts.length >= 2) {
    return `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
  }
  const letters = heading.replace(/[^A-Za-z0-9]/g, "");
  const compact = (letters.slice(0, 2) || "•").toUpperCase();
  return compact;
}

export function formatResendCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `Resend in ${minutes}:${String(rest).padStart(2, "0")}`;
}

export function mailAppHref(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  switch (domain) {
    case "gmail.com":
    case "googlemail.com":
    case "google.com":
      return "https://mail.google.com/mail/u/0/#inbox";
    case "outlook.com":
    case "hotmail.com":
    case "live.com":
    case "msn.com":
      return "https://outlook.live.com/mail/0/";
    case "icloud.com":
    case "me.com":
    case "mac.com":
      return "https://www.icloud.com/mail";
    case "yahoo.com":
    case "ymail.com":
      return "https://mail.yahoo.com";
    case "proton.me":
    case "protonmail.com":
    case "pm.me":
      return "https://mail.proton.me/u/0/inbox";
    default:
      return "mailto:";
  }
}

export function emailOtpType(value: string | null): EmailOtpType | null {
  switch (value) {
    case "signup":
    case "invite":
    case "magiclink":
    case "recovery":
    case "email_change":
    case "email":
      return value;
    default:
      return null;
  }
}

export function authCallbackFromLocation(
  search: string,
  hash: string,
): { present: boolean; error: string | null } {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const raw =
    query.get("error_description") ||
    hashParams.get("error_description") ||
    query.get("error") ||
    hashParams.get("error");
  const error = raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : null;
  const present = Boolean(
    error ||
      query.get("code") ||
      query.get("token_hash") ||
      hashParams.get("access_token") ||
      hashParams.get("refresh_token"),
  );
  return { present, error };
}
