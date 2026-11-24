import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20261120165000_issue_report_rate_limit.sql", import.meta.url),
  "utf8",
);
const bucketMigration = readFileSync(
  new URL("../supabase/migrations/20261124083000_issue_attachments_bucket.sql", import.meta.url),
  "utf8",
);

describe("issue report migrations", () => {
  it("keeps hit records private and restricts the RPC to service_role", () => {
    expect(migration).toContain("create table if not exists private.issue_report_hits");
    expect(migration).toContain("revoke all on table private.issue_report_hits from public, anon, authenticated");
    expect(migration).toContain("create or replace function public.consume_issue_report_slot");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.consume_issue_report_slot(text, integer, integer) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.consume_issue_report_slot(text, integer, integer) to service_role",
    );
    expect(migration).not.toMatch(/lin_api_|eyJ|BEGIN PRIVATE/);
  });

  it("creates the issue-attachments bucket with MIME/size limits and no public write policy", () => {
    expect(bucketMigration).toContain("'issue-attachments'");
    expect(bucketMigration).toContain("26214400");
    expect(bucketMigration).toContain("'image/png'");
    expect(bucketMigration).toContain("'image/heic'");
    expect(bucketMigration).toContain("'video/quicktime'");
    expect(bucketMigration).toContain("'video/mp4'");
    expect(bucketMigration).not.toMatch(/create policy/i);
  });
});
