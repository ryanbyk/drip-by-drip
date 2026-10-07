import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NUDGE_NOTES } from "../src/domain/partner";

const migration = readFileSync(new URL("../supabase/migrations/20261006233000_partner_nudges.sql", import.meta.url), "utf8");

describe("partner migration", () => {
  it("locks the same grace notes and does not expose answers", () => {
    for (const note of NUDGE_NOTES) expect(migration).toContain(note);
    expect(migration).toContain("enable row level security");
    expect(migration).not.toContain("user_snapshots");
    const readDays = migration.slice(
      migration.indexOf("create table public.partner_read_days"),
      migration.indexOf("comment on table public.partner_read_days"),
    );
    expect(readDays).toContain("user_id uuid");
    expect(readDays).toContain("day date");
    expect(readDays).not.toMatch(/answer|note|huh|book/i);
    const publicFns = migration.split("create or replace function public.");
    expect(publicFns.length).toBeGreaterThan(1);
    for (const chunk of publicFns.slice(1)) {
      const header = chunk.slice(0, chunk.indexOf("$$"));
      expect(header).toContain("security invoker");
      expect(header).not.toContain("security definer");
    }
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant select on table public.partner_read_days to authenticated");
    expect(migration).not.toContain("grant insert");
    expect(migration).not.toContain("grant update");
  });
});
