import { describe, expect, it } from "vitest";
import { normalizeBiblePrefs } from "./bibleSource";
import { esvReadMode, maskEsvKey } from "./esv";
import type { UserPrefs } from "./types";
import { createSnapshot, reducer } from "../state/reducer";

function prefs(partial: Partial<UserPrefs> = {}): UserPrefs {
  return { ...createSnapshot().prefs, ...partial };
}

describe("in-app ESV decision", () => {
  it("links out unless the toggle, a key, and a way to show text are all present", () => {
    expect(esvReadMode({ showInAppEsv: false, esvApiKey: "device-key", online: true })).toEqual({
      show: "link-out",
      reason: "off",
    });
    expect(esvReadMode({ showInAppEsv: true, esvApiKey: "   ", online: true })).toEqual({
      show: "link-out",
      reason: "missing-key",
    });
    expect(esvReadMode({ showInAppEsv: true, esvApiKey: "device-key", online: false })).toEqual({
      show: "link-out",
      reason: "offline",
    });
    expect(
      esvReadMode({ showInAppEsv: true, esvApiKey: "device-key", online: true, fetchFailed: true }),
    ).toEqual({ show: "link-out", reason: "error" });
    expect(
      esvReadMode({ showInAppEsv: true, esvApiKey: "device-key", online: true, keyRejected: true }),
    ).toEqual({ show: "link-out", reason: "error" });
  });

  it("reads in the app when a key is stored and the passage is already cached offline", () => {
    expect(esvReadMode({ showInAppEsv: true, esvApiKey: "device-key", online: true })).toEqual({
      show: "in-app",
    });
    expect(
      esvReadMode({ showInAppEsv: true, esvApiKey: "device-key", online: false, cached: true }),
    ).toEqual({ show: "in-app" });
  });
});

describe("ESV key prefs", () => {
  it("masks a stored key and hides a key that is four characters or shorter", () => {
    expect(maskEsvKey("")).toBe("");
    expect(maskEsvKey("  ab  ")).toBe("••••••••");
    expect(maskEsvKey("storybook-not-a-real-key-3f9a")).toBe("••••••••3f9a");
  });

  it("stores the toggle and a trimmed key, and drops values this version cannot keep", () => {
    const saved = reducer(createSnapshot(), {
      type: "prefs",
      prefs: { showInAppEsv: true, esvApiKey: "  device-key  " },
    });
    expect(saved.prefs.showInAppEsv).toBe(true);
    expect(saved.prefs.esvApiKey).toBe("device-key");
    expect(createSnapshot().prefs.showInAppEsv).toBe(false);
    expect(createSnapshot().prefs.esvApiKey).toBe("");

    const clean = normalizeBiblePrefs({
      ...prefs(),
      showInAppEsv: "yes" as unknown as boolean,
      esvApiKey: 42 as unknown as string,
    });
    expect(clean.showInAppEsv).toBe(false);
    expect(clean.esvApiKey).toBe("");
  });
});
