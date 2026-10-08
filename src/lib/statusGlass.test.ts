import { describe, expect, it } from "vitest";
import { statusGlassActive, statusGlassOpacity } from "./statusGlass";

describe("status glass", () => {
  it("stays off at rest, including sub-pixel scroll residue", () => {
    expect(statusGlassActive(0, 8, 16)).toBe(false);
    expect(statusGlassActive(0.5, 8, 16)).toBe(false);
    expect(statusGlassActive(1, 67, 16)).toBe(false);
  });

  it("stays off while only empty safe-area padding is moving", () => {
    expect(statusGlassActive(2, 67, 16)).toBe(false);
    expect(statusGlassActive(52, 67, 16)).toBe(false);
  });

  it("turns on once content enters the strip", () => {
    expect(statusGlassActive(2, 8, 16)).toBe(true);
    expect(statusGlassActive(53, 67, 16)).toBe(true);
  });

  it("fades from nothing at rest to full once the line has crossed the strip", () => {
    expect(statusGlassOpacity(0, 8, 40)).toBe(0);
    expect(statusGlassOpacity(1, 8, 40)).toBe(0);
    expect(statusGlassOpacity(9, 8, 40)).toBeCloseTo(0.5);
    expect(statusGlassOpacity(17, 8, 40)).toBe(1);
    expect(statusGlassOpacity(28, 67, 40)).toBe(0);
    expect(statusGlassOpacity(46, 67, 40)).toBe(1);
  });
});