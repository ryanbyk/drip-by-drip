import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
const push = readFileSync(new URL("../supabase/functions/send-ask-push/index.ts", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("hosted app wiring", () => {
  it("serves the PWA at the root and points push at the same app url", () => {
    expect(viteConfig).toContain('const base = "/"');
    expect(viteConfig).toContain("id: base");
    expect(viteConfig).toContain("start_url: base");
    expect(viteConfig).toContain("scope: base");
    expect(viteConfig).toContain("legacy-host-redirect");
    expect(indexHtml).toContain("<!-- legacy-host-redirect -->");
    expect(workflow).toContain("VITE_APP_URL");
    expect(push).toContain('from "./appUrl.ts"');
    expect(push).toContain('Deno.env.get("APP_URL")');
  });
});
