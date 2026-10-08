import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpushModule from "npm:web-push@3.6.7";
import { appRoot } from "./appUrl.ts";
import {
  askPushDue,
  askPushMessage,
  deadPushStatus,
  validTimeZone,
  zonedClock,
} from "./askPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WebPush = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ) => Promise<unknown>;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string | null;
  last_sent_on: string | null;
};

type SendCounts = { sent: number; skipped: number; removed: number; failed: number };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function webPushClient(mod: unknown): WebPush {
  if (mod && typeof mod === "object" && "sendNotification" in mod) return mod as WebPush;
  if (mod && typeof mod === "object" && "default" in mod) {
    const inner = (mod as { default: unknown }).default;
    if (inner && typeof inner === "object" && "sendNotification" in inner) return inner as WebPush;
  }
  throw new Error("web-push module did not load");
}

function secretsMatch(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function pushStatus(error: unknown): number {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return 0;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : 0;
}

async function loadSubscriptions(admin: SupabaseClient, userId: string | null): Promise<SubscriptionRow[]> {
  const rows: SubscriptionRow[] = [];
  const page = 500;
  for (let from = 0; ; from += page) {
    let query = admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, time_zone, last_sent_on")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SubscriptionRow[];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

async function loadSnapshots(admin: SupabaseClient, userIds: string[]): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  for (let index = 0; index < userIds.length; index += 100) {
    const chunk = userIds.slice(index, index + 100);
    const { data, error } = await admin.from("user_snapshots").select("user_id, payload").in("user_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const record = row as { user_id?: unknown; payload?: unknown };
      if (typeof record.user_id === "string") map.set(record.user_id, record.payload);
    }
  }
  return map;
}

async function deliver(
  webpush: WebPush,
  row: SubscriptionRow,
  message: { title: string; body: string; tag: string },
  url: string,
): Promise<"sent" | "removed" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify({ ...message, url }),
    );
    return "sent";
  } catch (error) {
    if (deadPushStatus(pushStatus(error))) return "removed";
    return "failed";
  }
}

async function sendDue(
  admin: SupabaseClient,
  webpush: WebPush,
  input: { userId: string | null; test: boolean; now: Date },
): Promise<SendCounts> {
  const counts: SendCounts = { sent: 0, skipped: 0, removed: 0, failed: 0 };
  const url = appRoot(Deno.env.get("APP_URL"));
  const subscriptions = await loadSubscriptions(admin, input.userId);
  if (subscriptions.length === 0) return counts;

  const snapshots = input.test
    ? new Map<string, unknown>()
    : await loadSnapshots(admin, [...new Set(subscriptions.map((row) => row.user_id))]);

  for (const row of subscriptions) {
    let message = askPushMessage("ask");
    let sentOn = "";
    if (input.test) {
      const zone = validTimeZone(row.time_zone) || "UTC";
      message = askPushMessage(zonedClock(input.now, zone)?.date ?? "ask");
    } else {
      const decision = askPushDue({
        payload: snapshots.get(row.user_id),
        deviceTimeZone: row.time_zone,
        now: input.now,
        lastSentOn: row.last_sent_on,
      });
      if (!decision.due) {
        counts.skipped += 1;
        continue;
      }
      message = askPushMessage(decision.localDate);
      sentOn = decision.localDate;
    }

    const result = await deliver(webpush, row, message, url);
    if (result === "removed") {
      await admin.from("push_subscriptions").delete().eq("id", row.id);
      counts.removed += 1;
      continue;
    }
    if (result === "failed") {
      counts.failed += 1;
      continue;
    }
    counts.sent += 1;
    if (sentOn) {
      await admin.from("push_subscriptions").update({ last_sent_on: sentOn }).eq("id", row.id);
    }
  }
  return counts;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:drip@ryanbyk.github.io";
  const cronSecret = Deno.env.get("PUSH_CRON_SECRET")?.trim() ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server is missing auth configuration." }, 500);
  if (!vapidPublic || !vapidPrivate) return json({ error: "Web Push is not configured." }, 503);

  let body: { mode?: unknown } = {};
  try {
    body = (await req.json()) as { mode?: unknown };
  } catch {
    body = {};
  }
  const mode = body.mode === "test" || body.mode === "schedule" ? body.mode : null;
  if (!mode) return json({ error: "Expected mode test or schedule." }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let webpush: WebPush;
  try {
    webpush = webPushClient(webpushModule);
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch {
    return json({ error: "Web Push is not configured." }, 503);
  }

  try {
    if (mode === "test") {
      const authorization = req.headers.get("Authorization");
      if (!authorization) return json({ error: "Missing authorization." }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return json({ error: "You need to be signed in to send a test push." }, 401);
      const counts = await sendDue(admin, webpush, { userId: data.user.id, test: true, now: new Date() });
      return json(counts);
    }

    const provided = req.headers.get("x-cron-secret")?.trim() ?? "";
    if (!cronSecret || !secretsMatch(provided, cronSecret)) return json({ error: "Unauthorized." }, 401);
    const counts = await sendDue(admin, webpush, { userId: null, test: false, now: new Date() });
    return json(counts);
  } catch {
    return json({ error: "Couldn’t send Web Push just now." }, 500);
  }
});
