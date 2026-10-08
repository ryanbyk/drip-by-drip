import { chapterCount, verseCount } from "./books";
import { startPlace } from "./chapters";
import { clampStartChapter } from "./drip";
import type { Place, Snapshot } from "./types";

export type SwitchTiming = "now" | "tomorrow";

/** A book with a place inside its chapters resumes there. Anything else starts at chapter 1. */
export function defaultSwitchStart(
  places: Record<string, Place>,
  bookId: string,
): { chapter: number; verse: number } {
  const saved = places[bookId];
  const total = chapterCount(bookId);
  if (!saved || saved.chapter < 1 || saved.chapter > total) return { chapter: 1, verse: 1 };
  const maxVerse = verseCount(bookId, saved.chapter);
  if (saved.verse < 1 || saved.verse > maxVerse) return { chapter: saved.chapter, verse: 1 };
  return { chapter: saved.chapter, verse: saved.verse };
}

function earlierMatches(saved: Place, chapter: number, countEarlier: boolean | undefined): boolean {
  if (countEarlier === undefined) return true;
  const expected = countEarlier ? Math.max(0, chapter - 1) : 0;
  if (saved.countedThrough === undefined) return expected === 0;
  return saved.countedThrough === expected;
}

/** Keep a saved place when the chosen chapter still matches it. */
export function resolveSwitchPlace(
  places: Record<string, Place>,
  bookId: string,
  startChapter: number,
  startVerse?: number,
  countEarlier?: boolean,
): Place {
  const saved = places[bookId];
  const chapter = clampStartChapter(bookId, startChapter);
  const requested = startVerse ?? (saved && saved.chapter === chapter ? saved.verse : 1);
  const maxVerse = verseCount(bookId, chapter);
  const verse = maxVerse === 0 ? 1 : Math.min(Math.max(1, Math.floor(requested) || 1), maxVerse);
  if (saved && saved.chapter === chapter && saved.verse === verse && earlierMatches(saved, chapter, countEarlier)) {
    return saved;
  }
  return startPlace(bookId, chapter, verse, countEarlier);
}

/**
 * Today's unfinished drip changes now.
 * A finished book-mode day waits until tomorrow so that reading stays put.
 * A plan stays on its own passage; only the personal book changes, and it changes now.
 */
export function switchTiming(state: Snapshot, today: string, nextBookId: string): SwitchTiming {
  if (state.prefs.readingMode === "plan") return "now";
  if (nextBookId === state.prefs.bookId) return "now";
  if (state.days[today]?.readDone) return "tomorrow";
  return "now";
}

export function switchConfirmCopy(fromName: string, toName: string): string {
  return `Switch from ${fromName} to ${toName}? Your place in ${fromName} is saved, so you can come back to it.`;
}

export function switchTargetLabel(bookName: string, chapter: number, verse: number): string {
  if (verse > 1) return `${bookName} ${chapter}:${verse}`;
  return `${bookName} ${chapter}`;
}

export function switchTimingNote(input: {
  timing: SwitchTiming;
  detail: string;
  plan: boolean;
  sameBook: boolean;
  todayDone: boolean;
}): string {
  if (input.plan) return `This changes your book to ${input.detail}. The plan stays as it is.`;
  if (input.timing === "tomorrow") {
    return `${input.detail} starts tomorrow. Today’s reading is already done.`;
  }
  if (input.todayDone && input.sameBook) {
    return "Tomorrow picks up there. Today’s reading stays as it is.";
  }
  if (input.sameBook) return "Today’s drip uses this chapter.";
  return `Today’s drip switches to ${input.detail}.`;
}
