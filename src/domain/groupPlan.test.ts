import { describe, expect, it } from "vitest";
import { formatRef } from "./refs";
import {
  EVERY_DAY,
  MON_FRI,
  followView,
  groupView,
  joinWhereCopy,
  pacePerDay,
  planBlurb,
  planDayLabel,
  planReadings,
  planRestLine,
  planTitle,
  planTodayLine,
  readingDaysFact,
  toggleWeekday,
  validPlanDraft,
  weekdayOn,
  type GroupPlanFollow,
} from "./groupPlan";

const mark: GroupPlanFollow = {
  planId: "plan-1",
  groupId: "group-1",
  groupName: "CrossWay Men’s Group",
  bookId: "mark",
  startChapter: 1,
  endChapter: 16,
  pace: "chapter",
  readingDays: MON_FRI,
  startDate: "2026-10-05",
  mode: "group",
  startedOn: "2026-10-05",
};

describe("group plan schedule", () => {
  it("walks one chapter on weekdays and skips the weekend", () => {
    const readings = planReadings(mark);
    expect(readings).toHaveLength(16);
    expect(readings.map((reading) => reading.date).slice(0, 6)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-12",
    ]);
    expect(readings.map((reading) => formatRef(reading.range)).slice(0, 4)).toEqual([
      "Mark 1",
      "Mark 2",
      "Mark 3",
      "Mark 4",
    ]);
    expect(readings.some((reading) => reading.date === "2026-10-10" || reading.date === "2026-10-11")).toBe(false);
  });

  it("stops at a chapter range and can take two chapters a day", () => {
    const readings = planReadings({
      ...mark,
      endChapter: 4,
      pace: "two",
      readingDays: EVERY_DAY,
      startDate: "2026-10-05",
    });
    expect(readings.map((reading) => formatRef(reading.range))).toEqual(["Mark 1–2", "Mark 3–4"]);
  });

  it("uses the app’s verse drip when that pace is chosen", () => {
    const readings = planReadings({ ...mark, pace: "verses", endChapter: 1, readingDays: EVERY_DAY });
    expect(readings.length).toBeGreaterThan(1);
    expect(formatRef(readings[0]!.range)).toBe("Mark 1:1–12");
    expect(pacePerDay("verses")).toBe("12 vv");
    expect(pacePerDay("chapter")).toBe("1 ch");
    expect(pacePerDay("two")).toBe("2 ch");
  });

  it("places the group on today’s reading and rests on an off day", () => {
    const thursday = groupView(mark, "2026-10-08");
    expect(thursday.status).toBe("reading");
    expect(planDayLabel(thursday)).toBe("Day 4 of 16");
    expect(planTodayLine(thursday)).toBe("Today: Mark 4");
    expect(joinWhereCopy(thursday)).toContain("Mark 4 today");

    const saturday = groupView(mark, "2026-10-10");
    expect(saturday.status).toBe("off");
    expect(planTodayLine(saturday)).toBe("Next: Mark 6");
    expect(saturday.progress).toBeCloseTo(5 / 16);
  });

  it("starts a member at day 1 on their own anchor", () => {
    const own = followView({ ...mark, mode: "start", startedOn: "2026-10-08" }, "2026-10-08");
    expect(own.status).toBe("reading");
    expect(own.today?.index).toBe(1);
    expect(formatRef(own.today!.range)).toBe("Mark 1");
    expect(planRestLine({ ...mark, mode: "start", startedOn: "2026-10-08" }, "2026-10-10")).toMatch(/rests today/);
  });

  it("names the plan and the reading days", () => {
    expect(planTitle(mark)).toBe("Reading through Mark");
    expect(planTitle({ ...mark, startChapter: 1, endChapter: 9, bookId: "proverbs" })).toBe("Reading through Proverbs 1–9");
    expect(readingDaysFact(MON_FRI)).toEqual({ value: "Mon–Fri", caption: "weekends free" });
    expect(readingDaysFact(EVERY_DAY).value).toBe("Every day");
    expect(planBlurb(mark)).toContain("one chapter a weekday, weekends free");
    expect(weekdayOn(toggleWeekday(MON_FRI, 0), 0)).toBe(true);
    expect(validPlanDraft({ ...mark, readingDays: 0 })).toMatch(/reading day/);
    expect(validPlanDraft(mark)).toBeNull();
  });
});
