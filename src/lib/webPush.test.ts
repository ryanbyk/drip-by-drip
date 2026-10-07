import { describe, expect, it } from "vitest";
import { pushRowFromSubscription, shouldMaintainPush, urlBase64ToUint8Array } from "./webPush";

describe("web push subscription", () => {
  it("keeps a subscription only for a signed-in reader with reminders allowed", () => {
    expect(
      shouldMaintainPush({
        signedIn: true,
        remindersOn: true,
        permission: "granted",
        pushSupported: true,
      }),
    ).toBe(true);
    expect(
      shouldMaintainPush({
        signedIn: false,
        remindersOn: true,
        permission: "granted",
        pushSupported: true,
      }),
    ).toBe(false);
    expect(
      shouldMaintainPush({
        signedIn: true,
        remindersOn: false,
        permission: "granted",
        pushSupported: true,
      }),
    ).toBe(false);
    expect(
      shouldMaintainPush({
        signedIn: true,
        remindersOn: true,
        permission: "denied",
        pushSupported: true,
      }),
    ).toBe(false);
  });

  it("builds a row the push_subscriptions table can store", () => {
    const row = pushRowFromSubscription(
      "user-1",
      { endpoint: "https://push.example/1", keys: { p256dh: "key", auth: "auth" } },
      `  ${"a".repeat(600)}`,
      "America/Los_Angeles",
    );
    expect(row).toMatchObject({
      user_id: "user-1",
      endpoint: "https://push.example/1",
      p256dh: "key",
      auth: "auth",
      time_zone: "America/Los_Angeles",
    });
    expect(row?.user_agent).toHaveLength(512);
    expect(pushRowFromSubscription("user-1", { endpoint: "https://push.example/1" }, "", "UTC")).toBeNull();
  });

  it("decodes a URL-safe VAPID key into bytes", () => {
    expect(Array.from(urlBase64ToUint8Array("AQIDBA"))).toEqual([1, 2, 3, 4]);
  });
});
