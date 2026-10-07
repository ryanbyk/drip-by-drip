import { FunctionsHttpError } from "@supabase/supabase-js";
import { validTimeZone } from "../domain/askPush";
import { supabase } from "./supabaseClient";

export type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  time_zone: string | null;
};

export type WebPushSyncResult = "subscribed" | "cleared" | "unconfigured" | "failed";

export type TestWebPushResult = "sent" | "none" | "unconfigured" | "failed" | "signed-out";

export function browserTimeZone(): string {
  try {
    return validTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "";
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function shouldMaintainPush(input: {
  signedIn: boolean;
  remindersOn: boolean;
  permission: NotificationPermission | "unsupported";
  pushSupported: boolean;
}): boolean {
  return input.pushSupported && input.signedIn && input.remindersOn && input.permission === "granted";
}

export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function pushRowFromSubscription(
  userId: string,
  subscription: { endpoint?: string | null; keys?: { p256dh?: string; auth?: string } | null },
  userAgent: string,
  timeZone: string,
): PushSubscriptionRow | null {
  const endpoint = subscription.endpoint?.trim() ?? "";
  const p256dh = subscription.keys?.p256dh?.trim() ?? "";
  const auth = subscription.keys?.auth?.trim() ?? "";
  if (!userId || !endpoint || !p256dh || !auth) return null;
  if (endpoint.length > 2048 || p256dh.length > 200 || auth.length > 100) return null;
  const zone = validTimeZone(timeZone);
  const agent = userAgent.trim().slice(0, 512);
  return {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: agent || null,
    time_zone: zone || null,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function registrationForPush(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const waitMs = import.meta.env.DEV ? 0 : 4000;
  const started = Date.now();
  do {
    try {
      const existing = await navigator.serviceWorker.getRegistration();
      if (existing) return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
    if (Date.now() - started >= waitMs) return null;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() - started < waitMs);
  return null;
}

async function existingRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) return null;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Drops the browser subscription without touching the server. Account deletion already cascades the row. */
export async function dropLocalPushSubscription(): Promise<void> {
  const registration = await existingRegistration();
  if (!registration || !("pushManager" in registration)) return;
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch {
    // The auth user is already gone. Closing the browser subscription is best-effort.
  }
}

/** Removes this device's subscription while the session still exists. Other devices stay. */
export async function releaseWebPush(knownUserId?: string | null): Promise<string | null> {
  const registration = await existingRegistration();
  let endpoint: string | null = null;
  let subscription: PushSubscription | null = null;
  if (registration && "pushManager" in registration) {
    try {
      subscription = await registration.pushManager.getSubscription();
      endpoint = subscription?.endpoint ?? null;
    } catch {
      endpoint = null;
    }
  }
  const userId = knownUserId === undefined ? await currentUserId() : knownUserId;
  if (userId && endpoint) {
    const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    if (error) return error.message;
  }
  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch {
      // Unsubscribing is best-effort once the server row is gone.
    }
  }
  return null;
}

async function loadPublicKey(): Promise<string | null> {
  const configured = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
  if (configured) return configured;
  const { data, error } = await supabase.functions.invoke<{ publicKey?: string }>("vapid-public-key");
  if (error || typeof data?.publicKey !== "string") return null;
  const key = data.publicKey.trim();
  return key || null;
}

async function upsertRow(row: PushSubscriptionRow): Promise<"ok" | "conflict" | "failed"> {
  const { error } = await supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (!error) return "ok";
  if (error.code === "42501" || error.code === "23505") return "conflict";
  return "failed";
}

async function subscribeWithKey(
  registration: ServiceWorkerRegistration,
  userId: string,
  publicKey: string,
): Promise<WebPushSyncResult> {
  const applicationServerKey = urlBase64ToUint8Array(publicKey) as BufferSource;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  }
  let row = pushRowFromSubscription(userId, subscription.toJSON(), navigator.userAgent, browserTimeZone());
  if (!row) return "failed";
  let outcome = await upsertRow(row);
  if (outcome === "conflict") {
    await subscription.unsubscribe();
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    row = pushRowFromSubscription(userId, subscription.toJSON(), navigator.userAgent, browserTimeZone());
    if (!row) return "failed";
    outcome = await upsertRow(row);
  }
  return outcome === "ok" ? "subscribed" : "failed";
}

/**
 * Saves a Web Push subscription when reminders are on, permission is granted, and
 * someone is signed in. Guests keep the local reminder schedule and are not stored.
 * `userId` comes from the auth session already in memory so a slow `getSession` cannot
 * look like a sign-out and delete the row.
 */
export async function syncWebPush(input: { remindersOn: boolean; userId: string | null }): Promise<WebPushSyncResult> {
  const supported = pushSupported();
  const permission: NotificationPermission | "unsupported" = supported ? Notification.permission : "unsupported";
  const userId = input.userId;
  const maintain = shouldMaintainPush({
    signedIn: Boolean(userId),
    remindersOn: input.remindersOn,
    permission,
    pushSupported: supported,
  });
  if (!maintain || !userId) {
    if (!userId) {
      await dropLocalPushSubscription();
      return "cleared";
    }
    const error = await releaseWebPush(userId);
    return error ? "failed" : "cleared";
  }
  const registration = await registrationForPush();
  if (!registration) return "failed";
  const publicKey = await loadPublicKey();
  if (!publicKey) return "unconfigured";
  try {
    return await subscribeWithKey(registration, userId, publicKey);
  } catch {
    return "failed";
  }
}

export async function sendTestAskPush(): Promise<TestWebPushResult> {
  const userId = await currentUserId();
  if (!userId) return "signed-out";
  const { data, error } = await supabase.functions.invoke<{ sent?: number; error?: string }>("send-ask-push", {
    body: { mode: "test" },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = (error.context as Response | undefined)?.status;
      if (status === 503) return "unconfigured";
      try {
        const body = (await error.context.json()) as { error?: string };
        if (typeof body.error === "string" && body.error.toLowerCase().includes("not configured")) return "unconfigured";
      } catch {
        // Non-JSON body. The generic failure below covers it.
      }
    }
    return "failed";
  }
  return (data?.sent ?? 0) > 0 ? "sent" : "none";
}

export function testWebPushNote(result: Exclude<TestWebPushResult, "sent">): string {
  switch (result) {
    case "none":
      return "There’s no Web Push subscription on this device yet. Turn reminders on, allow notifications, and stay signed in.";
    case "unconfigured":
      return "Web Push isn’t available from the server yet. The reminder on this device still works.";
    case "signed-out":
      return "Sign in to receive a Web Push. The reminder on this device still works without an account.";
    case "failed":
      return "The Web Push couldn’t be sent just now. You can try again in a moment.";
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
