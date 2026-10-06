export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function diffDays(fromIso: string, toIso: string): number {
  const from = parseLocalDate(fromIso).getTime();
  const to = parseLocalDate(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function formatDayLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDay(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonth(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatClock(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatAskTime(askTime: string): string {
  const [hourRaw, minuteRaw] = askTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return askTime;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function startOfWeek(iso: string): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() - date.getDay());
  return localDate(date);
}

export function monthGrid(iso: string): { iso: string; inMonth: boolean }[] {
  const date = parseLocalDate(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    cells.push({ iso: localDate(cursor), inMonth: cursor.getMonth() === month });
  }
  return cells;
}

export function dayOfMonth(iso: string): number {
  return parseLocalDate(iso).getDate();
}

export function dayOfYear(iso: string): number {
  const date = parseLocalDate(iso);
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

export function msUntilAsk(askTime: string, now = new Date()): number {
  const [hourRaw, minuteRaw] = askTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const target = new Date(now);
  target.setHours(Number.isFinite(hour) ? hour : 6, Number.isFinite(minute) ? minute : 30, 0, 0);
  return target.getTime() - now.getTime();
}
