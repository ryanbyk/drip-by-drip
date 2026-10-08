import { describe, expect, it } from "vitest";
import { onboardingShell } from "./onboardingAccount";

const guest = {
  onboardingComplete: false,
  requestingSignIn: false,
  authStatus: "guest" as const,
  syncedUserId: null,
  userId: null,
};

describe("onboardingShell", () => {
  it("starts on onboarding", () => {
    expect(onboardingShell(guest)).toBe("onboarding");
  });

  it("opens sign-in from the first screen until the account snapshot has synced", () => {
    expect(onboardingShell({ ...guest, requestingSignIn: true })).toBe("sign-in");
    expect(
      onboardingShell({
        ...guest,
        requestingSignIn: true,
        authStatus: "signed-in",
        userId: "user-a",
        syncedUserId: null,
      }),
    ).toBe("sign-in");
  });

  it("returns to onboarding when the account has no finished snapshot", () => {
    expect(
      onboardingShell({
        ...guest,
        requestingSignIn: true,
        authStatus: "signed-in",
        userId: "user-a",
        syncedUserId: "user-a",
      }),
    ).toBe("onboarding");
  });

  it("opens Today once the synced account has finished onboarding", () => {
    expect(
      onboardingShell({
        onboardingComplete: true,
        requestingSignIn: true,
        authStatus: "signed-in",
        userId: "user-a",
        syncedUserId: "user-a",
      }),
    ).toBe("today");
  });
});
