import { describe, expect, it } from "vitest";
import { createSnapshot, reducer } from "../state/reducer";
import { appearanceFrom, appearanceLabel, resolveTheme } from "./appearance";

describe("appearance", () => {
  it("defaults to system and ignores values outside the three settings", () => {
    expect(createSnapshot().prefs.appearance).toBe("system");
    expect(appearanceFrom(undefined)).toBe("system");
    expect(appearanceFrom("sepia")).toBe("system");
    expect(appearanceFrom("dark")).toBe("dark");
  });

  it("labels the settings row System, Light, or Dark", () => {
    expect(appearanceLabel("system")).toBe("System");
    expect(appearanceLabel("light")).toBe("Light");
    expect(appearanceLabel("dark")).toBe("Dark");
  });

  it("keeps an explicit theme and lets system follow the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("persists on prefs and stays through a progress reset", () => {
    const chosen = reducer(createSnapshot(), { type: "prefs", prefs: { appearance: "dark" } });
    expect(chosen.prefs.appearance).toBe("dark");
    const reset = reducer(chosen, { type: "reset", today: "2026-10-06" });
    expect(reset.prefs.appearance).toBe("dark");
    expect(reset.prefs.askTime).toBe(chosen.prefs.askTime);
  });
});
