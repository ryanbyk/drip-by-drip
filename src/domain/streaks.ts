import { addDays, diffDays, startOfWeek } from "./dates";
import type { DailyCommitment } from "./types";

export type DayMark = "read" | "yes" | "not_today" | "unanswered" | "today" | "future" | "before";

export function isEngaged(day: DailyCommitment | undefined): boolean {
  return Boolean(day && day.answer === "yes" && day.readDone);
}

export function markForDate(
  iso: string,
  today: string,
  startIso: string,
  day: DailyCommitment | undefined,
): DayMark {
  if (!startIso || iso < startIso) return "before";
  if (iso > today) return "future";
  if (iso === today && (!day || day.answer === "unanswered")) return "today";
  if (!day || day.answer === "unanswered") return "unanswered";
  if (day.answer === "not_today") return "not_today";
  if (day.readDone) return "read";
  if (day.answer === "yes") return "yes";
  if (iso === today) return "today";
  return "unanswered";
}

function engagedOn(days: Record<string, DailyCommitment>, iso: string): boolean {
  return isEngaged(days[iso]);
}

function breaksStreak(days: Record<string, DailyCommitment>, iso: string): boolean {
  const day = days[iso];
  if (!day || day.answer === "unanswered") return true;
  if (day.answer === "not_today") return true;
  if (day.answer === "yes" && !day.readDone) return true;
  return false;
}

export function currentStreak(days: Record<string, DailyCommitment>, today: string, startIso: string): number {
  if (!startIso || today < startIso) return 0;
  const todayDay = days[today];
  let cursor = today;
  let count = 0;
  if (todayDay?.answer === "not_today") return 0;
  if (isEngaged(todayDay)) {
    count = 1;
    cursor = addDays(today, -1);
  } else {
    cursor = addDays(today, -1);
  }
  while (cursor >= startIso) {
    if (!engagedOn(days, cursor)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function longestStreak(days: Record<string, DailyCommitment>, today: string, startIso: string): number {
  if (!startIso || today < startIso) return 0;
  let best = 0;
  let run = 0;
  let cursor = startIso;
  while (cursor <= today) {
    const isToday = cursor === today;
    const day = days[cursor];
    if (isEngaged(day)) {
      run += 1;
      best = Math.max(best, run);
    } else if (isToday && day?.answer !== "not_today") {
      run = 0;
    } else if (breaksStreak(days, cursor) || !isEngaged(day)) {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return best;
}

export function powerOfFour(
  days: Record<string, DailyCommitment>,
  today: string,
): { engaged: number; goal: 4 } {
  const start = startOfWeek(today);
  let engaged = 0;
  for (let index = 0; index < 7; index += 1) {
    const iso = addDays(start, index);
    if (iso > today) break;
    if (engagedOn(days, iso)) engaged += 1;
  }
  return { engaged, goal: 4 };
}

export function lastReadDate(days: Record<string, DailyCommitment>, today: string): string | null {
  const dates = Object.keys(days)
    .filter((iso) => iso < today && isEngaged(days[iso]))
    .sort();
  return dates.at(-1) ?? null;
}

export function showWelcomeBack(
  days: Record<string, DailyCommitment>,
  today: string,
  startIso: string,
): boolean {
  if (!startIso || today <= startIso) return false;
  const last = lastReadDate(days, today);
  if (!last) return diffDays(startIso, today) >= 2;
  return diffDays(last, today) >= 2;
}

export function yesterdayDetour(
  days: Record<string, DailyCommitment>,
  today: string,
): DailyCommitment | null {
  const yesterday = days[addDays(today, -1)];
  if (yesterday?.detour && yesterday.readDone && yesterday.passageRef) return yesterday;
  return null;
}

export function showSoftReask(
  days: Record<string, DailyCommitment>,
  today: string,
  startIso: string,
): boolean {
  if (!startIso || today <= startIso) return false;
  const yesterday = days[addDays(today, -1)];
  return !yesterday || yesterday.answer === "unanswered";
}
