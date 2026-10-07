import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const table = readFileSync(new URL("../supabase/migrations/20261007024500_push_subscriptions.sql", import.meta.url), "utf8");
const cron = readFileSync(new URL("../supabase/migrations/20261007024600_send_ask_push_cron.sql", import.meta.url), "utf8");

describe("push subscription migration", () => {
  it("lets a reader manage only their own rows, including delete on sign-out", () => {
    expect(table).toContain("enable row level security");
    expect(table).toContain("references auth.users (id) on delete cascade");
    expect(table).toContain('constraint push_subscriptions_endpoint_key unique (endpoint)');
    expect(table).toContain("for delete");
    expect(table).toContain("create index push_subscriptions_user_id_idx");
    expect(table).toContain("revoke insert (last_sent_on), update (last_sent_on)");
    expect(table).not.toContain("grant select, insert, update, delete on table public.push_subscriptions to anon");
    expect(table).not.toMatch(/eyJ|BEGIN PRIVATE|VAPID_PRIVATE/);
  });

  it("schedules ask-time send from Vault names, not secret values", () => {
    expect(cron).toContain("private.invoke_send_ask_push");
    expect(cron).toContain("security definer");
    expect(cron).toContain("set search_path = ''");
    expect(cron).toContain("push_cron_secret");
    expect(cron).toContain("'send-ask-push'");
    expect(cron).toContain("revoke all on function private.invoke_send_ask_push() from public, anon, authenticated");
    expect(cron).not.toMatch(/eyJ|BEGIN PRIVATE|VAPID_PRIVATE/);
  });
});