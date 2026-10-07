import type { NotificationState } from "../domain/types";

export type ReminderDevice = "ios-tab" | "ios-home" | "browser";

export function reminderDevice(ios: boolean, standalone: boolean): ReminderDevice {
  if (ios && !standalone) return "ios-tab";
  if (ios) return "ios-home";
  return "browser";
}

export function reminderCopy(input: {
  state: NotificationState;
  enabled: boolean;
  supported: boolean;
  signedIn: boolean;
  device: ReminderDevice;
}): string {
  if (!input.supported || input.state === "unsupported") {
    return "This browser can’t send reminders. The question will be here whenever you open the app.";
  }
  if (input.state === "denied") {
    return "Reminders are blocked in this browser. Allow notifications for this site in your browser settings, then turn them on here. We won’t keep asking.";
  }
  if (input.device === "ios-tab") {
    return "On iPhone, reminders and Web Push work after you add Drip by drip to your Home Screen. iOS does not deliver Web Push from a Safari tab. The notification is only the daily question.";
  }
  if (input.enabled && input.signedIn && input.device === "ios-home") {
    return "At your ask time, the reminder is the question itself. Web Push can arrive while this Home Screen app is closed, when iOS allows it.";
  }
  if (input.enabled && input.signedIn) {
    return "At your ask time, the reminder is the question itself. Where this browser supports Web Push, it can arrive even when the app is closed.";
  }
  if (input.enabled && input.device === "ios-home") {
    return "At your ask time, the reminder is the question itself, on this device. Sign in to receive a Web Push while the Home Screen app is closed. iOS may still hold it.";
  }
  if (input.enabled) {
    return "At your ask time, the reminder is the question itself, on this device. Sign in to also receive a Web Push when the app is closed, where this browser supports it. iPhone only does that from the Home Screen app.";
  }
  return "Turn this on for one daily reminder. It asks the question — it doesn’t scold. With an account, Web Push can deliver it after the app is closed, where the browser supports it. On iPhone, that requires the Home Screen app.";
}
