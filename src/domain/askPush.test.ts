import { describe, expect, it } from "vitest";
import { QBE_QUESTION } from "./types";
import { normalizeBiblePrefs } from "./bibleSource";
import { createSnapshot } from "../state/reducer";
import {
  ASK_QUESTION,
  alreadyAnsweredToday,
  askPushDue,
  askPushMessage,
  deadPushStatus,
  normalizeAskTime,
  notificationFromPush,
  zonedClock,
} from "./askPush";

const losAngelesMorning = new Date("2026-10-07T13:30:00.000Z");

function payload(input: { askTime?: string; timeZone?: string; enabled?: boolean; onboarded?: boolean; answer?: string }) {
  return {
    prefs: {
      askTime: input.askTime ?? "06:30",
      timeZone: input.timeZone ?? "",
      notificationsEnabled: input.enabled ?? true,
      onboardingComplete: input.onboarded ?? true,
    },
    days: input.answer ? { "2026-10-07": { answer: input.answer } } : {},
  };
}

describe("ask push schedule", () => {
  it("uses the same question the app already asks", () => {
    expect(ASK_QUESTION).toBe(QBE_QUESTION);
    expect(askPushMessage("2026-10-07")).toEqual({
      title: "Drip by drip",
      body: QBE_QUESTION,
      tag: "qbe-2026-10-07",
    });
  });

  it("matches ask time in the device zone, then the saved zone", () => {
    expect(zonedClock(losAngelesMorning, "America/Los_Angeles")).toEqual({
      date: "2026-10-07",
      minutes: "06:30",
    });
    expect(zonedClock(new Date("2026-10-07T01:00:00.000Z"), "Asia/Kolkata")).toEqual({
      date: "2026-10-07",
      minutes: "06:30",
    });
    expect(zonedClock(new Date("2026-01-01T00:00:00.000Z"), "UTC")?.minutes).toBe("00:00");

    expect(
      askPushDue({
        payload: payload({ timeZone: "UTC" }),
        deviceTimeZone: "America/Los_Angeles",
        now: losAngelesMorning,
        lastSentOn: null,
      }),
    ).toEqual({ due: true, localDate: "2026-10-07", timeZone: "America/Los_Angeles" });

    expect(
      askPushDue({
        payload: payload({ timeZone: "America/Los_Angeles" }),
        deviceTimeZone: "UTC",
        now: losAngelesMorning,
        lastSentOn: null,
      }).due,
    ).toBe(false);

    expect(
      askPushDue({
        payload: payload({ timeZone: "America/Los_Angeles" }),
        deviceTimeZone: null,
        now: losAngelesMorning,
        lastSentOn: null,
      }).due,
    ).toBe(true);
  });

  it("skips a second send, an answer, and reminders that are off", () => {
    const due = {
      payload: payload({}),
      deviceTimeZone: "America/Los_Angeles",
      now: losAngelesMorning,
      lastSentOn: null,
    };
    expect(askPushDue({ ...due, lastSentOn: "2026-10-07" }).due).toBe(false);
    expect(askPushDue({ ...due, payload: payload({ answer: "yes" }) }).due).toBe(false);
    expect(askPushDue({ ...due, payload: payload({ answer: "not_today" }) }).due).toBe(false);
    expect(alreadyAnsweredToday(payload({ answer: "unanswered" }), "2026-10-07")).toBe(false);
    expect(askPushDue({ ...due, payload: payload({ enabled: false }) }).due).toBe(false);
    expect(askPushDue({ ...due, payload: payload({ onboarded: false }) }).due).toBe(false);
    expect(askPushDue({ ...due, payload: null }).due).toBe(false);
  });

  it("normalizes ask times and keeps a grace body when the push says so", () => {
    expect(normalizeAskTime("6:05")).toBe("06:05");
    expect(normalizeAskTime("24:00")).toBeNull();
    expect(notificationFromPush({ body: "  A quiet hello.  ", tag: "grace-1" }, "2026-10-07")).toEqual({
      title: "Drip by drip",
      body: "A quiet hello.",
      tag: "grace-1",
    });
    expect(notificationFromPush(null, "2026-10-07").body).toBe(QBE_QUESTION);
    expect(deadPushStatus(410)).toBe(true);
    expect(deadPushStatus(404)).toBe(true);
    expect(deadPushStatus(500)).toBe(false);
  });

  it("stores a real IANA zone and drops a made-up one", () => {
    const prefs = normalizeBiblePrefs({ ...createSnapshot().prefs, timeZone: "America/Chicago" });
    expect(prefs.timeZone).toBe("America/Chicago");
    expect(normalizeBiblePrefs({ ...prefs, timeZone: "Not/AZone" }).timeZone).toBe("");
  });
});
