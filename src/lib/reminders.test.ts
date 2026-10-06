import { afterEach, describe, expect, it, vi } from "vitest";
import { localDate, msUntilAsk } from "../domain/dates";
import { QBE_QUESTION } from "../domain/types";
import { withBase } from "./base";
import {
  cancelDelayedTestReminder,
  DELAYED_TEST_DELAY_MS,
  DELAYED_TEST_TAG,
  scheduleDelayedTestReminder,
  scheduleTrigger,
  sendTestAskNotification,
  showAskNotification,
} from "./reminders";

type ShownOptions = NotificationOptions & { showTrigger?: { when: number } };
type Shown = { via: "sw" | "window"; title: string; options?: ShownOptions };

function installNotifications(options: {
  permission?: NotificationPermission;
  request?: NotificationPermission;
  worker?: "registered" | "missing" | "throws";
  timestampTrigger?: boolean;
}) {
  const shown: Shown[] = [];
  let permission = options.permission ?? "granted";
  const requested = options.request ?? permission;
  const showNotification = vi.fn(async (title: string, init?: ShownOptions) => {
    if (options.worker === "throws") throw new Error("show failed");
    shown.push({ via: "sw", title, options: init });
  });
  class NotificationMock {
    static requestPermission = vi.fn(async () => {
      permission = requested;
      return requested;
    });
    static get permission() {
      return permission;
    }
    constructor(title: string, init?: NotificationOptions) {
      shown.push({ via: "window", title, options: init });
    }
  }
  class TimestampTrigger {
    when: number;
    constructor(when: number) {
      this.when = when;
    }
  }
  const windowValue: { Notification: typeof NotificationMock; TimestampTrigger?: typeof TimestampTrigger } = {
    Notification: NotificationMock,
  };
  if (options.timestampTrigger) windowValue.TimestampTrigger = TimestampTrigger;
  vi.stubGlobal("Notification", NotificationMock);
  vi.stubGlobal("window", windowValue);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn(async () => (options.worker === "missing" ? undefined : { active: {} })),
      ready: Promise.resolve({ showNotification }),
    },
  });
  return { shown, showNotification, TimestampTrigger };
}

afterEach(() => {
  cancelDelayedTestReminder();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ask notification", () => {
  it("uses the service worker when one is registered", async () => {
    const { shown, showNotification } = installNotifications({ worker: "registered" });
    await expect(showAskNotification()).resolves.toBe(true);
    expect(showNotification).toHaveBeenCalledOnce();
    expect(shown).toEqual([
      {
        via: "sw",
        title: "Drip by drip",
        options: expect.objectContaining({
          body: QBE_QUESTION,
          tag: `qbe-${localDate()}`,
          icon: expect.stringContaining("icons/icon-192.png"),
        }),
      },
    ]);
  });

  it("falls back to the Notification constructor when no worker is registered", async () => {
    const { shown, showNotification } = installNotifications({ worker: "missing" });
    await expect(showAskNotification()).resolves.toBe(true);
    expect(showNotification).not.toHaveBeenCalled();
    expect(shown[0]?.via).toBe("window");
    expect(shown[0]?.options).toEqual(
      expect.objectContaining({
        body: QBE_QUESTION,
        tag: `qbe-${localDate()}`,
      }),
    );
  });
});

describe("test reminder", () => {
  it("is unsupported when the Notification API is missing", async () => {
    vi.stubGlobal("window", {});
    await expect(sendTestAskNotification()).resolves.toBe("unsupported");
  });

  it("asks for permission, then sends without any other side effect", async () => {
    const { shown } = installNotifications({ permission: "default", request: "granted" });
    await expect(sendTestAskNotification()).resolves.toBe("sent");
    expect(shown).toHaveLength(1);
    expect(shown[0]?.via).toBe("sw");
  });

  it("stays quiet when permission is denied or dismissed", async () => {
    const denied = installNotifications({ permission: "default", request: "denied" });
    await expect(sendTestAskNotification()).resolves.toBe("denied");
    expect(denied.shown).toHaveLength(0);

    vi.unstubAllGlobals();
    const dismissed = installNotifications({ permission: "default", request: "default" });
    await expect(sendTestAskNotification()).resolves.toBe("dismissed");
    expect(dismissed.shown).toHaveLength(0);
  });

  it("reports a soft failure when the worker cannot show the notification", async () => {
    installNotifications({ worker: "throws" });
    await expect(sendTestAskNotification()).resolves.toBe("failed");
  });
});

