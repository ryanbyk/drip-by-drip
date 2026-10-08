import { describe, expect, it } from "vitest";
import { sanitizeSnapshot } from "../lib/storage/document";
import { createSnapshot, reducer } from "../state/reducer";
import { dripFromPlace } from "./drip";
import { startOfWeek } from "./dates";
import { currentStreak } from "./streaks";
import type { DailyCommitment, Snapshot } from "./types";
import {
  defaultSwitchStart,
  resolveSwitchPlace,
  switchConfirmCopy,
  switchTiming,
  switchTimingNote,
} from "./switchBook";

const today = "2026-10-08";
const tomorrow = "2026-10-09";

function day(date: string, partial: Partial<DailyCommitment> = {}): DailyCommitment {
  return {
    date,
    answer: "yes",
    readDone: false,
    huh: false,
    detour: false,
    ...partial,
  };
}

function readingMark(): Snapshot {
  let state = reducer(createSnapshot(), {
    type: "completeOnboarding",
    today,
    at: "2026-10-08T12:00:00.000Z",
    mode: "book",
    bookId: "mark",
    dripSize: "chapter",
    startChapter: 4,
    askTime: "06:30",
  });
  state = reducer(state, { type: "answer", today, at: "2026-10-08T12:01:00.000Z", answer: "yes" });
  return {
    ...state,
    places: {
      ...state.places,
      james: { bookId: "james", chapter: 3, verse: 8, countedThrough: 2 },
    },
    days: {
      ...state.days,
      "2026-10-07": day("2026-10-07", { readDone: true, readDoneAt: "2026-10-07T12:20:00.000Z", passageRef: "Mark 3" }),
    },
  };
}

function switchToJames(state: Snapshot, startChapter = 3, startVerse = 8, countEarlier?: boolean) {
  return reducer(state, {
    type: "switchBook",
    bookId: "james",
    today,
    tomorrow,
    startChapter,
    startVerse,
    ...(countEarlier !== undefined ? { countEarlier } : {}),
    dripSize: "chapter",
  });
}

