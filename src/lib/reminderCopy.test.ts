import { describe, expect, it } from "vitest";
import { reminderCopy, reminderDevice } from "./reminderCopy";

const base = {
  state: "granted" as const,
  enabled: true,
  supported: true,
  signedIn: true,
  device: "browser" as const,
};

describe("reminder copy", () => {
  it("names the device limits", () => {
    expect(reminderDevice(true, false)).toBe("ios-tab");
    expect(reminderDevice(true, true)).toBe("ios-home");
    expect(reminderDevice(false, false)).toBe("browser");
  });

  it("tells a signed-in reader that Web Push can arrive with the app closed", () => {
    expect(reminderCopy(base)).toContain("Web Push");
    expect(reminderCopy(base)).toContain("closed");
    expect(reminderCopy({ ...base, device: "ios-home" })).toContain("Home Screen");
    expect(reminderCopy({ ...base, device: "ios-tab", signedIn: false, enabled: false })).toContain("Safari tab");
  });

  it("keeps guests on this device until they sign in", () => {
    expect(reminderCopy({ ...base, signedIn: false })).toContain("Sign in");
    expect(reminderCopy({ ...base, enabled: false, signedIn: false })).toContain("Home Screen");
    expect(reminderCopy({ ...base, supported: false })).toContain("can’t send reminders");
    expect(reminderCopy({ ...base, state: "denied" })).toContain("blocked");
  });
});
