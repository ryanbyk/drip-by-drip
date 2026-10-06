import { describe, expect, it } from "vitest";
import { normalizeBiblePrefs } from "./bibleSource";
import { esvReadMode } from "./esv";
import type { UserPrefs } from "./types";
import { createSnapshot, reducer } from "../state/reducer";

function prefs(partial: Partial<UserPrefs> = {}): UserPrefs {
  return { ...createSnapshot().prefs, ...partial };
}

describe("in-app ESV decision", () => {
  it("links out when the toggle is off, the proxy is down, or there is no way to show text", () => {
    expect(esvReadMode({ showInAppEsv: false, online: true })).toEqual({
      show: "link-out",
      reason: "off",
    });
    expect(esvReadMode({ showInAppEsv: true, online: false })).toEqual({
      show: "link-out",
      reason: "offline",
    });
    expect(esvReadMode({ showInAppEsv: true, online: true, fetchFailed: true })).toEqual({
      show: "link-out",
      reason: "error",
    });
    expect(esvReadMode({ showInAppEsv: true, online: true, unavailable: true })).toEqual({
      show: "link-out",
      reason: "error",
    });
  });

  it("reads in the app by default, including a cached passage while offline", () => {
    expect(esvReadMode({ showInAppEsv: true, online: true })).toEqual({
      show: "in-app",
    });
    expect(esvReadMode({ showInAppEsv: true, online: false, cached: true })).toEqual({
      show: "in-app",
    });
  });
});

describe("ESV reading prefs", () => {
  it("defaults in-app reading on and keeps an explicit off", () => {
    expect(createSnapshot().prefs.showInAppEsv).toBe(true);
    expect(createSnapshot().prefs).not.toHaveProperty("esvApiKey");

    const saved = reducer(createSnapshot(), {
      type: "prefs",
      prefs: { showInAppEsv: false },
    });
    expect(saved.prefs.showInAppEsv).toBe(false);

    const turnedOn = reducer(saved, {
      type: "prefs",
      prefs: { showInAppEsv: true },
    });
    expect(turnedOn.prefs.showInAppEsv).toBe(true);

    const clean = normalizeBiblePrefs({
      ...prefs(),
      showInAppEsv: "yes" as unknown as boolean,
    });
    expect(clean.showInAppEsv).toBe(false);
  });
});
