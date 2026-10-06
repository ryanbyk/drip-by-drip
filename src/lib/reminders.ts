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

export async function showAskNotification(): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const title = "Drip by drip";
  const options: NotificationOptions = {
    body: QBE_QUESTION,
    tag: `qbe-${localDate()}`,
    icon: withBase("icons/icon-192.png"),
    data: { href: withBase("") },
  };
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }
  new Notification(title, options);
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
