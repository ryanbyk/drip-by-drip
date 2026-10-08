import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20261008132400_group_plans_notes.sql", import.meta.url),
  "utf8",
);

const tables = [
  "public.group_plans",
  "public.group_plan_follows",
  "public.group_plan_reads",
  "public.shared_notes",
  "public.shared_note_groups",
  "public.shared_note_partners",
];

describe("group plan and shared note migration", () => {
  it("keeps one plan per group and stores only the note text", () => {
    expect(migration).toContain("group_id uuid not null unique");
    expect(migration).toContain("pace in ('verses', 'chapter', 'two')");
    expect(migration).toContain("reading_days between 1 and 127");
    expect(migration).toContain("mode in ('group', 'start')");
    expect(migration).toContain("constraint shared_notes_body");
    expect(migration).toContain("No answer, Not today, Huh?, or book");
    expect(migration).not.toMatch(/create table public\.shared_notes \([\s\S]*?huh/);
  });

  it("enables RLS and leaves public functions as invokers", () => {
    for (const table of tables) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`grant select on table ${table} to authenticated`);
    }
    expect(migration).not.toContain("grant insert");
    expect(migration).not.toContain("grant update");
    expect(migration).not.toContain("grant delete");
    const publicFns = migration.split("create or replace function public.");
    expect(publicFns.length).toBeGreaterThan(1);
    for (const chunk of publicFns.slice(1)) {
      const header = chunk.slice(0, chunk.indexOf("$$"));
      expect(header).toContain("security invoker");
      expect(header).not.toContain("security definer");
    }
    const definers = migration.split("security definer");
    for (const chunk of definers.slice(0, -1)) {
      const header = chunk.slice(Math.max(0, chunk.lastIndexOf("create or replace function")));
      expect(header).toContain("function private.");
    }
  });

  it("checks the caller and drops access when membership ends", () => {
    expect(migration).toContain("if uid is null then");
    expect(migration).toContain("private.can_read_note(id)");
    expect(migration).toContain("private.in_group(group_id)");
    expect(migration).toContain("partnership.status = 'active'");
    expect(migration).toContain("member.user_id = auth.uid()");
  });
});
