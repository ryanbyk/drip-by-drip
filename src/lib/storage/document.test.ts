import { describe, expect, it } from "vitest";
import { createSnapshot } from "../../state/reducer";
import { notesFrom, sanitizeSnapshot, withCommitment, withNote, withPlace, withPrefs } from "./document";

describe("snapshot document", () => {
  it("rejects a payload that is not a v1 snapshot", () => {
    expect(sanitizeSnapshot(null)).toBeNull();
    expect(sanitizeSnapshot({ version: 2, prefs: {}, places: {}, days: {} })).toBeNull();
  });

  it("fills missing preference fields from the default snapshot", () => {
    const clean = sanitizeSnapshot({
      version: 1,
      updatedAt: 4,
      prefs: { askTime: "07:15" },
      places: {},
      days: {},
    });
    expect(clean?.prefs.askTime).toBe("07:15");
    expect(clean?.prefs.bookId).toBe("mark");
    expect(clean?.updatedAt).toBe(4);
  });

  it("updates prefs, a day, a place, and a note on the snapshot", () => {
    const start = createSnapshot();
    const prefs = withPrefs(start, { ...start.prefs, askTime: "08:00" });
    expect(prefs.prefs.askTime).toBe("08:00");

    const day = withCommitment(prefs, {
      date: "2026-10-06",
      answer: "yes",
      readDone: true,
      huh: false,
      detour: false,
    });
    const place = withPlace(day, { bookId: "mark", chapter: 2, verse: 1 });
    const noted = withNote(place, { date: "2026-10-06", reflection: "The soil", huh: true });

    expect(noted.places.mark).toEqual({ bookId: "mark", chapter: 2, verse: 1 });
    expect(noted.days["2026-10-06"]?.reflection).toBe("The soil");
    expect(noted.days["2026-10-06"]?.answer).toBe("yes");
    expect(notesFrom(noted)).toEqual([{ date: "2026-10-06", reflection: "The soil", huh: true }]);
  });
});
