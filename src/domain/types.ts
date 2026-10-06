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
  draftStartChapter: number;
  bibleSource: BibleSourceId;
  bibleTranslation: BibleTranslationId;
  bibleCustomPattern: string;
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
