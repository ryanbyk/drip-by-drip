import { afterEach, describe, expect, it, vi } from "vitest";
import { localDate } from "../domain/dates";
import { QBE_QUESTION } from "../domain/types";
import { sendTestAskNotification, showAskNotification } from "./reminders";

type Shown = { via: "sw" | "window"; title: string; options?: NotificationOptions };

function installNotifications(options: {
  permission?: NotificationPermission;
  request?: NotificationPermission;
  worker?: "registered" | "missing" | "throws";
}) {
  const shown: Shown[] = [];
  let permission = options.permission ?? "granted";
  const requested = options.request ?? permission;
  const showNotification = vi.fn(async (title: string, init?: NotificationOptions) => {
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
  vi.stubGlobal("Notification", NotificationMock);
  vi.stubGlobal("window", { Notification: NotificationMock });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn(async () => (options.worker === "missing" ? undefined : { active: {} })),
      ready: Promise.resolve({ showNotification }),
    },
  });
  return { shown, showNotification };
}

afterEach(() => {
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
