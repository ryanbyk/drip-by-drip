import { getBook } from "../domain/books";
import { clampStartChapter, placeAfter, verseInRange } from "../domain/drip";
import { formatRef } from "../domain/refs";
import { lockPassage } from "../domain/resolve";
import {
  DEFAULT_ASK_TIME,
  type DailyCommitment,
  type DripSize,
  type Range,
  type ReadingMode,
  type Snapshot,
  type UserPrefs,
} from "../domain/types";

export type Action =
  | { type: "replace"; snapshot: Snapshot }
  | { type: "prefs"; prefs: Partial<UserPrefs> }
  | {
      type: "completeOnboarding";
      today: string;
      at: string;
      mode: ReadingMode;
      bookId: string;
      dripSize: DripSize;
      startChapter: number;
      askTime: string;
    }
  | { type: "answer"; today: string; at: string; answer: "yes" | "not_today" }
  | { type: "note"; today: string; note: string }
  | { type: "reflection"; today: string; reflection: string; huh: boolean }
  | { type: "range"; today: string; range: Range }
  | { type: "detour"; today: string; ref: string }
  | { type: "clearDetour"; today: string }
  | { type: "planRef"; today: string; ref: string }
  | {
      type: "finish";
      today: string;
      at: string;
      stop?: { chapter: number; verse: number };
      huh?: boolean;
      reflection?: string;
    }
  | {
      type: "reading";
      today: string;
      bookId?: string;
      dripSize?: DripSize;
      mode?: ReadingMode;
      startChapter?: number;
    }
  | { type: "queueBook"; bookId: string; when: "today" | "tomorrow"; today: string; tomorrow: string }
  | { type: "applyQueue"; today: string }
  | { type: "reset"; today: string }
  | { type: "notified"; today: string };

export function createSnapshot(): Snapshot {
  return {
    version: 1,
    updatedAt: 0,
    prefs: {
      askTime: DEFAULT_ASK_TIME,
      notificationsEnabled: false,
      notificationState: "unknown",
      onboardingComplete: false,
      onboardingStep: "framing",
      createdAt: "",
      planStartDate: "",
      readingMode: "book",
      bookId: "mark",
      dripSize: "chapter",
      planId: "placeholder",
      installNudgeDismissed: false,
      lastNotifiedDate: "",
      queuedBookId: "",
      queuedBookDate: "",
      draftStartChapter: 1,
    },
    places: { mark: { bookId: "mark", chapter: 1, verse: 1 } },
    days: {},
  };
}

function touch(state: Snapshot): Snapshot {
  return { ...state, updatedAt: Date.now() };
}

function blankDay(date: string, at: string, answer: "yes" | "not_today"): DailyCommitment {
  return {
    date,
    answer,
    answeredAt: at,
    readDone: false,
    huh: false,
    detour: false,
  };
}

function relockToday(state: Snapshot, today: string): Snapshot {
  const day = state.days[today];
  if (!day || day.answer !== "yes" || day.readDone || day.detour) return state;
  return {
    ...state,
    days: { ...state.days, [today]: lockPassage(state, today, { ...day, range: undefined, passageRef: undefined }) },
  };
}