describe("switch book", () => {
  it("defaults to a saved place and otherwise chapter 1", () => {
    const places = { james: { bookId: "james", chapter: 3, verse: 8 } };
    expect(defaultSwitchStart(places, "james")).toEqual({ chapter: 3, verse: 8 });
    expect(defaultSwitchStart(places, "mark")).toEqual({ chapter: 1, verse: 1 });
    expect(defaultSwitchStart({ mark: { bookId: "mark", chapter: 20, verse: 1 } }, "mark")).toEqual({
      chapter: 1,
      verse: 1,
    });
  });

  it("asks before leaving the current book and says that place is saved", () => {
    expect(switchConfirmCopy("Mark", "James")).toBe(
      "Switch from Mark to James? Your place in Mark is saved, so you can come back to it.",
    );
  });

  it("switches today’s drip now and keeps the old place, history, and streak", () => {
    const state = readingMark();
    const streak = currentStreak(state.days, today, state.prefs.planStartDate);
    const next = switchToJames(state);

    expect(next.prefs.bookId).toBe("james");
    expect(next.prefs.readingMode).toBe("book");
    expect(next.prefs.planId).toBe(state.prefs.planId);
    expect(next.prefs.queuedBookId).toBe("");
    expect(next.places.mark).toEqual(state.places.mark);
    expect(next.places.james).toEqual(state.places.james);
    expect(next.days["2026-10-07"]).toEqual(state.days["2026-10-07"]);
    expect(next.days[today]?.readDone).toBe(false);
    expect(next.days[today]?.range).toEqual(dripFromPlace({ bookId: "james", chapter: 3, verse: 8 }, "chapter"));
    expect(currentStreak(next.days, today, next.prefs.planStartDate)).toBe(streak);
    expect(next.updatedAt).toBeGreaterThan(0);
  });

  it("keeps a saved verse when the chosen chapter matches, and replaces it when the chapter changes", () => {
    const state = readingMark();
    expect(resolveSwitchPlace(state.places, "james", 3, 8)).toEqual(state.places.james);
    expect(resolveSwitchPlace(state.places, "james", 3, 8, true)).toEqual(state.places.james);

    const restarted = switchToJames(state, 1, 1);
    expect(restarted.places.james).toEqual({ bookId: "james", chapter: 1, verse: 1 });
    expect(restarted.places.mark).toEqual(state.places.mark);
  });

  it("queues the new book for tomorrow when today’s reading is already done", () => {
    let state = readingMark();
    state = reducer(state, { type: "finish", today, at: "2026-10-08T12:30:00.000Z" });
    const finishedToday = state.days[today];
    const next = switchToJames(state);

    expect(switchTiming(state, today, "james")).toBe("tomorrow");
    expect(next.prefs.bookId).toBe("mark");
    expect(next.prefs.queuedBookId).toBe("james");
    expect(next.prefs.queuedBookDate).toBe(tomorrow);
    expect(next.prefs.queuedChapter).toBe(3);
    expect(next.places.james).toEqual({ bookId: "james", chapter: 3, verse: 8, countedThrough: 2 });
    expect(next.places.mark).toEqual(state.places.mark);
    expect(next.days[today]).toEqual(finishedToday);
    expect(next.days["2026-10-07"]).toEqual(state.days["2026-10-07"]);
    expect(switchTimingNote({ timing: "tomorrow", detail: "James 3", plan: false, sameBook: false, todayDone: true })).toBe(
      "James 3 starts tomorrow. Today’s reading is already done.",
    );
  });

  it("applies a queued switch on the next day without resetting the chapter or the old book", () => {
    let state = readingMark();
    state = reducer(state, { type: "finish", today, at: "2026-10-08T12:30:00.000Z" });
    state = switchToJames(state);
    const applied = reducer(state, { type: "applyQueue", today: tomorrow });

    expect(applied.prefs.bookId).toBe("james");
    expect(applied.prefs.readingMode).toBe("book");
    expect(applied.prefs.queuedBookId).toBe("");
    expect(applied.prefs.queuedChapter).toBe(0);
    expect(applied.places.james).toEqual({ bookId: "james", chapter: 3, verse: 8, countedThrough: 2 });
    expect(applied.places.mark).toEqual(state.places.mark);
    expect(applied.days[today]).toEqual(state.days[today]);
  });

  it("updates the current book’s chapter without queueing or rewriting a finished day", () => {
    let state = readingMark();
    state = reducer(state, { type: "finish", today, at: "2026-10-08T12:30:00.000Z" });
    const finished = state.days[today];
    const next = reducer(state, {
      type: "switchBook",
      bookId: "mark",
      today,
      tomorrow,
      startChapter: 8,
      startVerse: 1,
    });
    expect(next.prefs.bookId).toBe("mark");
    expect(next.prefs.queuedBookId).toBe("");
    expect(next.places.mark).toEqual({ bookId: "mark", chapter: 8, verse: 1 });
    expect(next.places.james).toEqual(state.places.james);
    expect(next.days[today]).toEqual(finished);
    expect(next.days["2026-10-07"]).toEqual(state.days["2026-10-07"]);
  });

  it("still starts a plain queued book at chapter 1", () => {
    let state = readingMark();
    state = {
      ...state,
      places: { ...state.places, john: { bookId: "john", chapter: 5, verse: 2 } },
    };
    state = reducer(state, {
      type: "queueBook",
      bookId: "john",
      when: "tomorrow",
      today,
      tomorrow,
    });
    expect(state.places.john).toEqual({ bookId: "john", chapter: 5, verse: 2 });
    expect(state.prefs.queuedChapter).toBe(0);

    const applied = reducer(state, { type: "applyQueue", today: tomorrow });
    expect(applied.prefs.bookId).toBe("john");
    expect(applied.places.john).toEqual({ bookId: "john", chapter: 1, verse: 1 });
    expect(applied.places.mark.chapter).toBe(4);
  });

  it("changes the personal book and leaves a plan’s passage alone", () => {
    const state = readingMark();
    const onPlan: Snapshot = {
      ...state,
      prefs: { ...state.prefs, readingMode: "plan", planId: "placeholder", planStartDate: "2026-10-05" },
      days: {
        ...state.days,
        [today]: day(today, { passageRef: "Psalm 23", passageTitle: "The Lord is my shepherd", dayIndex: 4 }),
      },
    };
    const next = switchToJames(onPlan);

    expect(switchTiming(onPlan, today, "james")).toBe("now");
    expect(next.prefs.bookId).toBe("james");
    expect(next.prefs.readingMode).toBe("plan");
    expect(next.prefs.planId).toBe("placeholder");
    expect(next.prefs.planStartDate).toBe("2026-10-05");
    expect(next.days[today]).toEqual(onPlan.days[today]);
    expect(next.places.mark).toEqual(onPlan.places.mark);
    expect(next.prefs.queuedBookId).toBe("");
    expect(
      switchTimingNote({ timing: "now", detail: "James 3:8", plan: true, sameBook: false, todayDone: false }),
    ).toBe("This changes your book to James 3:8. The plan stays as it is.");
  });

  it("leaves a finished Sunday in place when the new book waits until Monday", () => {
    const sunday = "2026-10-04";
    const monday = "2026-10-05";
    let state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      today: sunday,
      at: "2026-10-04T12:00:00.000Z",
      mode: "book",
      bookId: "mark",
      dripSize: "chapter",
      startChapter: 1,
      askTime: "06:30",
    });
    state = reducer(state, { type: "answer", today: sunday, at: "2026-10-04T12:01:00.000Z", answer: "yes" });
    state = reducer(state, { type: "finish", today: sunday, at: "2026-10-04T12:20:00.000Z" });
    const next = reducer(state, {
      type: "switchBook",
      bookId: "james",
      today: sunday,
      tomorrow: monday,
      startChapter: 3,
      startVerse: 1,
    });

    expect(startOfWeek(sunday)).toBe(sunday);
    expect(startOfWeek(monday)).toBe(sunday);
    expect(next.days[sunday]).toEqual(state.days[sunday]);
    expect(next.prefs.bookId).toBe("mark");
    expect(next.prefs.queuedBookDate).toBe(monday);
    expect(next.places.james).toEqual({ bookId: "james", chapter: 3, verse: 1 });
  });

  it("ignores an unknown book and round-trips the change through the snapshot document", () => {
    const state = readingMark();
    const ignored = reducer(state, {
      type: "switchBook",
      bookId: "not-a-book",
      today,
      tomorrow,
      startChapter: 1,
    });
    expect(ignored).toBe(state);

    const next = switchToJames({ ...state, updatedAt: 1 });
    expect(next.updatedAt).toBeGreaterThan(1);
    const stored = sanitizeSnapshot(JSON.parse(JSON.stringify(next)) as unknown);
    expect(stored?.prefs.bookId).toBe("james");
    expect(stored?.places.mark).toEqual(next.places.mark);
    expect(stored?.places.james).toEqual(next.places.james);
    expect(stored?.days[today]?.range?.bookId).toBe("james");

    const legacy = sanitizeSnapshot({
      version: 1,
      updatedAt: 1,
      prefs: { queuedBookId: "john", queuedBookDate: tomorrow },
      places: {},
      days: {},
    });
    expect(legacy?.prefs.queuedChapter).toBe(0);
  });
});
