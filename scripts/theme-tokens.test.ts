import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/** Dark values from the Design Tokens frame in drip-by-drip.pen. */
const DARK_TOKENS: Record<string, string> = {
  "--bg": "#121a1c",
  "--surface": "#1a2427",
  "--ink": "#ece6da",
  "--muted": "#a9b2af",
  "--faint": "#6f7b79",
  "--line": "#2b393c",
  "--accent": "#8cc3c2",
  "--accent-soft": "#1d3638",
  "--drop": "#5c9395",
  "--warm": "#d9b97f",
  "--warm-soft": "#d9b97f24",
  "--warm-ink": "#e2c48e",
  "--subtle": "#243134",
  "--caution": "#d9a283",
  "--scrim": "#000000a6",
  "--glass": "#1a2427d9",
  "--knob": "#ece6da",
  "--on-accent": "#0e1d1f",
  "--shadow": "0 6px 20px #00000066",
};

function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1], match[2].trim());
  }
  return found;
}

function block(selector: string): string {
  const pattern = new RegExp(`${selector}\\s*\\{([^}]*)\\}`);
  return css.match(pattern)?.[1] ?? "";
}

describe("design tokens", () => {
  it("keeps the light accent and page background from the pen", () => {
    const root = block(":root");
    expect(root).toContain("--accent: #2e5c61");
    expect(root).toContain("--bg: #f5f1e8");
    expect(root).toContain("--on-accent: #fffdf8");
  });

  it("applies the same dark tokens for Dark and for System in dark mode", () => {
    const dark = declarations(block(':root\\[data-theme="dark"\\]'));
    const system = declarations(block(':root\\[data-theme="system"\\]'));
    for (const [name, value] of Object.entries(DARK_TOKENS)) {
      expect(dark.get(name), name).toBe(value);
      expect(system.get(name), name).toBe(value);
    }
    expect(css).toContain("@media (prefers-color-scheme: dark)");
  });
});