export function reducer(state: Snapshot, action: Action): Snapshot {
  switch (action.type) {
    case "replace":
      return action.snapshot;
    case "prefs":
      return touch({ ...state, prefs: { ...state.prefs, ...action.prefs } });
    case "completeOnboarding": {
      const bookId = getBook(action.bookId)?.id ?? "mark";
      const chapter = clampStartChapter(bookId, action.startChapter);
      return touch({
        ...state,
        prefs: {
          ...state.prefs,
          onboardingComplete: true,
          onboardingStep: "framing",
          createdAt: state.prefs.createdAt || action.at,
          planStartDate: action.today,
          readingMode: action.mode,
          bookId,
          dripSize: action.dripSize,
          askTime: action.askTime || DEFAULT_ASK_TIME,
          draftStartChapter: chapter,
          queuedBookId: "",
          queuedBookDate: "",
        },
        places: {
          ...state.places,
          [bookId]: { bookId, chapter, verse: 1 },
        },
      });
    }
    case "answer": {
      const existing = state.days[action.today];
      if (existing?.readDone) return state;
      if (existing?.answer === "yes" && action.answer === "not_today") return state;
      if (existing?.answer === action.answer) return state;
      const day = blankDay(action.today, action.at, action.answer);
      if (existing?.reflection) day.reflection = existing.reflection;
      if (existing?.huh) day.huh = existing.huh;
      const nextDay = action.answer === "yes" ? lockPassage(state, action.today, day) : day;
      return touch({ ...state, days: { ...state.days, [action.today]: nextDay } });
    }
    case "note": {
      const day = state.days[action.today];
      if (!day) return state;
      return touch({
        ...state,
        days: { ...state.days, [action.today]: { ...day, note: action.note.trim() || undefined } },
      });
    }
    case "reflection": {
      const day = state.days[action.today];
      if (!day) return state;
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            reflection: action.reflection.trim() || undefined,
            huh: action.huh,
          },
        },
      });
    }
    case "range": {
      const day = state.days[action.today];
      if (!day || day.readDone || day.answer !== "yes") return state;
      if (action.range.bookId !== state.prefs.bookId) return state;
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            detour: false,
            range: action.range,
            savedRange: action.range,
            passageRef: formatRef(action.range),
            passageTitle: undefined,
            prompt: undefined,
          },
        },
      });
    }
    case "detour": {
      const day = state.days[action.today];
      if (!day || day.readDone || day.answer !== "yes") return state;
      const ref = action.ref.trim();
      if (!ref) return state;
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            detour: true,
            passageRef: ref,
            passageTitle: undefined,
            prompt: undefined,
            savedRange: day.savedRange ?? day.range,
          },
        },
      });
    }
    case "clearDetour": {
      const day = state.days[action.today];
      if (!day || day.readDone) return state;
      const range = day.savedRange ?? day.range;
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            detour: false,
            range,
            passageRef: range ? formatRef(range) : day.passageRef,
            savedRange: range,
          },
        },
      });
    }
    case "planRef": {
      const day = state.days[action.today];
      if (!day || day.readDone || day.answer !== "yes") return state;
      const ref = action.ref.trim();
      if (!ref) return state;
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            detour: false,
            passageRef: ref,
            prompt: undefined,
            passageTitle: undefined,
          },
        },
      });
    }
    case "finish": {
      const day = state.days[action.today];
      if (!day || day.answer !== "yes" || day.readDone) return state;
      let places = state.places;
      if (!day.detour && day.range && state.prefs.readingMode === "book") {
        const stop = action.stop ?? { chapter: day.range.endChapter, verse: day.range.endVerse };
        if (!verseInRange(day.range, stop.chapter, stop.verse)) return state;
        const next = placeAfter(day.range.bookId, stop.chapter, stop.verse);
        places = { ...places, [day.range.bookId]: next };
      }
      return touch({
        ...state,
        places,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            readDone: true,
            readDoneAt: action.at,
            huh: action.huh ?? day.huh,
            reflection: action.reflection !== undefined ? action.reflection.trim() || undefined : day.reflection,
          },
        },
      });
    }
    case "reading": {
      const bookId = action.bookId ?? state.prefs.bookId;
      const known = getBook(bookId);
      if (!known) return state;
      const mode = action.mode ?? state.prefs.readingMode;
      const dripSize = action.dripSize ?? state.prefs.dripSize;
      let place = state.places[bookId] ?? { bookId, chapter: 1, verse: 1 };
      if (action.startChapter) {
        place = { bookId, chapter: clampStartChapter(bookId, action.startChapter), verse: 1 };
      }
      const next: Snapshot = {
        ...state,
        prefs: { ...state.prefs, bookId, readingMode: mode, dripSize },
        places: { ...state.places, [bookId]: place },
      };
      return touch(relockToday(next, action.today));
    }
    case "queueBook": {
      const book = getBook(action.bookId);
      if (!book) return state;
      if (action.when === "tomorrow") {
        return touch({
          ...state,
          prefs: { ...state.prefs, queuedBookId: book.id, queuedBookDate: action.tomorrow },
        });
      }
      const next: Snapshot = {
        ...state,
        prefs: {
          ...state.prefs,
          bookId: book.id,
          readingMode: "book",
          queuedBookId: "",
          queuedBookDate: "",
        },
        places: { ...state.places, [book.id]: { bookId: book.id, chapter: 1, verse: 1 } },
      };
      return touch(relockToday(next, action.today));
    }
    case "applyQueue": {
      const { queuedBookId, queuedBookDate } = state.prefs;
      if (!queuedBookId || !queuedBookDate || queuedBookDate > action.today) return state;
      if (!getBook(queuedBookId)) return state;
      const next: Snapshot = {
        ...state,
        prefs: {
          ...state.prefs,
          bookId: queuedBookId,
          readingMode: "book",
          queuedBookId: "",
          queuedBookDate: "",
        },
        places: {
          ...state.places,
          [queuedBookId]: { bookId: queuedBookId, chapter: 1, verse: 1 },
        },
      };
      return touch(relockToday(next, action.today));
    }
    case "reset": {
      const bookId = getBook(state.prefs.bookId)?.id ?? "mark";
      return touch({
        ...state,
        days: {},
        places: { [bookId]: { bookId, chapter: 1, verse: 1 } },
        prefs: {
          ...state.prefs,
          planStartDate: action.today,
          queuedBookId: "",
          queuedBookDate: "",
          draftStartChapter: 1,
        },
      });
    }
    case "notified":
      if (state.prefs.lastNotifiedDate === action.today) return state;
      return touch({ ...state, prefs: { ...state.prefs, lastNotifiedDate: action.today } });
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

