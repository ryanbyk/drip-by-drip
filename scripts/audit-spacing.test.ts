import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PEN_SPACING_STEPS, auditRepo, auditSources, parseSpaceTokens } from "./audit-spacing.mjs";

const root = `:root {\n${PEN_SPACING_STEPS.map((step) => `  --space-${step}: ${step}px;`).join("\n")}\n}\n`;

function css(body: string) {
  return [{ path: "src/index.css", source: `${root}${body}` }];
}

describe("spacing audit", () => {
  it("rejects a raw padding length and accepts the matching token", () => {
    const raw = auditSources(css(".card { padding: 16px; }"), []);
    expect(raw.ok).toBe(false);
    expect(raw.errors[0]?.message).toContain("16px");

    const token = auditSources(css(".card { padding: var(--space-16); }"), []);
    expect(token.ok).toBe(true);
  });

  it("allows a one-off marked on the same line and ignores non-spacing lengths", () => {
    const allowed = auditSources(
      css(".ripple { top: 75px; /* spacing-allow: pen ripple art */ border: 1px solid; font-size: 16px; width: 24px; }"),
      [],
    );
    expect(allowed.ok).toBe(true);
  });

  it("allows zero, auto, and safe-area calc built from tokens", () => {
    const result = auditSources(
      css(".screen { margin: 0; padding: 0px; gap: calc(var(--space-18) + env(safe-area-inset-top)) var(--space-24); }"),
      [],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown space token and a raw inline style", () => {
    const unknown = auditSources(css(".card { gap: var(--space-15); }"), []);
    expect(unknown.ok).toBe(false);

    const inline = auditSources(css(""), [
      { path: "src/Widget.tsx", source: `export function Widget() { return <div style={{ padding: "16px" }} />; }` },
    ]);
    expect(inline.ok).toBe(false);
    expect(inline.errors.some((error) => error.file.endsWith("Widget.tsx"))).toBe(true);
  });

  it("rejects a scale that drifts from the pen steps", () => {
    const drifted = auditSources(
      [{ path: "src/index.css", source: ":root { --space-4: 4px; --space-8: 10px; }\n.card { padding: var(--space-4); }\n" }],
      [],
    );
    expect(drifted.ok).toBe(false);
    expect(drifted.errors.some((error) => error.message.includes("drip-by-drip.pen"))).toBe(true);
  });

  it("parses the token block and the repo stylesheet stays clean", () => {
    const tokens = parseSpaceTokens(readFileSync(new URL("../src/index.css", import.meta.url), "utf8"));
    expect([...tokens.keys()]).toEqual(PEN_SPACING_STEPS);
    expect(auditRepo().ok).toBe(true);
  });
});
