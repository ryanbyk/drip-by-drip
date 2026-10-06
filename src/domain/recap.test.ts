import { describe, expect, it } from "vitest";
import { createSnapshot } from "../state/reducer";
import { bookRecap } from "./recap";
import type { DailyCommitment } from "./types";

function day(partial: Partial<DailyCommitment> & Pick<DailyCommitment, "date">): DailyCommitment {
  return {
    answer: "yes",
    readDone: false,
    huh: false,
    detour: false,
    ...partial,
  };
}

describe("book recap", () => {
  it("colors a chapter read twice as two sittings and keeps the look-back grace-sized", () => {
    const snapshot = createSnapshot();
    snapshot.prefs.planStartDate = "2026-10-01";
    snapshot.prefs.bookId = "philemon";
    snapshot.days = {
      "2026-10-01": day({
        date: "2026-10-01",
        readDone: true,
        readDoneAt: "2026-10-01T11:40:00.000Z",
        range: { bookId: "philemon", startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 25 },
        passageRef: "Philemon 1",
        reflection: "A short letter",
        verseTags: ["1:7"],
      }),
      "2026-10-02": day({
        date: "2026-10-02",
        readDone: true,
        readDoneAt: "2026-10-02T11:50:00.000Z",
        range: { bookId: "philemon", startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 25 },
        passageRef: "Philemon 1",
        verseTags: ["1:7"],
      }),
      "2026-10-03": day({
        date: "2026-10-03",
        answer: "not_today",
      }),
      "2026-10-04": day({
        date: "2026-10-04",
        readDone: true,
        detour: true,
        passageRef: "Psalm 23",
        huh: true,
      }),
    };

    const recap = bookRecap(snapshot, "2026-10-04");
    expect(recap.sittings).toEqual(["two"]);
    expect(recap.readingDays).toBe(2);
    expect(recap.restDays).toBe(1);
    expect(recap.reflections).toBe(1);
    expect(recap.topVerse).toBe("1:7");
    expect(recap.detourRefs).toEqual(["Psalm 23"]);
    expect(recap.huhRefs).toEqual(["Psalm 23"]);
    expect(recap.chapters).toBe(1);
    expect(recap.powerWeeks).toEqual({ hit: 0, total: 1 });
  });

  it("counts a Sunday–Saturday run as one Power of Four week", () => {
    const snapshot = createSnapshot();
    snapshot.prefs.planStartDate = "2026-10-04";
    snapshot.prefs.bookId = "philemon";
    const range = { bookId: "philemon", startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 25 };
    const read = (date: string): DailyCommitment =>
      day({ date, readDone: true, range, passageRef: "Philemon 1" });
    snapshot.days = {
      "2026-10-04": read("2026-10-04"),
      "2026-10-05": read("2026-10-05"),
      "2026-10-06": read("2026-10-06"),
      "2026-10-07": read("2026-10-07"),
      "2026-10-10": read("2026-10-10"),
    };

    expect(bookRecap(snapshot, "2026-10-10").powerWeeks).toEqual({ hit: 1, total: 1 });

    snapshot.days["2026-10-11"] = read("2026-10-11");
    expect(bookRecap(snapshot, "2026-10-11").powerWeeks).toEqual({ hit: 1, total: 2 });
  });

  it("counts earlier chapters as one sitting and leaves the rest unread", () => {
    const snapshot = createSnapshot();
    snapshot.prefs.bookId = "isaiah";
    snapshot.places = {
      isaiah: { bookId: "isaiah", chapter: 40, verse: 1, countedThrough: 39 },
    };

    const recap = bookRecap(snapshot, "2026-10-06");
    expect(recap.sittings[0]).toBe("one");
    expect(recap.sittings[38]).toBe("one");
    expect(recap.sittings[39]).toBe("unread");
    expect(recap.sittings[65]).toBe("unread");
  });

  it("does not count earlier psalms when that choice is off", () => {
    const snapshot = createSnapshot();
    snapshot.prefs.bookId = "psalms";
    snapshot.places = {
      psalms: { bookId: "psalms", chapter: 42, verse: 1, countedThrough: 0 },
    };

    const recap = bookRecap(snapshot, "2026-10-06");
    expect(recap.sittings.every((sitting) => sitting === "unread")).toBe(true);
  });
});
