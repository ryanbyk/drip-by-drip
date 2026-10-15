import type { Appearance } from "./appearance";

export type DripSize = "verses" | "chapter" | "two";

export type ReadingMode = "book" | "plan";

export type Answer = "yes" | "not_today" | "unanswered";

export type OnboardingStep = "framing" | "time" | "notify" | "reading" | "book" | "plan";

export type NotificationState = "unknown" | "granted" | "denied" | "dismissed" | "unsupported";

export type BibleSourceId = "youversion" | "biblegateway" | "esv" | "custom";

export type BibleTranslationId = "ESV" | "NIV" | "NLT" | "KJV" | "NKJV" | "NASB" | "CSB";

export type Range = {
  bookId: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
};

export type Place = {
  bookId: string;
  chapter: number;
  verse: number;
  /** Chapters 1 through this number count as already read, without a daily record. */
  countedThrough?: number;
};

export type DailyCommitment = {
  date: string;
  answer: Answer;
  answeredAt?: string;
  note?: string;
  readDone: boolean;
  readDoneAt?: string;
  huh: boolean;
  reflection?: string;
  verseTags?: string[];
  dayIndex?: number;
  passageRef?: string;
  passageTitle?: string;
  prompt?: string;
  range?: Range;
  savedRange?: Range;
  detour: boolean;
};

/** A group plan this reader is following. Personal book place stays in `places`. */
export type GroupPlanFollow = {
  planId: string;
  groupId: string;
  groupName: string;
  bookId: string;
  startChapter: number;
  endChapter: number;
  pace: DripSize;
  readingDays: number;
  startDate: string;
  mode: "group" | "start";
  startedOn: string;
};

export type UserPrefs = {
  askTime: string;
  notificationsEnabled: boolean;
  notificationState: NotificationState;
  appearance: Appearance;
  onboardingComplete: boolean;
  onboardingStep: OnboardingStep;
  createdAt: string;
  planStartDate: string;
  readingMode: ReadingMode;
  bookId: string;
  dripSize: DripSize;
  planId: string;
  installNudgeDismissed: boolean;
  lastNotifiedDate: string;
  queuedBookId: string;
  queuedBookDate: string;
  /** Chapter kept when a queued book begins. 0 starts that book at chapter 1. */
  queuedChapter: number;
  draftStartChapter: number;
  bibleSource: BibleSourceId;
  bibleTranslation: BibleTranslationId;
  bibleCustomPattern: string;
  /** When true, today’s passage renders in the app. Defaults on when this flag was never stored. */
  showInAppEsv: boolean;
  /** IANA zone last seen on this device. Empty until the app has read one. */
  timeZone: string;
  /** The group plan Today follows. Null keeps personal reading, or the older placeholder plan. */
  groupPlan: GroupPlanFollow | null;
};

export type Snapshot = {
  version: 1;
  updatedAt: number;
  prefs: UserPrefs;
  places: Record<string, Place>;
  days: Record<string, DailyCommitment>;
};

export const QBE_QUESTION = "Will you read God’s word today?";

export const GRACE_TITLE = "Rest in grace.";

export const GRACE_BODY = "The Word will still be here tomorrow.";

export const SOURCE_URL =
  "https://ryanbyk.github.io/crossway-milwaukee-sermon-notes/notes/drip-by-drift/2026-10-04/";

export const DEFAULT_ASK_TIME = "06:30";

export const VERSE_DRIP = 12;