describe("daily trigger schedule", () => {
  it("still schedules the daily ask with TimestampTrigger and its own tag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 12, 0, 0));
    const { shown, TimestampTrigger } = installNotifications({ timestampTrigger: true });
    const wait = msUntilAsk("15:30");
    await expect(scheduleTrigger("15:30")).resolves.toBe(true);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.options?.tag).toBe("qbe-scheduled");
    expect(shown[0]?.options?.body).toBe(QBE_QUESTION);
    expect(shown[0]?.options?.showTrigger).toBeInstanceOf(TimestampTrigger);
    expect(shown[0]?.options?.showTrigger?.when).toBe(Date.now() + wait);
  });

  it("does nothing when TimestampTrigger is missing", async () => {
    const { showNotification } = installNotifications({});
    await expect(scheduleTrigger("15:30")).resolves.toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe("one-minute test reminder", () => {
  it("schedules the same ask with TimestampTrigger and a distinct tag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { shown, TimestampTrigger } = installNotifications({ timestampTrigger: true });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("scheduled");
    expect(shown).toEqual([
      {
        via: "sw",
        title: "Drip by drip",
        options: expect.objectContaining({
          body: QBE_QUESTION,
          tag: DELAYED_TEST_TAG,
          icon: expect.stringContaining("icons/icon-192.png"),
          data: { href: withBase("") },
        }),
      },
    ]);
    expect(DELAYED_TEST_TAG).not.toBe(`qbe-${localDate()}`);
    expect(DELAYED_TEST_TAG).not.toBe("qbe-scheduled");
    expect(shown[0]?.options?.showTrigger).toBeInstanceOf(TimestampTrigger);
    expect(shown[0]?.options?.showTrigger?.when).toBe(Date.now() + DELAYED_TEST_DELAY_MS);
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(shown).toHaveLength(1);
  });

  it("falls back to a one-minute page timer that shows the same ask", async () => {
    vi.useFakeTimers();
    const { shown } = installNotifications({ worker: "registered" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("fallback");
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS - 1);
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual([
      {
        via: "sw",
        title: "Drip by drip",
        options: expect.objectContaining({
          body: QBE_QUESTION,
          tag: DELAYED_TEST_TAG,
          icon: expect.stringContaining("icons/icon-192.png"),
          data: { href: withBase("") },
        }),
      },
    ]);
    expect(shown[0]?.options).not.toHaveProperty("showTrigger");
  });

  it("uses the Notification constructor when no worker is registered", async () => {
    vi.useFakeTimers();
    const { shown, showNotification } = installNotifications({ worker: "missing" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("fallback");
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(showNotification).not.toHaveBeenCalled();
    expect(shown[0]?.via).toBe("window");
    expect(shown[0]?.options).toEqual(
      expect.objectContaining({
        body: QBE_QUESTION,
        tag: DELAYED_TEST_TAG,
      }),
    );
  });

  it("falls back when TimestampTrigger exists but no service worker is installed", async () => {
    vi.useFakeTimers();
    const { shown } = installNotifications({ timestampTrigger: true, worker: "missing" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("fallback");
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(shown[0]?.via).toBe("window");
    expect(shown[0]?.options?.tag).toBe(DELAYED_TEST_TAG);
  });

  it("can cancel the page timer before it fires", async () => {
    vi.useFakeTimers();
    const { shown } = installNotifications({ worker: "missing" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("fallback");
    cancelDelayedTestReminder();
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(shown).toHaveLength(0);
  });

  it("replaces a pending page timer so only the latest one fires", async () => {
    vi.useFakeTimers();
    const { shown } = installNotifications({ worker: "missing" });
    await scheduleDelayedTestReminder();
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS / 2);
    await scheduleDelayedTestReminder();
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS / 2);
    expect(shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS / 2);
    expect(shown).toHaveLength(1);
  });

  it("is unsupported when the Notification API is missing", async () => {
    vi.stubGlobal("window", {});
    await expect(scheduleDelayedTestReminder()).resolves.toBe("unsupported");
  });

  it("asks for permission, then schedules", async () => {
    const { shown } = installNotifications({ permission: "default", request: "granted", timestampTrigger: true });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("scheduled");
    expect(shown).toHaveLength(1);
    expect(shown[0]?.options?.tag).toBe(DELAYED_TEST_TAG);
  });

  it("stays quiet when permission is denied or dismissed", async () => {
    vi.useFakeTimers();
    const denied = installNotifications({ permission: "default", request: "denied" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("denied");
    expect(denied.shown).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(denied.shown).toHaveLength(0);

    vi.unstubAllGlobals();
    const dismissed = installNotifications({ permission: "default", request: "default" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("dismissed");
    expect(dismissed.shown).toHaveLength(0);
  });

  it("reports a soft failure when the triggered notification cannot be shown", async () => {
    vi.useFakeTimers();
    const { shown } = installNotifications({ timestampTrigger: true, worker: "throws" });
    await expect(scheduleDelayedTestReminder()).resolves.toBe("failed");
    await vi.advanceTimersByTimeAsync(DELAYED_TEST_DELAY_MS);
    expect(shown).toHaveLength(0);
  });
});
