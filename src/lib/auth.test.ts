import { describe, expect, it } from "vitest";
import { createSnapshot } from "../state/reducer";
import {
  accountLine,
  authCallbackFromLocation,
  authRedirectUrl,
  alternateEmailSignIn,
  digitsFromEmailCode,
  emailCodeError,
  emailOtpType,
  emailSignInLabel,
  formatResendCountdown,
  initialsFor,
  isEmail,
  isEmailCode,
  mailAppHref,
  primaryEmailSignIn,
  profileHeading,
  providerIdFromUser,
  signedInWith,
} from "./auth";
import { exportFilename, snapshotExport } from "./exportData";
import { readSyncEnabled, writeSyncEnabled } from "./syncPreference";

describe("auth helpers", () => {
  it("builds the redirect used after a magic link or OAuth return", () => {
    expect(authRedirectUrl("http://localhost:5173", "/drip-by-drip/")).toBe(
      "http://localhost:5173/drip-by-drip/",
    );
    expect(authRedirectUrl("https://ryanbyk.github.io", "/drip-by-drip")).toBe(
      "https://ryanbyk.github.io/drip-by-drip/",
    );
  });

  it("prefers a code in the installed app and a link in the browser", () => {
    expect(primaryEmailSignIn(true)).toBe("code");
    expect(primaryEmailSignIn(false)).toBe("link");
    expect(alternateEmailSignIn("code")).toBe("link");
    expect(alternateEmailSignIn("link")).toBe("code");
    expect(emailSignInLabel("code")).toBe("Email me a code");
    expect(emailSignInLabel("link")).toBe("Email me a sign-in link");
  });

  it("keeps six digits from a pasted email code", () => {
    expect(digitsFromEmailCode("12 34-56")).toBe("123456");
    expect(digitsFromEmailCode("code 12345678")).toBe("123456");
    expect(isEmailCode("123456")).toBe(true);
    expect(isEmailCode("12345")).toBe(false);
    expect(isEmailCode("12345a")).toBe(false);
  });

  it("rewrites an expired or invalid code and leaves other errors", () => {
    expect(emailCodeError("Token has expired or is invalid")).toBe(
      "That code did not work. Request a new one and try again.",
    );
    expect(emailCodeError("Email rate limit exceeded")).toBe("Email rate limit exceeded");
  });

  it("accepts a normal email and rejects a blank one", () => {
    expect(isEmail("you@example.com")).toBe(true);
    expect(isEmail("  you@example.com  ")).toBe(true);
    expect(isEmail("not-an-email")).toBe(false);
    expect(isEmail("")).toBe(false);
  });

  it("names the provider the way the account screen does", () => {
    expect(providerIdFromUser("apple", undefined)).toBe("apple");
    expect(providerIdFromUser(undefined, "google")).toBe("google");
    expect(providerIdFromUser("github", undefined)).toBe("email");
    expect(accountLine("ryan@example.com", "apple")).toBe("ryan@example.com · Signed in with Apple");
    expect(accountLine("", "google")).toBe("Signed in with Google");
    expect(signedInWith("email")).toBe("Signed in with email");
  });

  it("builds initials from the display name, then the email", () => {
    expect(initialsFor("Ryan Bykowski", "ryan@example.com")).toBe("RB");
    expect(profileHeading("", "ryan@example.com")).toBe("ryan");
    expect(initialsFor("", "ryan@example.com")).toBe("RY");
  });

  it("formats the resend countdown as minutes and seconds", () => {
    expect(formatResendCountdown(42)).toBe("Resend in 0:42");
    expect(formatResendCountdown(60)).toBe("Resend in 1:00");
    expect(formatResendCountdown(0)).toBe("Resend in 0:00");
  });

  it("opens a known inbox and falls back to the mail app", () => {
    expect(mailAppHref("ryan@gmail.com")).toContain("mail.google.com");
    expect(mailAppHref("ryan@icloud.com")).toContain("icloud.com");
    expect(mailAppHref("you@example.com")).toBe("mailto:");
  });

  it("notices a magic-link or OAuth return, including an error", () => {
    expect(authCallbackFromLocation("", "#access_token=abc&refresh_token=def").present).toBe(true);
    expect(authCallbackFromLocation("?code=abc", "").present).toBe(true);
    expect(authCallbackFromLocation("?token_hash=abc&type=email", "").present).toBe(true);
    expect(authCallbackFromLocation("", "").present).toBe(false);
    expect(authCallbackFromLocation("?error_description=OAuth+failed", "").error).toBe("OAuth failed");
    expect(emailOtpType("magiclink")).toBe("magiclink");
    expect(emailOtpType("nope")).toBeNull();
  });
});

describe("sync preference", () => {
  it("stays on until turned off", () => {
    const data: Record<string, string> = {};
    const storage = {
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
    };
    expect(readSyncEnabled(storage)).toBe(true);
    writeSyncEnabled(storage, false);
    expect(readSyncEnabled(storage)).toBe(false);
    writeSyncEnabled(storage, true);
    expect(readSyncEnabled(storage)).toBe(true);
  });
});

describe("export", () => {
  it("downloads the local snapshot as JSON", () => {
    const snapshot = createSnapshot();
    const json = snapshotExport(snapshot);
    expect(JSON.parse(json)).toMatchObject({ version: 1 });
    expect(exportFilename("2026-10-06")).toBe("drip-by-drip-2026-10-06.json");
  });
});
