import { getBook } from "./books";
import { addDays, formatAskTime, parseLocalDate, startOfWeek } from "./dates";
import { isEngaged, longestStreak } from "./streaks";
import type { DailyCommitment, Range, Snapshot } from "./types";

export type ChapterSitting = "unread" | "one" | "two";

export type BookRecap = {
  bookName: string;
  chapters: number;
  from: string | null;
  to: string | null;
  sittings: ChapterSitting[];
  readingDays: number;
  longest: number;
  powerWeeks: { hit: number; total: number };
  usualTime: string;
  reflections: number;
  topVerse: string | null;
  detourRefs: string[];
  huhRefs: string[];
  restDays: number;
};

function chaptersIn(range: Range): number[] {
  const chapters: number[] = [];
  for (let chapter = range.startChapter; chapter <= range.endChapter; chapter += 1) chapters.push(chapter);
  return chapters;
}

function spanLabel(from: string, to: string): { from: string; to: string } {
  const format = (iso: string) =>
    parseLocalDate(iso)
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  return { from: format(from), to: format(to) };
}

function usualTime(days: DailyCommitment[], fallback: string): string {
  const stamps = days.map((day) => day.readDoneAt).filter((value): value is string => Boolean(value));
  if (stamps.length === 0) return formatAskTime(fallback);
  const hours = new Map<number, number[]>();
  for (const stamp of stamps) {
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) continue;
    const list = hours.get(date.getHours()) ?? [];
    list.push(date.getMinutes());
    hours.set(date.getHours(), list);
  }
  let bestHour = 0;
  let bestCount = -1;
  for (const [hour, minutes] of hours) {
    if (minutes.length > bestCount) {
      bestHour = hour;
      bestCount = minutes.length;
    }
  }
  const minutes = [...(hours.get(bestHour) ?? [0])].sort((a, b) => a - b);
  const minute = minutes[Math.floor(minutes.length / 2)] ?? 0;
  const date = new Date();
  date.setHours(bestHour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function powerWeeks(days: Record<string, DailyCommitment>, from: string, to: string): { hit: number; total: number } {
  let cursor = startOfWeek(from);
  const end = startOfWeek(to);
  let hit = 0;
  let total = 0;
  while (cursor <= end) {
    total += 1;
    let engaged = 0;
    for (let index = 0; index < 7; index += 1) {
      const iso = addDays(cursor, index);
      if (iso > to) break;
      if (isEngaged(days[iso])) engaged += 1;
    }
    if (engaged >= 4) hit += 1;
    cursor = addDays(cursor, 7);
  }
  return { hit, total };
}

export function bookRecap(snapshot: Snapshot, today: string): BookRecap {
  const book = getBook(snapshot.prefs.bookId);
  const bookName = book?.name ?? "This book";
  const chapters = book?.verses.length ?? 1;
  const counts = Array.from({ length: chapters }, () => 0);
  const reads: DailyCommitment[] = [];
  const detourRefs: string[] = [];
  const huhRefs: string[] = [];
  let reflections = 0;
  let restDays = 0;
  const tags = new Map<string, number>();
  const start = snapshot.prefs.planStartDate;

  for (const day of Object.values(snapshot.days)) {
    if (start && day.date < start) continue;
    if (day.date > today) continue;
    if (day.answer === "not_today") restDays += 1;
    if (day.reflection) reflections += 1;
    for (const tag of day.verseTags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (day.huh && day.passageRef) huhRefs.push(day.passageRef);
    if (day.detour && day.passageRef && day.readDone && !detourRefs.includes(day.passageRef)) {
      detourRefs.push(day.passageRef);
    }
    if (!day.readDone || day.detour || !day.range || day.range.bookId !== snapshot.prefs.bookId) continue;
    reads.push(day);
    for (const chapter of chaptersIn(day.range)) {
      if (chapter >= 1 && chapter <= chapters) counts[chapter - 1] += 1;
    }
  }

  const countedThrough = snapshot.places[snapshot.prefs.bookId]?.countedThrough ?? 0;
  for (let chapter = 1; chapter <= countedThrough && chapter <= chapters; chapter += 1) {
    if (counts[chapter - 1] === 0) counts[chapter - 1] = 1;
  }

  const dates = reads.map((day) => day.date).sort();
  const from = dates[0] ?? null;
  const to = dates.at(-1) ?? null;
  const span = from && to ? spanLabel(from, to) : null;
  let topVerse: string | null = null;
  let topCount = 0;
  for (const [tag, count] of tags) {
    if (count > topCount) {
      topVerse = tag;
      topCount = count;
    }
  }

  return {
    bookName,
    chapters,
    from: span?.from ?? null,
    to: span?.to ?? null,
    sittings: counts.map((count) => (count >= 2 ? "two" : count > 0 ? "one" : "unread")),
    readingDays: reads.length,
    longest: longestStreak(snapshot.days, today, start),
    powerWeeks: from && to ? powerWeeks(snapshot.days, from, to) : { hit: 0, total: 0 },
    usualTime: usualTime(reads, snapshot.prefs.askTime),
    reflections,
    topVerse,
    detourRefs,
    huhRefs,
    restDays,
  };
}
