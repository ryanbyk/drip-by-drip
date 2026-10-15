import { chapterCount, getBook, verseCount } from "./books";
import { addDays, parseLocalDate } from "./dates";
import { dripFromPlace, isPlaceFinished, makeRange, placeAfter } from "./drip";
import { formatRef } from "./refs";
import type { DripSize, GroupPlanFollow, Place, Range } from "./types";
import { VERSE_DRIP } from "./types";

export type { GroupPlanFollow };

/** Sunday is bit 0. Weeks start on Sunday. */
export const MON_FRI = 0b0111110;
export const EVERY_DAY = 0b1111111;

export const WEEKDAY_MARKS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type StoredPlan = Omit<GroupPlanFollow, "planId" | "groupId" | "groupName" | "mode" | "startedOn">;

export type PlanReading = {
  index: number;
  date: string;
  range: Range;
};

export type PlanStatus = "before" | "reading" | "off" | "finished";

export type PlanView = {
  status: PlanStatus;
  total: number;
  index: number;
  progress: number;
  today: PlanReading | null;
  next: PlanReading | null;
  readings: PlanReading[];
};

export function weekdayOn(mask: number, index: number): boolean {
  return index >= 0 && index <= 6 && (mask & (1 << index)) !== 0;
}

export function toggleWeekday(mask: number, index: number): number {
  if (index < 0 || index > 6) return mask;
  return mask ^ (1 << index);
}

function isReadingDate(mask: number, iso: string): boolean {
  return weekdayOn(mask, parseLocalDate(iso).getDay());
}

function nextReadingDate(mask: number, iso: string): string | null {
  let date = iso;
  for (let step = 0; step < 8; step += 1) {
    if (isReadingDate(mask, date)) return date;
    date = addDays(date, 1);
  }
  return null;
}

export function planReadings(plan: StoredPlan, anchor = plan.startDate): PlanReading[] {
  const book = getBook(plan.bookId);
  if (!book || plan.readingDays < 1 || plan.readingDays > EVERY_DAY) return [];
  const startChapter = Math.max(1, plan.startChapter);
  const endChapter = Math.min(book.verses.length, plan.endChapter);
  if (endChapter < startChapter) return [];
  let place: Place = { bookId: plan.bookId, chapter: startChapter, verse: 1 };
  let date = nextReadingDate(plan.readingDays, anchor);
  const readings: PlanReading[] = [];
  let guard = 0;
  while (date && guard < 800 && readings.length < 400) {
    guard += 1;
    if (place.chapter > endChapter || isPlaceFinished(place)) break;
    const raw = dripFromPlace(place, plan.pace);
    if (!raw || raw.startChapter > endChapter) break;
    const range =
      raw.endChapter > endChapter
        ? makeRange(plan.bookId, raw.startChapter, raw.startVerse, endChapter, verseCount(plan.bookId, endChapter))
        : raw;
    if (!range) break;
    readings.push({ index: readings.length + 1, date, range });
    place = placeAfter(plan.bookId, range.endChapter, range.endVerse);
    date = nextReadingDate(plan.readingDays, addDays(date, 1));
  }
  return readings;
}

export function locateReading(readings: readonly PlanReading[], today: string): PlanView {
  const total = readings.length;
  const todaySlot = readings.find((reading) => reading.date === today) ?? null;
  const next = readings.find((reading) => reading.date > today) ?? null;
  const previous = [...readings].reverse().find((reading) => reading.date < today) ?? null;
  if (todaySlot) {
    return {
      status: "reading",
      total,
      index: todaySlot.index,
      progress: total === 0 ? 0 : todaySlot.index / total,
      today: todaySlot,
      next,
      readings: [...readings],
    };
  }
  if (!previous && next) {
    return { status: "before", total, index: 0, progress: 0, today: null, next, readings: [...readings] };
  }
  if (previous && next) {
    return {
      status: "off",
      total,
      index: previous.index,
      progress: total === 0 ? 0 : previous.index / total,
      today: null,
      next,
      readings: [...readings],
    };
  }
  return {
    status: "finished",
    total,
    index: total,
    progress: total === 0 ? 0 : 1,
    today: null,
    next: null,
    readings: [...readings],
  };
}

export function followView(plan: GroupPlanFollow, today: string): PlanView {
  const anchor = plan.mode === "start" ? plan.startedOn : plan.startDate;
  return locateReading(planReadings(plan, anchor), today);
}

export function groupView(plan: StoredPlan, today: string): PlanView {
  return locateReading(planReadings(plan), today);
}

export function planTitle(plan: Pick<StoredPlan, "bookId" | "startChapter" | "endChapter">): string {
  const book = getBook(plan.bookId);
  const name = book?.name ?? "a book";
  const total = chapterCount(plan.bookId);
  if (plan.startChapter <= 1 && plan.endChapter >= total) return `Reading through ${name}`;
  return `Reading through ${name} ${plan.startChapter}–${plan.endChapter}`;
}

