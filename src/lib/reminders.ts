import { localDate, msUntilAsk } from "../domain/dates";
import { QBE_QUESTION } from "../domain/types";
import { withBase } from "./base";

type NotificationWithTrigger = NotificationOptions & { showTrigger?: unknown };
type TimestampTriggerCtor = new (when: number) => unknown;

const ASK_NOTIFICATION_TITLE = "Drip by drip";
const DAILY_SCHEDULE_TAG = "qbe-scheduled";

/**
 * Separate from today's delivered ask (`qbe-YYYY-MM-DD`) and the daily
 * TimestampTrigger (`qbe-scheduled`). The same tag would replace whichever
 * notification is already pending.
 */
export const DELAYED_TEST_TAG = "qbe-test-delayed";
export const DELAYED_TEST_DELAY_MS = 60_000;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function askNotificationOptions(tag: string): NotificationOptions {
  return {
    body: QBE_QUESTION,
    tag,
    icon: withBase("icons/icon-192.png"),
    data: { href: withBase("") },
  };
}

async function showAppNotification(options: NotificationOptions): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const registration = await serviceWorkerRegistration();
  if (registration) {
    await registration.showNotification(ASK_NOTIFICATION_TITLE, options);
    return true;
  }
  new Notification(ASK_NOTIFICATION_TITLE, options);
  return true;
}

export async function showAskNotification(tag = `qbe-${localDate()}`): Promise<boolean> {
  return showAppNotification(askNotificationOptions(tag));
}

/** A grace note from a partner. Does not ask for permission and never uses the daily question. */
export async function showGraceNotification(body: string, tag: string): Promise<boolean> {
  const trimmed = body.trim();
  if (!trimmed) return false;
  return showAppNotification({
    body: trimmed,
    tag,
    icon: withBase("icons/icon-192.png"),
    data: { href: withBase("") },
  });
}

export type TestReminderResult = "sent" | "denied" | "dismissed" | "unsupported" | "failed";

type ReminderPermission = "granted" | "denied" | "dismissed" | "unsupported";

async function ensureReminderPermission(): Promise<ReminderPermission> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const permission = await requestNotificationPermission();
  if (permission === "granted") return "granted";
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "denied";
  return "dismissed";
}

/** Shows the daily ask notification. Does not record `lastNotifiedDate` or enable the schedule. */
export async function sendTestAskNotification(): Promise<TestReminderResult> {
  const permission = await ensureReminderPermission();
  if (permission !== "granted") return permission;
  try {
    const shown = await showAskNotification();
    if (shown) return "sent";
    if (Notification.permission === "denied") return "denied";
    return "failed";
  } catch {
    return "failed";
  }
}

export type DelayedTestReminderResult = "scheduled" | "fallback" | "denied" | "dismissed" | "unsupported" | "failed";

let delayedTimer: ReturnType<typeof setTimeout> | undefined;

function clearDelayedTimer(): void {
  if (delayedTimer === undefined) return;
  clearTimeout(delayedTimer);
  delayedTimer = undefined;
}

function timestampTriggerCtor(): TimestampTriggerCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { TimestampTrigger?: TimestampTriggerCtor }).TimestampTrigger;
}

async function showTriggeredNotification(
  registration: ServiceWorkerRegistration,
  when: number,
  tag: string,
  triggerCtor: TimestampTriggerCtor,
): Promise<void> {
  const options: NotificationWithTrigger = {
    ...askNotificationOptions(tag),
    showTrigger: new triggerCtor(when),
  };
  await registration.showNotification(ASK_NOTIFICATION_TITLE, options);
}

async function dismissDelayedTestNotification(): Promise<void> {
  const registration = await serviceWorkerRegistration();
  if (!registration || typeof registration.getNotifications !== "function") return;
  try {
    const pending = await registration.getNotifications({ tag: DELAYED_TEST_TAG });
    for (const notification of pending) notification.close();
  } catch {
    // Closing a scheduled test is best-effort.
  }
}

/** Stops a pending one-minute page timer and closes a triggered test notification with the delayed tag. */
export function cancelDelayedTestReminder(): void {
  clearDelayedTimer();
  void dismissDelayedTestNotification();
}

/**
 * Schedules the same daily-ask notification about a minute out.
 * Uses `TimestampTrigger` when this browser can show a triggered notification
 * through an installed service worker — the same show path as the daily ask.
 * Otherwise arms a page timer that calls `showAskNotification`. That timer
 * does not survive iOS or a suspended page.
 * Does not enable the daily reminder or write `lastNotifiedDate`.
 */
export async function scheduleDelayedTestReminder(): Promise<DelayedTestReminderResult> {
  const permission = await ensureReminderPermission();
  if (permission !== "granted") return permission;

  const triggerCtor = timestampTriggerCtor();
  if (triggerCtor && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registration = await serviceWorkerRegistration();
    if (registration) {
      try {
        await showTriggeredNotification(registration, Date.now() + DELAYED_TEST_DELAY_MS, DELAYED_TEST_TAG, triggerCtor);
        clearDelayedTimer();
        return "scheduled";
      } catch {
        return "failed";
      }
    }
  }

  clearDelayedTimer();
  delayedTimer = setTimeout(() => {
    delayedTimer = undefined;
    void showAskNotification(DELAYED_TEST_TAG).catch(() => {
      // The page may already be in the background; there is nowhere to surface this.
    });
  }, DELAYED_TEST_DELAY_MS);
  return "fallback";
}

/**
 * `serviceWorker.ready` never settles when no worker is registered, which is
 * the case in local `npm run dev`. Use the worker when one is installed so
 * production still goes through `showNotification`.
 */
async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) return null;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function scheduleTrigger(askTime: string): Promise<boolean> {
  const triggerCtor = timestampTriggerCtor();
  if (!triggerCtor || !("serviceWorker" in navigator) || Notification.permission !== "granted") return false;
  const wait = msUntilAsk(askTime);
  const when = Date.now() + (wait > 0 ? wait : wait + 86_400_000);
  try {
    const registration = await navigator.serviceWorker.ready;
    await showTriggeredNotification(registration, when, DAILY_SCHEDULE_TAG, triggerCtor);
    return true;
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  const ios = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || ios.standalone === true;
}
