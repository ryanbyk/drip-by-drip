import { localDate, msUntilAsk } from "../domain/dates";
import { QBE_QUESTION } from "../domain/types";
import { withBase } from "./base";

type NotificationWithTrigger = NotificationOptions & { showTrigger?: unknown };

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

export async function showAskNotification(): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const title = "Drip by drip";
  const options: NotificationOptions = {
    body: QBE_QUESTION,
    tag: `qbe-${localDate()}`,
    icon: withBase("icons/icon-192.png"),
    data: { href: withBase("") },
  };
  const registration = await serviceWorkerRegistration();
  if (registration) {
    await registration.showNotification(title, options);
    return true;
  }
  new Notification(title, options);
  return true;
}

export type TestReminderResult = "sent" | "denied" | "dismissed" | "unsupported" | "failed";

/** Shows the daily ask notification. Does not record `lastNotifiedDate` or enable the schedule. */
export async function sendTestAskNotification(): Promise<TestReminderResult> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "granted") {
    const permission = await requestNotificationPermission();
    if (permission === "unsupported") return "unsupported";
    if (permission === "denied") return "denied";
    if (permission !== "granted") return "dismissed";
  }
  try {
    const shown = await showAskNotification();
    if (shown) return "sent";
    if (Notification.permission === "denied") return "denied";
    return "failed";
  } catch {
    return "failed";
  }
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
  const triggerCtor = (window as unknown as { TimestampTrigger?: new (when: number) => unknown }).TimestampTrigger;
  if (!triggerCtor || !("serviceWorker" in navigator) || Notification.permission !== "granted") return false;
  const wait = msUntilAsk(askTime);
  const when = Date.now() + (wait > 0 ? wait : wait + 86_400_000);
  try {
    const registration = await navigator.serviceWorker.ready;
    const options: NotificationWithTrigger = {
      body: QBE_QUESTION,
      tag: "qbe-scheduled",
      icon: withBase("icons/icon-192.png"),
      showTrigger: new triggerCtor(when),
      data: { href: withBase("") },
    };
    await registration.showNotification("Drip by drip", options);
    return true;
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  const ios = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || ios.standalone === true;
}