export function pacePerDay(pace: DripSize): string {
  switch (pace) {
    case "verses":
      return `${VERSE_DRIP} vv`;
    case "chapter":
      return "1 ch";
    case "two":
      return "2 ch";
    default: {
      const exhaustive: never = pace;
      return exhaustive;
    }
  }
}

export function paceChoice(pace: DripSize): string {
  switch (pace) {
    case "verses":
      return "Verses";
    case "chapter":
      return "1 chapter";
    case "two":
      return "2 chapters";
    default: {
      const exhaustive: never = pace;
      return exhaustive;
    }
  }
}

export function readingDaysFact(mask: number): { value: string; caption: string } {
  if (mask === EVERY_DAY) return { value: "Every day", caption: "including weekends" };
  if (mask === MON_FRI) return { value: "Mon–Fri", caption: "weekends free" };
  const names = WEEKDAY_NAMES.filter((_, index) => weekdayOn(mask, index));
  if (names.length === 0) return { value: "No days", caption: "pick at least one" };
  return { value: names.join(" "), caption: "reading days" };
}

export function planBlurb(plan: StoredPlan): string {
  const book = getBook(plan.bookId)?.name ?? "this book";
  const pace = plan.pace === "two" ? "two chapters" : plan.pace === "verses" ? "a short drip" : "one chapter";
  if (plan.readingDays === MON_FRI) return `Walk through ${book} together — ${pace} a weekday, weekends free.`;
  if (plan.readingDays === EVERY_DAY) return `Walk through ${book} together — ${pace} every day.`;
  return `Walk through ${book} together — ${pace} on ${readingDaysFact(plan.readingDays).value}.`;
}

export function formatMonthDay(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatReadingDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  return parseLocalDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function planDayLabel(view: PlanView): string {
  if (view.status === "before" && view.next) return `Starts ${formatMonthDay(view.next.date)}`;
  if (view.status === "finished") return "Finished";
  if (view.total === 0) return "No readings";
  return `Day ${view.index} of ${view.total}`;
}

export function planTodayLine(view: PlanView): string {
  if (view.status === "reading" && view.today) return `Today: ${formatRef(view.today.range)}`;
  if (view.next) return `Next: ${formatRef(view.next.range)}`;
  if (view.status === "finished") return "The plan is finished";
  return "No reading scheduled";
}

export function joinWhereCopy(view: PlanView): string {
  if (view.status === "reading" && view.today) {
    return `Day ${view.today.index} · ${formatRef(view.today.range)} today. Earlier days stay open.`;
  }
  if (view.next) return `Next is ${formatRef(view.next.range)}. Earlier days stay open.`;
  return "This plan has finished.";
}

export const START_AT_DAY_ONE = "Your own pace; the group still sees you read.";

export function readersLine(count: number): string {
  if (count === 1) return "1 person in this group is reading";
  return `${count} people in this group are reading`;
}

export function planRestLine(plan: GroupPlanFollow | null | undefined, today: string): string | null {
  if (!plan) return null;
  const view = followView(plan, today);
  if (view.status === "reading") return null;
  if (view.status === "finished") return "This group plan is finished. This is your own book.";
  return "The group plan rests today. This is your own book.";
}

export function validPlanDraft(plan: StoredPlan): string | null {
  const book = getBook(plan.bookId);
  if (!book) return "Choose a book.";
  if (plan.startChapter < 1 || plan.endChapter > book.verses.length || plan.endChapter < plan.startChapter) {
    return "Choose a chapter range inside the book.";
  }
  if (plan.pace !== "verses" && plan.pace !== "chapter" && plan.pace !== "two") return "Choose a pace.";
  if (plan.readingDays < 1 || plan.readingDays > EVERY_DAY) return "Pick at least one reading day.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)) return "Choose a start date.";
  if (planReadings(plan).length === 0) return "That range doesn’t leave a reading.";
  return null;
}

export function normalizeGroupPlan(value: unknown): GroupPlanFollow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<GroupPlanFollow>;
  const pace = row.pace;
  const mode = row.mode;
  if (pace !== "verses" && pace !== "chapter" && pace !== "two") return null;
  if (mode !== "group" && mode !== "start") return null;
  if (typeof row.planId !== "string" || !row.planId) return null;
  if (typeof row.groupId !== "string" || !row.groupId) return null;
  if (typeof row.bookId !== "string" || !getBook(row.bookId)) return null;
  if (typeof row.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.startDate)) return null;
  if (typeof row.startedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.startedOn)) return null;
  if (typeof row.readingDays !== "number" || row.readingDays < 1 || row.readingDays > EVERY_DAY) return null;
  const total = chapterCount(row.bookId);
  const start = Number(row.startChapter);
  const end = Number(row.endChapter);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > total || end < start) return null;
  const groupName = typeof row.groupName === "string" ? row.groupName.trim() : "";
  return {
    planId: row.planId,
    groupId: row.groupId,
    groupName: groupName || "Group",
    bookId: row.bookId,
    startChapter: start,
    endChapter: end,
    pace,
    readingDays: row.readingDays,
    startDate: row.startDate,
    mode,
    startedOn: row.startedOn,
  };
}
