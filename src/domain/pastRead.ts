import { diffDays } from "./dates";
import { dripFromPlace } from "./drip";
import { formatRef, parsePassage } from "./refs";
import { activePlace, lockPassage } from "./resolve";
import { markForDate } from "./streaks";
import type { DailyCommitment, Range, Snapshot } from "./types";

/** Recent History days that can still be marked read. The recent list is today plus this many. */
export const RECENT_PAST_DAYS = 7;

export type PastReadDraft = {
  date: string;
  /** Passage filled in. `readDone` stays false until the edit is saved. */
  day: DailyCommitment;
  range?: Range;
  /**
   * The book-track bookmark still sits at the start of this drip,
   * so finishing it moves the next suggestion forward.
   */
  advance: boolean;
};

export function describePastRead(state: Snapshot, date: string, today: string): PastReadDraft | null {
  if (!canMarkPastRead(state, date, today)) return null;
  const existing = state.days[date];
  const base = baseDay(date, existing);

  if (existing?.detour) {
    return { date, day: { ...base, detour: true }, advance: false };
  }

  if (state.prefs.readingMode === "plan") {
    return {
      date,
      day: lockPassage(state, date, { ...base, detour: false, range: undefined, savedRange: undefined }),
      advance: false,
    };
  }

  const owned = existing?.range;
  if (owned) {
    return {
      date,
      day: {
        ...base,
        detour: false,
        range: owned,
        passageRef: existing.passageRef ?? formatRef(owned),
      },
      range: owned,
      advance: canAdvance(state, owned),
    };
  }

  if (existing?.passageRef) {
    const parsed = parsePassage(existing.passageRef);
    if (!parsed || parsed.bookId !== state.prefs.bookId) {
      return { date, day: { ...base, detour: false }, advance: false };
    }
    return withRange(state, date, base, parsed, existing.passageRef);
  }

  // The bookmark only moves when a drip is finished, so a gap before a later
  // read was still that same passage. Recording it again must not skip ahead.
  const later = earliestLaterRead(state, date, state.prefs.bookId);
  if (later?.range) {
    return {
      date,
      day: {
        ...base,
        detour: false,
        range: later.range,
        passageRef: later.passageRef ?? formatRef(later.range),
        passageTitle: later.passageTitle,
        prompt: undefined,
        savedRange: undefined,
      },
      range: later.range,
      advance: canAdvance(state, later.range),
    };
  }

  const live = dripFromPlace(activePlace(state), state.prefs.dripSize);
  if (!live) return { date, day: { ...base, detour: false }, advance: false };
  return withRange(state, date, base, live);
}

function canMarkPastRead(state: Snapshot, date: string, today: string): boolean {
  const start = state.prefs.planStartDate;
  if (!start || date < start || date >= today) return false;
  const age = diffDays(date, today);
  if (age < 1 || age > RECENT_PAST_DAYS) return false;
  const mark = markForDate(date, today, start, state.days[date]);
  return mark === "unanswered" || mark === "yes";
}

function baseDay(date: string, existing: DailyCommitment | undefined): DailyCommitment {
  if (existing) return { ...existing, date, answer: "yes" };
  return { date, answer: "yes", readDone: false, huh: false, detour: false };
}

function canAdvance(state: Snapshot, range: Range): boolean {
  if (state.prefs.readingMode !== "book") return false;
  const place = state.places[range.bookId] ?? { bookId: range.bookId, chapter: 1, verse: 1 };
  return place.chapter === range.startChapter && place.verse === range.startVerse;
}

function earliestLaterRead(state: Snapshot, date: string, bookId: string): DailyCommitment | undefined {
  const dates = Object.keys(state.days)
    .filter((iso) => iso > date)
    .sort();
  for (const iso of dates) {
    const day = state.days[iso];
    if (!day?.readDone || day.answer !== "yes" || day.detour || day.range?.bookId !== bookId) continue;
    return day;
  }
  return undefined;
}

function withRange(
  state: Snapshot,
  date: string,
  base: DailyCommitment,
  range: Range,
  passageRef?: string,
): PastReadDraft {
  const locked = lockPassage(state, date, {
    ...base,
    detour: false,
    range: undefined,
    passageRef: undefined,
    passageTitle: undefined,
    prompt: undefined,
    savedRange: undefined,
  });
  const day =
    locked.range && sameRange(locked.range, range)
      ? locked
      : {
          ...base,
          detour: false,
          range,
          passageRef: passageRef ?? formatRef(range),
          passageTitle: undefined,
          prompt: undefined,
          savedRange: undefined,
        };
  return { date, day, range, advance: canAdvance(state, range) };
}

function sameRange(left: Range, right: Range): boolean {
  return (
    left.bookId === right.bookId &&
    left.startChapter === right.startChapter &&
    left.startVerse === right.startVerse &&
    left.endChapter === right.endChapter &&
    left.endVerse === right.endVerse
  );
}
