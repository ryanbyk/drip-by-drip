import { chapterHint } from "../data/chapterHints";
import { PLAN_LENGTH, planDay } from "../data/placeholderPlan";
import { getBook } from "./books";
import { diffDays } from "./dates";
import { dripFromPlace, isPlaceFinished } from "./drip";
import { followView, planTitle } from "./groupPlan";
import { chapterProgressLabel, formatRef, formatVerseSpan } from "./refs";
import type { Place, Range, Snapshot } from "./types";

export type ResolvedPassage =
  | {
      kind: "book";
      ref: string;
      hint?: string;
      range: Range;
      chapterLabel: string;
      verseLabel: string;
    }
  | {
      kind: "plan";
      ref: string;
      title?: string;
      prompt?: string;
      dayIndex: number;
      planLength: number;
      backupLabel: string;
      custom: boolean;
    }
  | {
      kind: "detour";
      ref: string;
      backupLabel: string;
    }
  | { kind: "finished"; bookId: string }
  | { kind: "plan-finished"; backupLabel: string };

export function activePlace(state: Snapshot): Place {
  return state.places[state.prefs.bookId] ?? { bookId: state.prefs.bookId, chapter: 1, verse: 1 };
}

export function backupLabel(state: Snapshot): string {
  const place = state.places[state.prefs.bookId] ?? {
    bookId: state.prefs.bookId,
    chapter: 1,
    verse: 1,
  };
  const name = getBook(state.prefs.bookId)?.name ?? "your book";
  if (isPlaceFinished(place)) return `You finished ${name}. It can wait while you choose what’s next.`;
  if (place.verse <= 1) return `Your place in ${name} (ch. ${place.chapter}) stays saved.`;
  return `Your place in ${name} (${place.chapter}:${place.verse}) stays saved for tomorrow.`;
}

function fromRange(range: Range): Extract<ResolvedPassage, { kind: "book" }> {
  const hint =
    range.startChapter === range.endChapter ? chapterHint(range.bookId, range.startChapter) : undefined;
  return {
    kind: "book",
    ref: formatRef(range),
    ...(hint ? { hint } : {}),
    range,
    chapterLabel: chapterProgressLabel(range),
    verseLabel: formatVerseSpan(range),
  };
}

export function livePassage(state: Snapshot, today: string): ResolvedPassage {
  const followed = state.prefs.groupPlan;
  if (followed) {
    const view = followView(followed, today);
    if (view.status === "reading" && view.today) {
      return {
        kind: "plan",
        ref: formatRef(view.today.range),
        title: planTitle(followed),
        dayIndex: view.today.index,
        planLength: view.total,
        backupLabel: backupLabel(state),
        custom: false,
      };
    }
  }
  if (state.prefs.readingMode === "plan" && !followed) {
    if (!state.prefs.planStartDate) {
      return { kind: "plan-finished", backupLabel: backupLabel(state) };
    }
    const dayIndex = diffDays(state.prefs.planStartDate, today) + 1;
    const day = planDay(dayIndex);
    if (!day) return { kind: "plan-finished", backupLabel: backupLabel(state) };
    return {
      kind: "plan",
      ref: day.passageRef,
      title: day.title,
      prompt: day.prompt,
      dayIndex,
      planLength: PLAN_LENGTH,
      backupLabel: backupLabel(state),
      custom: false,
    };
  }
  const place = activePlace(state);
  if (isPlaceFinished(place)) return { kind: "finished", bookId: place.bookId };
  const range = dripFromPlace(place, state.prefs.dripSize);
  if (!range) return { kind: "finished", bookId: place.bookId };
  return fromRange(range);
}

export function resolvePassage(state: Snapshot, today: string): ResolvedPassage {
  const day = state.days[today];
  if (day?.detour && day.passageRef) {
    return { kind: "detour", ref: day.passageRef, backupLabel: backupLabel(state) };
  }
  if (day?.range && state.prefs.readingMode === "book" && !day.detour) {
    return fromRange(day.range);
  }
  if (day?.passageRef && state.prefs.readingMode === "plan" && !state.prefs.groupPlan && day.answer === "yes" && !day.detour) {
    const live = livePassage(state, today);
    const same = live.kind === "plan" && live.ref === day.passageRef;
    return {
      kind: "plan",
      ref: day.passageRef,
      ...(day.passageTitle ? { title: day.passageTitle } : {}),
      ...(same && day.prompt ? { prompt: day.prompt } : {}),
      dayIndex: day.dayIndex ?? (live.kind === "plan" ? live.dayIndex : 0),
      planLength: PLAN_LENGTH,
      backupLabel: backupLabel(state),
      custom: !same,
    };
  }
  return livePassage(state, today);
}

export function lockPassage(state: Snapshot, today: string, day: Snapshot["days"][string]): Snapshot["days"][string] {
  const live = livePassage(state, today);
  if (live.kind === "book") {
    return {
      ...day,
      detour: false,
      range: live.range,
      passageRef: live.ref,
      passageTitle: live.hint,
      prompt: undefined,
      savedRange: undefined,
    };
  }
  if (live.kind === "plan") {
    return {
      ...day,
      detour: false,
      range: undefined,
      savedRange: undefined,
      passageRef: live.ref,
      passageTitle: live.title,
      prompt: live.prompt,
      dayIndex: live.dayIndex,
    };
  }
  return { ...day, detour: false, range: undefined, passageRef: undefined, savedRange: undefined };
}
