import { normalizeBiblePrefs } from "../domain/bibleSource";
import { getBook } from "../domain/books";
import { startPlace } from "../domain/chapters";
import { placeAfter, verseInRange } from "../domain/drip";
import { describePastRead } from "../domain/pastRead";
import { formatRef } from "../domain/refs";
import { lockPassage } from "../domain/resolve";
import { resolveSwitchPlace, switchTiming } from "../domain/switchBook";
import {
  DEFAULT_ASK_TIME,
  type DailyCommitment,
  type DripSize,
  type Place,
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
      startVerse?: number;
      countEarlier?: boolean;
      askTime: string;
    }
  | { type: "answer"; today: string; at: string; answer: "yes" | "not_today" }
  | { type: "note"; today: string; note: string }
  | { type: "reflection"; today: string; reflection: string; huh: boolean; verseTags?: string[] }
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
      type: "markPastRead";
      date: string;
      today: string;
      at: string;
      stop?: { chapter: number; verse: number };
    }
  | {
      type: "reading";
      today: string;
      bookId?: string;
      dripSize?: DripSize;
      mode?: ReadingMode;
      startChapter?: number;
      startVerse?: number;
      countEarlier?: boolean;
    }
  | {
      type: "queueBook";
      bookId: string;
      when: "today" | "tomorrow";
      today: string;
      tomorrow: string;
      startChapter?: number;
      startVerse?: number;
      countEarlier?: boolean;
    }
  | { type: "applyQueue"; today: string }
  | {
      type: "switchBook";
      bookId: string;
      today: string;
      tomorrow: string;
      startChapter: number;
      startVerse?: number;
      countEarlier?: boolean;
      dripSize?: DripSize;
    }
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
      appearance: "system",
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
      queuedChapter: 0,
      draftStartChapter: 1,
      bibleSource: "youversion",
      bibleTranslation: "ESV",
      bibleCustomPattern: "",
      showInAppEsv: true,
      timeZone: "",
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

function keepCounted(next: Place, previous: Place | undefined): Place {
  if (previous?.countedThrough === undefined) return next;
  return { ...next, countedThrough: previous.countedThrough };
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
      return touch({ ...state, prefs: normalizeBiblePrefs({ ...state.prefs, ...action.prefs }) });
    case "completeOnboarding": {
      const bookId = getBook(action.bookId)?.id ?? "mark";
      const place = startPlace(bookId, action.startChapter, action.startVerse ?? 1, action.countEarlier);
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
          draftStartChapter: place.chapter,
          queuedBookId: "",
          queuedBookDate: "",
          queuedChapter: 0,
        },
        places: {
          ...state.places,
          [bookId]: place,
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
      const tags =
        action.verseTags === undefined
          ? day.verseTags
          : action.verseTags.map((tag) => tag.trim()).filter(Boolean);
      return touch({
        ...state,
        days: {
          ...state.days,
          [action.today]: {
            ...day,
            reflection: action.reflection.trim() || undefined,
            huh: action.huh,
            verseTags: tags && tags.length > 0 ? tags : undefined,
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
        const next = keepCounted(placeAfter(day.range.bookId, stop.chapter, stop.verse), places[day.range.bookId]);
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
    case "markPastRead": {
      const described = describePastRead(state, action.date, action.today);
      if (!described) return state;
      let places = state.places;
      let advanced = false;
      if (described.advance && described.range) {
        const stop = action.stop ?? { chapter: described.range.endChapter, verse: described.range.endVerse };
        if (!verseInRange(described.range, stop.chapter, stop.verse)) return state;
        const nextPlace = keepCounted(
          placeAfter(described.range.bookId, stop.chapter, stop.verse),
          places[described.range.bookId],
        );
        places = { ...places, [described.range.bookId]: nextPlace };
        advanced = true;
      }
      const day: DailyCommitment = {
        ...described.day,
        answer: "yes",
        answeredAt: described.day.answeredAt ?? action.at,
        readDone: true,
        readDoneAt: action.at,
      };
      const next = touch({
        ...state,
        places,
        days: { ...state.days, [action.date]: day },
      });
      if (advanced && described.range?.bookId === state.prefs.bookId) return relockToday(next, action.today);
      return next;
    }
    case "reading": {
      const bookId = action.bookId ?? state.prefs.bookId;
      const known = getBook(bookId);
      if (!known) return state;
      const mode = action.mode ?? state.prefs.readingMode;
      const dripSize = action.dripSize ?? state.prefs.dripSize;
      let place = state.places[bookId] ?? { bookId, chapter: 1, verse: 1 };
      if (action.startChapter) {
        place = startPlace(bookId, action.startChapter, action.startVerse ?? 1, action.countEarlier);
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
        const startChapter = action.startChapter ?? 0;
        return touch({
          ...state,
          prefs: {
            ...state.prefs,
            queuedBookId: book.id,
            queuedBookDate: action.tomorrow,
            queuedChapter: startChapter,
          },
          places: action.startChapter
            ? {
                ...state.places,
                [book.id]: startPlace(book.id, action.startChapter, action.startVerse ?? 1, action.countEarlier),
              }
            : state.places,
        });
      }
      const place = action.startChapter
        ? startPlace(book.id, action.startChapter, action.startVerse ?? 1, action.countEarlier)
        : { bookId: book.id, chapter: 1, verse: 1 };
      const next: Snapshot = {
        ...state,
        prefs: {
          ...state.prefs,
          bookId: book.id,
          readingMode: "book",
          queuedBookId: "",
          queuedBookDate: "",
          queuedChapter: 0,
        },
        places: { ...state.places, [book.id]: place },
      };
      return touch(relockToday(next, action.today));
    }
    case "applyQueue": {
      const { queuedBookId, queuedBookDate, queuedChapter } = state.prefs;
      if (!queuedBookId || !queuedBookDate || queuedBookDate > action.today) return state;
      if (!getBook(queuedBookId)) return state;
      const saved = state.places[queuedBookId];
      const place =
        queuedChapter > 0
          ? saved ?? { bookId: queuedBookId, chapter: queuedChapter, verse: 1 }
          : { bookId: queuedBookId, chapter: 1, verse: 1 };
      const next: Snapshot = {
        ...state,
        prefs: {
          ...state.prefs,
          bookId: queuedBookId,
          readingMode: "book",
          queuedBookId: "",
          queuedBookDate: "",
          queuedChapter: 0,
        },
        places: {
          ...state.places,
          [queuedBookId]: place,
        },
      };
      return touch(relockToday(next, action.today));
    }
    case "switchBook": {
      const book = getBook(action.bookId);
      if (!book) return state;
      const place = resolveSwitchPlace(
        state.places,
        book.id,
        action.startChapter,
        action.startVerse,
        action.countEarlier,
      );
      const places = { ...state.places, [book.id]: place };
      const dripSize = action.dripSize ?? state.prefs.dripSize;
      if (switchTiming(state, action.today, book.id) === "tomorrow") {
        return touch({
          ...state,
          places,
          prefs: {
            ...state.prefs,
            dripSize,
            queuedBookId: book.id,
            queuedBookDate: action.tomorrow,
            queuedChapter: place.chapter,
          },
        });
      }
      const next: Snapshot = {
        ...state,
        places,
        prefs: {
          ...state.prefs,
          bookId: book.id,
          dripSize,
          draftStartChapter: place.chapter,
          queuedBookId: "",
          queuedBookDate: "",
          queuedChapter: 0,
        },
      };
      if (next.prefs.readingMode === "plan") return touch(next);
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
          queuedChapter: 0,
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

