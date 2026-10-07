import { describe, expect, it } from "vitest";
import { createSnapshot, reducer } from "../state/reducer";
import { sanitizeSnapshot } from "../lib/storage/document";
import { resolvePassage } from "./resolve";
import { currentStreak, longestStreak, powerOfFour } from "./streaks";
import type { Snapshot } from "./types";

const at = "2026-10-08T12:00:00.000Z";

function onboard(today = "2026-10-06", bookId = "mark", startChapter = 4): Snapshot {
  return reducer(createSnapshot(), {
    type: "completeOnboarding",
    today,
    at: "2026-10-06T12:00:00.000Z",
    mode: "book",
    bookId,
    dripSize: "chapter",
    startChapter,
    askTime: "06:30",
  });
}

describe("mark a recent day read", () => {
  it("records yesterday like a finished drip and moves the next suggestion", () => {
    let state = onboard();
    const finished = reducer(state, { type: "answer", today: "2026-10-07", at, answer: "yes" });
    const normal = reducer(finished, { type: "finish", today: "2026-10-07", at });

    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    const day = state.days["2026-10-07"];
    expect(day).toMatchObject({
      date: "2026-10-07",
      answer: "yes",
      readDone: true,
      readDoneAt: at,
      answeredAt: at,
      detour: false,
      huh: false,
      passageRef: normal.days["2026-10-07"]?.passageRef,
      passageTitle: normal.days["2026-10-07"]?.passageTitle,
      range: normal.days["2026-10-07"]?.range,
    });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 5, verse: 1 });
    const next = resolvePassage(state, "2026-10-08");
    expect(next.kind).toBe("book");
    if (next.kind === "book") expect(next.ref).toBe("Mark 5");
    expect(currentStreak(state.days, "2026-10-08", state.prefs.planStartDate)).toBe(1);
    expect(longestStreak(state.days, "2026-10-08", state.prefs.planStartDate)).toBe(1);
    expect(powerOfFour(state.days, "2026-10-08").engaged).toBe(1);
  });

  it("stops partway and keeps counted chapters on the bookmark", () => {
    let state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      today: "2026-10-06",
      at: "2026-10-06T12:00:00.000Z",
      mode: "book",
      bookId: "isaiah",
      dripSize: "chapter",
      startChapter: 40,
      countEarlier: true,
      askTime: "06:30",
    });
    state = reducer(state, {
      type: "markPastRead",
      date: "2026-10-06",
      today: "2026-10-07",
      at,
      stop: { chapter: 40, verse: 10 },
    });
    expect(state.places.isaiah).toEqual({ bookId: "isaiah", chapter: 40, verse: 11, countedThrough: 39 });
    const next = resolvePassage(state, "2026-10-07");
    expect(next.kind).toBe("book");
    if (next.kind === "book") expect(next.ref).toBe("Isaiah 40:11–31");
  });

  it("moves today’s open passage forward when yesterday takes the waiting drip", () => {
    let state = onboard("2026-10-07");
    state = reducer(state, { type: "answer", today: "2026-10-08", at, answer: "yes" });
    expect(state.days["2026-10-08"]?.passageRef).toBe("Mark 4");
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]?.passageRef).toBe("Mark 4");
    expect(state.days["2026-10-07"]?.readDone).toBe(true);
    expect(state.days["2026-10-08"]?.readDone).toBe(false);
    expect(state.days["2026-10-08"]?.passageRef).toBe("Mark 5");
    expect(state.places.mark.chapter).toBe(5);
  });

  it("marks other recent gaps with the same waiting passage and does not skip a chapter", () => {
    let state = onboard("2026-10-05");
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    state = reducer(state, { type: "markPastRead", date: "2026-10-06", today: "2026-10-08", at });
    state = reducer(state, { type: "markPastRead", date: "2026-10-05", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]?.passageRef).toBe("Mark 4");
    expect(state.days["2026-10-06"]?.passageRef).toBe("Mark 4");
    expect(state.days["2026-10-05"]?.passageRef).toBe("Mark 4");
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 5, verse: 1 });
    expect(currentStreak(state.days, "2026-10-08", state.prefs.planStartDate)).toBe(3);
    expect(powerOfFour(state.days, "2026-10-08").engaged).toBe(3);
  });

  it("keeps a detour from moving the bookmark", () => {
    let state = onboard("2026-10-06");
    state = reducer(state, { type: "answer", today: "2026-10-07", at, answer: "yes" });
    state = reducer(state, { type: "detour", today: "2026-10-07", ref: "Psalm 23" });
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]).toMatchObject({ readDone: true, detour: true, passageRef: "Psalm 23" });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
  });

  it("marks a plan day read without moving the book place", () => {
    let state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      today: "2026-10-06",
      at: "2026-10-06T12:00:00.000Z",
      mode: "plan",
      bookId: "mark",
      dripSize: "chapter",
      startChapter: 4,
      askTime: "06:30",
    });
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]).toMatchObject({
      answer: "yes",
      readDone: true,
      passageRef: "John 3:1–21",
      passageTitle: "New birth",
    });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
    expect(currentStreak(state.days, "2026-10-08", state.prefs.planStartDate)).toBe(1);
  });

  it("leaves rest days, today, older days, and a stop outside the passage alone", () => {
    let state = onboard("2026-10-01");
    state = reducer(state, { type: "answer", today: "2026-10-07", at, answer: "not_today" });
    const rested = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(rested).toBe(state);

    const today = reducer(state, { type: "markPastRead", date: "2026-10-08", today: "2026-10-08", at });
    expect(today).toBe(state);

    const old = reducer(state, { type: "markPastRead", date: "2026-10-01", today: "2026-10-09", at });
    expect(old).toBe(state);

    const invalid = reducer(onboard(), {
      type: "markPastRead",
      date: "2026-10-07",
      today: "2026-10-08",
      at,
      stop: { chapter: 1, verse: 1 },
    });
    expect(invalid.days["2026-10-07"]).toBeUndefined();
    expect(invalid.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
  });

  it("finishes a yes that was never marked read", () => {
    let state = onboard();
    state = reducer(state, { type: "answer", today: "2026-10-07", at: "2026-10-07T12:00:00.000Z", answer: "yes" });
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]?.answeredAt).toBe("2026-10-07T12:00:00.000Z");
    expect(state.days["2026-10-07"]?.readDone).toBe(true);
    expect(state.places.mark.chapter).toBe(5);
  });

  it("keeps a reflection that was saved before the day was marked read", () => {
    let state = onboard();
    state = {
      ...state,
      days: {
        "2026-10-07": {
          date: "2026-10-07",
          answer: "unanswered",
          readDone: false,
          huh: true,
          reflection: "Sat with the sower.",
          detour: false,
        },
      },
    };
    state = reducer(state, { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    expect(state.days["2026-10-07"]).toMatchObject({
      answer: "yes",
      readDone: true,
      huh: true,
      reflection: "Sat with the sower.",
      passageRef: "Mark 4",
    });
  });

  it("round-trips the read day and bookmark through the snapshot document", () => {
    const state = reducer(onboard(), { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at });
    const saved = sanitizeSnapshot(JSON.parse(JSON.stringify(state)) as unknown);
    expect(saved?.days["2026-10-07"]).toMatchObject({ answer: "yes", readDone: true, passageRef: "Mark 4" });
    expect(saved?.places.mark).toEqual({ bookId: "mark", chapter: 5, verse: 1 });
  });
});
