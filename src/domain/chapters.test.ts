import { describe, expect, it } from "vitest";
import { createSnapshot, reducer } from "../state/reducer";
import {
  chapterSections,
  countEarlierCopy,
  defaultCountEarlier,
  evenChapterBlocks,
  pickerMode,
  startAtLabel,
  startPlace,
  startingSubtitle,
} from "./chapters";

const dash = "–";

function bounds(bookId: string): Array<[number, number]> {
  return chapterSections(bookId).map((section) => [section.start, section.end]);
}

describe("chapter picker ranges", () => {
  it("uses one grid at 36 chapters and even blocks above that", () => {
    expect(pickerMode("mark")).toBe("grid");
    expect(pickerMode("numbers")).toBe("grid");
    expect(pickerMode("proverbs")).toBe("grid");
    expect(pickerMode("1-samuel")).toBe("grid");
    expect(chapterSections("numbers")).toHaveLength(1);
    expect(pickerMode("genesis")).toBe("ranges");
    expect(bounds("genesis")).toEqual([
      [1, 25],
      [26, 50],
    ]);
    expect(bounds("exodus")).toEqual([
      [1, 20],
      [21, 40],
    ]);
    expect(bounds("job")).toEqual([
      [1, 21],
      [22, 42],
    ]);
    expect(bounds("isaiah")).toEqual([
      [1, 22],
      [23, 44],
      [45, 66],
    ]);
    expect(chapterSections("isaiah").every((section) => section.sublabel === "22 chapters")).toBe(true);
    expect(bounds("jeremiah")).toEqual([
      [1, 26],
      [27, 52],
    ]);
    expect(bounds("ezekiel")).toEqual([
      [1, 24],
      [25, 48],
    ]);
  });

  it("splits a remainder across the earlier blocks", () => {
    expect(evenChapterBlocks(37).map((section) => [section.start, section.end, section.sublabel])).toEqual([
      [1, 19, "19 chapters"],
      [20, 37, "18 chapters"],
    ]);
  });

  it("splits Psalms into the five books", () => {
    expect(pickerMode("psalms")).toBe("psalms");
    expect(chapterSections("psalms")).toEqual([
      { start: 1, end: 41, label: `1${dash}41`, sublabel: "Book One" },
      { start: 42, end: 72, label: `42${dash}72`, sublabel: "Book Two" },
      { start: 73, end: 89, label: `73${dash}89`, sublabel: "Book Three" },
      { start: 90, end: 106, label: `90${dash}106`, sublabel: "Book Four" },
      { start: 107, end: 150, label: `107${dash}150`, sublabel: "Book Five" },
    ]);
    expect(startingSubtitle("psalms")).toBe("150 psalms in five books.");
    expect(startingSubtitle("isaiah")).toBe("66 chapters");
    expect(startingSubtitle("mark")).toBe("Pick the chapter you’ll start with.");
  });

  it("counts earlier chapters by default, except Psalms", () => {
    expect(defaultCountEarlier("mark")).toBe(true);
    expect(defaultCountEarlier("isaiah")).toBe(true);
    expect(defaultCountEarlier("psalms")).toBe(false);
    expect(countEarlierCopy("mark", 4)?.label).toBe("Count chapters 1–3 as read");
    expect(countEarlierCopy("isaiah", 40)?.label).toBe("Count chapters 1–39 as read");
    expect(countEarlierCopy("psalms", 42)).toMatchObject({
      label: "Count psalms 1–41 as read",
      detail: "Psalms are often read out of order",
    });
    expect(countEarlierCopy("mark", 2)?.label).toBe("Count chapter 1 as read");
    expect(countEarlierCopy("mark", 1)).toBeNull();
    expect(startAtLabel("psalms", 42)).toBe("Start at Psalm 42");
    expect(startAtLabel("mark", 4, 8)).toBe("Start at Mark 4:8");
  });
});

describe("starting bookmark", () => {
  const onboard = {
    today: "2026-10-06",
    at: "2026-10-06T12:00:00.000Z",
    mode: "book" as const,
    dripSize: "chapter" as const,
    askTime: "06:30",
  };

  it("sets the bookmark to chapter n verse 1 and records earlier chapters when asked", () => {
    const counted = reducer(createSnapshot(), {
      type: "completeOnboarding",
      ...onboard,
      bookId: "mark",
      startChapter: 4,
      countEarlier: true,
    });
    expect(counted.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1, countedThrough: 3 });
    expect(counted.prefs.bookId).toBe("mark");

    const psalms = reducer(createSnapshot(), {
      type: "completeOnboarding",
      ...onboard,
      bookId: "psalms",
      startChapter: 42,
      countEarlier: false,
    });
    expect(psalms.places.psalms).toEqual({ bookId: "psalms", chapter: 42, verse: 1, countedThrough: 0 });

    const midChapter = reducer(createSnapshot(), {
      type: "completeOnboarding",
      ...onboard,
      bookId: "mark",
      startChapter: 4,
      startVerse: 8,
      countEarlier: true,
    });
    expect(midChapter.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 8, countedThrough: 3 });
    expect(startPlace("mark", 4, 99, true).verse).toBe(41);
  });

  it("leaves the place shape unchanged when count-earlier is not part of the action", () => {
    const state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      ...onboard,
      bookId: "mark",
      startChapter: 4,
    });
    expect(state.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
  });

  it("keeps the counted chapters when the bookmark advances", () => {
    let state = reducer(createSnapshot(), {
      type: "completeOnboarding",
      ...onboard,
      bookId: "isaiah",
      startChapter: 40,
      countEarlier: true,
    });
    state = reducer(state, { type: "answer", today: "2026-10-06", at: "2026-10-06T12:01:00.000Z", answer: "yes" });
    state = reducer(state, {
      type: "finish",
      today: "2026-10-06",
      at: "2026-10-06T12:20:00.000Z",
    });
    expect(state.places.isaiah).toEqual({ bookId: "isaiah", chapter: 41, verse: 1, countedThrough: 39 });
  });

  it("applies a partway start from settings and from a book change today", () => {
    const settings = reducer(createSnapshot(), {
      type: "reading",
      today: "2026-10-06",
      bookId: "isaiah",
      dripSize: "chapter",
      mode: "book",
      startChapter: 40,
      countEarlier: true,
    });
    expect(settings.prefs.bookId).toBe("isaiah");
    expect(settings.places.isaiah).toEqual({ bookId: "isaiah", chapter: 40, verse: 1, countedThrough: 39 });

    const today = reducer(createSnapshot(), {
      type: "queueBook",
      bookId: "ezekiel",
      when: "today",
      today: "2026-10-06",
      tomorrow: "2026-10-06",
      startChapter: 25,
      countEarlier: true,
    });
    expect(today.places.ezekiel).toEqual({ bookId: "ezekiel", chapter: 25, verse: 1, countedThrough: 24 });
  });
});
