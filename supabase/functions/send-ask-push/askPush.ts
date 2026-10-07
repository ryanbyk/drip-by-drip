/** Pure ask-time matching shared by the Edge Function and the client. No secrets. */

export const ASK_PUSH_TITLE = "Drip by drip";

/** Kept in lockstep with `QBE_QUESTION` by a unit test. */
export const ASK_QUESTION = "Will you read God’s word today?";

export type SnapshotAskPrefs = {
  askTime: string;
  timeZone: string;
  notificationsEnabled: boolean;
  onboardingComplete: boolean;
};

export function validTimeZone(value: unknown): string {
  if (typeof value !== "string") return "";
  const zone = value.trim();
  if (!zone || zone.length > 80) return "";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(0);
    return zone;
  } catch {
    return "";
  }
}

export function normalizeAskTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function askPrefsFromPayload(payload: unknown): SnapshotAskPrefs | null {
  if (!payload || typeof payload !== "object") return null;
  const prefs = (payload as { prefs?: unknown }).prefs;
  if (!prefs || typeof prefs !== "object") return null;
  const raw = prefs as Record<string, unknown>;
  if (typeof raw.askTime !== "string") return null;
  const askTime = normalizeAskTime(raw.askTime);
  if (!askTime) return null;
  return {
    askTime,
    timeZone: validTimeZone(raw.timeZone),
    notificationsEnabled: raw.notificationsEnabled === true,
    onboardingComplete: raw.onboardingComplete === true,
  };
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Local calendar date and HH:MM in an IANA zone. */
export function zonedClock(now: Date, timeZone: string): { date: string; minutes: string } | null {
  const zone = validTimeZone(timeZone);
  if (!zone) return null;
  try {
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const year = part(dateParts, "year");
    const month = part(dateParts, "month");
    const day = part(dateParts, "day");
    let hour = part(timeParts, "hour");
    const minute = part(timeParts, "minute");
    if (hour === "24") hour = "00";
    if (!year || !month || !day || !hour || !minute) return null;
    return {
      date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      minutes: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
    };
  } catch {
    return null;
  }
}

export function alreadyAnsweredToday(payload: unknown, localDate: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const days = (payload as { days?: unknown }).days;
  if (!days || typeof days !== "object") return false;
  const day = (days as Record<string, unknown>)[localDate];
  if (!day || typeof day !== "object") return false;
  const answer = (day as { answer?: unknown }).answer;
  return answer === "yes" || answer === "not_today";
}

export type AskPushDecision = { due: false } | { due: true; localDate: string; timeZone: string };

/**
 * Due when this device's local minute matches ask time, reminders are on,
 * and this local date has not already been sent or answered.
 * The device zone wins so two phones in different zones each fire at 6:30 there.
 */
export function askPushDue(input: {
  payload: unknown;
  deviceTimeZone: string | null;
  now: Date;
  lastSentOn: string | null;
}): AskPushDecision {
  const prefs = askPrefsFromPayload(input.payload);
  if (!prefs || !prefs.notificationsEnabled || !prefs.onboardingComplete) return { due: false };
  const timeZone = validTimeZone(input.deviceTimeZone) || prefs.timeZone;
  const clock = timeZone ? zonedClock(input.now, timeZone) : null;
  if (!clock || clock.minutes !== prefs.askTime) return { due: false };
  const sent = input.lastSentOn?.slice(0, 10) ?? "";
  if (sent === clock.date) return { due: false };
  if (alreadyAnsweredToday(input.payload, clock.date)) return { due: false };
  return { due: true, localDate: clock.date, timeZone };
}

export function askPushMessage(localDate: string, body?: string): { title: string; body: string; tag: string } {
  const trimmed = body?.trim() ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : "";
  return {
    title: ASK_PUSH_TITLE,
    body: trimmed || ASK_QUESTION,
    tag: day ? `qbe-${day}` : "qbe-ask",
  };
}

/** Title stays “Drip by drip”. Body is the ask, or a short grace note when the payload says so. */
export function notificationFromPush(data: unknown, fallbackDate: string): { title: string; body: string; tag: string } {
  if (!data || typeof data !== "object") return askPushMessage(fallbackDate);
  const raw = data as { body?: unknown; tag?: unknown };
  const body = typeof raw.body === "string" ? raw.body : undefined;
  const message = askPushMessage(fallbackDate, body);
  if (typeof raw.tag === "string" && raw.tag.trim()) return { ...message, tag: raw.tag.trim().slice(0, 64) };
  return message;
}

/** Push services use 404 and 410 when the subscription is gone. */
export function deadPushStatus(status: number): boolean {
  return status === 404 || status === 410;
}
