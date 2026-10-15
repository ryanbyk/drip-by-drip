import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NUDGE_NOTES } from "../src/domain/partner";
import { DROP_DAILY_LIMIT, GROUP_MEMBER_CAP, PARTNER_CAP } from "../src/domain/social";

const migration = readFileSync(new URL("../supabase/migrations/20261008023955_social_layer.sql", import.meta.url), "utf8");

describe("social migration", () => {
  it("keeps the v1.5b caps in one place and copies existing notes into drops", () => {
    expect(migration).toContain(`select ${GROUP_MEMBER_CAP}`);
    expect(migration).toContain(`select ${PARTNER_CAP}`);
    expect(DROP_DAILY_LIMIT).toBe(1);
    expect(migration).toContain("unique (sender_id, recipient_id, day)");
    expect(migration).toContain("insert into public.drops");
    expect(migration).toContain("from public.partner_nudges");
    expect(migration).toContain("drop index if exists public.partnerships_active_low_idx");
    expect(migration).toContain("drop index if exists public.partnerships_active_high_idx");
    expect(migration).toContain("partnerships_active_pair_idx");
    for (const note of NUDGE_NOTES) expect(migration).toContain(note);
  });

  it("enables RLS, keeps writes off the client, and leaves public functions invoker", () => {
    for (const table of ["public.groups", "public.group_members", "public.group_invites", "public.drops"]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`grant select on table ${table} to authenticated`);
    }
    expect(migration).not.toContain("grant insert");
    expect(migration).not.toContain("grant update");
    expect(migration).not.toContain("grant delete");
    expect(migration).toContain("set search_path = ''");
    const publicFns = migration.split("create or replace function public.");
    expect(publicFns.length).toBeGreaterThan(1);
    for (const chunk of publicFns.slice(1)) {
      const header = chunk.slice(0, chunk.indexOf("$$"));
      expect(header).toContain("security invoker");
      expect(header).not.toContain("security definer");
    }
    const definers = migration.split("security definer");
    expect(definers.length).toBeGreaterThan(2);
    for (const chunk of definers.slice(0, -1)) {
      const header = chunk.slice(Math.max(0, chunk.lastIndexOf("create or replace function")));
      expect(header).toContain("function private.");
    }
  });

  it("does not add an answer, note, or book column to the read-today signal", () => {
    expect(migration).not.toMatch(/alter table public\.partner_read_days[\s\S]*answer/i);
    expect(migration).toContain("Group members read each other’s recent read days");
    expect(migration).toContain("No answers, notes, or books");
    expect(migration).toContain("if uid is null then");
  });
});
