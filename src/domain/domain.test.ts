import { describe, expect, it } from "vitest";
import { BOOKS, totalVerses, verseCount } from "./books";
import { addDays } from "./dates";
import { dripFromPlace, placeAfter } from "./drip";
import { formatRef, parsePassage } from "./refs";
import { resolvePassage } from "./resolve";
import { currentStreak, longestStreak, markForDate, powerOfFour } from "./streaks";
import type { DailyCommitment, Snapshot } from "./types";
import { createSnapshot, reducer } from "../state/reducer";

function day(partial: Partial<DailyCommitment> & { date: string }): DailyCommitment {
  return {
    answer: "yes",
    readDone: false,
    huh: false,
    detour: false,
    ...partial,
  };
}

describe("books", () => {
  it("covers the Protestant canon without storing verse text", () => {
    expect(BOOKS).toHaveLength(66);
    const total = BOOKS.reduce((sum, book) => sum + totalVerses(book.id), 0);
    expect(total).toBe(31102);
    expect(verseCount("mark", 4)).toBe(41);
    expect(verseCount("psalms", 119)).toBe(176);
    expect(verseCount("3-john", 1)).toBe(14);
  });
});

describe("drips", () => {
  it("offers a chapter, a short span, or two chapters from the bookmark", () => {
    const place = { bookId: "mark", chapter: 4, verse: 1 };
    expect(formatRef(dripFromPlace(place, "chapter")!)).toBe("Mark 4");
    expect(formatRef(dripFromPlace(place, "verses")!)).toBe("Mark 4:1–12");
    expect(formatRef(dripFromPlace(place, "two")!)).toBe("Mark 4–5");
    expect(formatRef(dripFromPlace({ bookId: "mark", chapter: 4, verse: 21 }, "chapter")!)).toBe("Mark 4:21–41");
  });

  it("advances the bookmark to the next unread verse", () => {
    expect(placeAfter("mark", 4, 20)).toEqual({ bookId: "mark", chapter: 4, verse: 21 });
    expect(placeAfter("mark", 4, 41)).toEqual({ bookId: "mark", chapter: 5, verse: 1 });
    expect(placeAfter("mark", 16, 20).chapter).toBe(17);
  });
});

describe("references", () => {
  it("parses a single passage and leaves multi-refs alone", () => {
    expect(parsePassage("Mark 4:1–20")).toMatchObject({
      bookId: "mark",
      startChapter: 4,
      startVerse: 1,
      endChapter: 4,
      endVerse: 20,
    });
    expect(parsePassage("Psalm 23")?.bookId).toBe("psalms");
    expect(parsePassage("1 John 1:1-4")?.bookId).toBe("1-john");
    expect(parsePassage("Jude")).toMatchObject({ startChapter: 1, endVerse: 25 });
    expect(parsePassage("Luke 10:38–42; Psalm 46")).toBeNull();
  });
});

describe("streaks", () => {
  const start = "2026-10-05";
  const today = "2026-10-08";

  it("counts engaged days and keeps Not today from shaming the longest run", () => {
    const days = {
      "2026-10-05": day({ date: "2026-10-05", readDone: true }),
      "2026-10-06": day({ date: "2026-10-06", readDone: true }),
      "2026-10-07": day({ date: "2026-10-07", answer: "not_today" }),
      "2026-10-08": day({ date: "2026-10-08", readDone: true }),
    };
    expect(currentStreak(days, today, start)).toBe(1);
    expect(longestStreak(days, today, start)).toBe(2);
    expect(markForDate("2026-10-07", today, start, days["2026-10-07"])).toBe("not_today");
    expect(markForDate("2026-10-04", today, start, undefined)).toBe("before");
  });

  it("does not break today’s streak before the day ends unanswered", () => {
    const days = {
      "2026-10-06": day({ date: "2026-10-06", readDone: true }),
      "2026-10-07": day({ date: "2026-10-07", readDone: true }),
    };
    expect(currentStreak(days, "2026-10-08", start)).toBe(2);
    expect(powerOfFour(days, "2026-10-08").engaged).toBe(2);
  });

  it("breaks a past day that was Yes without a finished read", () => {
    const days = {
      "2026-10-05": day({ date: "2026-10-05", readDone: true }),
      "2026-10-06": day({ date: "2026-10-06", readDone: false }),
      "2026-10-07": day({ date: "2026-10-07", readDone: true }),
    };
    expect(currentStreak(days, "2026-10-07", start)).toBe(1);
    expect(longestStreak(days, "2026-10-07", start)).toBe(1);
  });
});

describe("daily spine", () => {
  it("persists Yes, keeps a detour from moving the bookmark, and survives a reset of history", () => {
    let state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      today: "2026-10-06",
      at: "2026-10-06T12:00:00.000Z",
      mode: "book",
      bookId: "mark",
      dripSize: "chapter",
      startChapter: 4,
      askTime: "06:30",
    });
    state = reducer(state, { type: "answer", today: "2026-10-06", at: "2026-10-06T12:01:00.000Z", answer: "yes" });
    expect(state.days["2026-10-06"]?.answer).toBe("yes");
    expect(state.days["2026-10-06"]?.passageRef).toBe("Mark 4");
    expect(resolvePassage(state, "2026-10-06").kind).toBe("book");

    state = reducer(state, { type: "detour", today: "2026-10-06", ref: "Psalm 23" });
    state = reducer(state, { type: "finish", today: "2026-10-06", at: "2026-10-06T12:30:00.000Z" });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
    expect(state.days["2026-10-06"]?.readDone).toBe(true);

    state = reducer(state, { type: "answer", today: "2026-10-07", at: "2026-10-07T12:00:00.000Z", answer: "not_today" });
    expect(state.days["2026-10-07"]?.answer).toBe("not_today");
    expect(state.days["2026-10-07"]?.readDone).toBe(false);

    const reset = reducer(state, { type: "reset", today: "2026-10-08" });
    expect(reset.days).toEqual({});
    expect(reset.places.mark.chapter).toBe(1);
    expect(reset.prefs.askTime).toBe("06:30");
    expect(reset.prefs.onboardingComplete).toBe(true);
  });

  it("moves the bookmark only as far as the reader stopped", () => {
    let state = onboarded();
    state = reducer(state, { type: "answer", today: "2026-10-06", at: "2026-10-06T12:00:00.000Z", answer: "yes" });
    state = reducer(state, {
      type: "finish",
      today: "2026-10-06",
      at: "2026-10-06T12:20:00.000Z",
      stop: { chapter: 4, verse: 20 },
    });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 21 });
    const next = resolvePassage(state, "2026-10-07");
    expect(next.kind).toBe("book");
    if (next.kind === "book") expect(next.ref).toBe("Mark 4:21–41");
  });
});

function onboarded(): Snapshot {
  return reducer(createSnapshot(), {
    type: "completeOnboarding",
    today: "2026-10-06",
    at: "2026-10-06T12:00:00.000Z",
    mode: "book",
    bookId: "mark",
    dripSize: "chapter",
    startChapter: 4,
    askTime: "06:30",
  });
}

describe("dates", () => {
  it("steps local calendar days", () => {
    expect(addDays("2026-10-06", 1)).toBe("2026-10-07");
  });
});
