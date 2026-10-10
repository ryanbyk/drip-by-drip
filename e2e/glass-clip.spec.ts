import { expect, test, type Locator, type Page } from "@playwright/test";
import { bookPassageSnapshot } from "../src/storybook/fixtures";

const shotDir = "/opt/cursor/artifacts/glass-clip";

type Box = { top: number; left: number; right: number; bottom: number; width: number; height: number };

type PseudoClip = {
  pseudo: string;
  paints: boolean;
  outside: boolean;
  matchesHost: boolean;
  extendsPast: boolean;
  layout: Box | null;
  visible: Box | null;
};

type GlassClip = {
  className: string;
  isGlass: boolean;
  webkit: boolean;
  overflowHidden: boolean;
  backdrop: string;
  shadow: string;
  pointer: string;
  width: number;
  height: number;
  pseudos: PseudoClip[];
};

function clipReport(): GlassClip[] {
  const webkit = CSS.supports("-webkit-hyphens", "none");
  const num = (value: string) => (value === "auto" ? null : Number.parseFloat(value));

  function boxOf(top: number, left: number, width: number, height: number): Box {
    return { top, left, width, height, right: left + width, bottom: top + height };
  }

  function intersect(a: Box, b: Box): Box {
    const top = Math.max(a.top, b.top);
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    return boxOf(top, left, right - left, bottom - top);
  }

  function near(a: number, b: number, slop: number) {
    return Math.abs(a - b) <= slop;
  }

  return [...document.querySelectorAll(".glass, .status-glass")].map((el) => {
    const host = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    const pad = boxOf(
      host.top + borderTop,
      host.left + borderLeft,
      Math.max(0, host.width - borderLeft - borderRight),
      Math.max(0, host.height - borderTop - borderBottom),
    );
    const hostBox = boxOf(host.top, host.left, host.width, host.height);
    const overflowHidden = style.overflowX === "hidden" || style.overflowY === "hidden";
    const slop = Math.max(borderTop, borderRight, borderBottom, borderLeft, 1);
    const pseudos = ["::before", "::after"].map((pseudo) => {
      const layer = getComputedStyle(el, pseudo);
      const paints = layer.content !== "none" && layer.content !== "normal";
      if (!paints || host.width < 1 || host.height < 1) {
        return {
          pseudo,
          paints: false,
          outside: false,
          matchesHost: true,
          extendsPast: false,
          layout: null,
          visible: null,
        };
      }
      const top = num(layer.top);
      const left = num(layer.left);
      const right = num(layer.right);
      const bottom = num(layer.bottom);
      const width = num(layer.width);
      const height = num(layer.height);
      let x = pad.left;
      let w = pad.width;
      if (left != null && width != null) {
        x = pad.left + left;
        w = width;
      } else if (left != null && right != null) {
        x = pad.left + left;
        w = pad.width - left - right;
      } else if (width != null && right != null) {
        w = width;
        x = pad.right - right - width;
      } else if (width != null) w = width;
      let y = pad.top;
      let h = pad.height;
      if (top != null && height != null) {
        y = pad.top + top;
        h = height;
      } else if (bottom != null && height != null) {
        h = height;
        y = pad.bottom - bottom - height;
      } else if (top != null && bottom != null) {
        y = pad.top + top;
        h = pad.height - top - bottom;
      } else if (height != null) h = height;
      const layout = boxOf(y, x, w, h);
      const mask = layer.getPropertyValue("mask-image");
      const prefixed = layer.getPropertyValue("-webkit-mask-image");
      const masked = (mask !== "" && mask !== "none") || (prefixed !== "" && prefixed !== "none");
      const doubled = h > pad.height * 1.5;
      let clip = layout;
      if (overflowHidden) clip = hostBox;
      else if (masked && doubled && (bottom === 0 || top === 0)) clip = pad;
      const visible = intersect(layout, clip);
      const matchesHost =
        visible.width > 0 &&
        visible.height > 0 &&
        near(visible.top, host.top, slop) &&
        near(visible.bottom, host.bottom, slop) &&
        near(visible.left, host.left, slop) &&
        near(visible.right, host.right, slop);
      const outside =
        visible.top < host.top - slop ||
        visible.left < host.left - slop ||
        visible.bottom > host.bottom + slop ||
        visible.right > host.right + slop;
      const extendsPast =
        layout.top < host.top - 8 ||
        layout.bottom > host.bottom + 8 ||
        layout.left < host.left - 8 ||
        layout.right > host.right + 8;
      return { pseudo, paints: true, outside, matchesHost, extendsPast, layout, visible };
    });
    return {
      className: el.className,
      isGlass: el.classList.contains("glass"),
      webkit,
      overflowHidden,
      backdrop: style.backdropFilter,
      shadow: style.boxShadow,
      pointer: style.pointerEvents,
      width: host.width,
      height: host.height,
      pseudos,
    };
  });
}

function expectClipped(rows: GlassClip[], debug: boolean, requireButton = true) {
  const present = rows.filter((row) => row.width > 1 && row.height > 1);
  expect(present.some((row) => row.className.includes("tabbar"))).toBe(true);
  if (requireButton) expect(present.some((row) => row.className.includes("btn"))).toBe(true);
  for (const row of present) {
    for (const pseudo of row.pseudos) {
      expect(pseudo.outside, `${row.className} ${pseudo.pseudo} paints outside`).toBe(false);
      if (!pseudo.paints) continue;
      expect(pseudo.matchesHost, `${row.className} ${pseudo.pseudo} visible box`).toBe(true);
      expect(pseudo.extendsPast, `${row.className} ${pseudo.pseudo} layout`).toBe(true);
    }
    if (!debug && !row.webkit) {
      const before = row.pseudos.find((pseudo) => pseudo.pseudo === "::before");
      expect(before?.paints, `${row.className} samples past the edge`).toBe(true);
    }
    if (debug) {
      const before = row.pseudos.find((pseudo) => pseudo.pseudo === "::before");
      expect(before?.paints, `${row.className} ::before`).toBe(true);
      expect(before?.matchesHost, `${row.className} ::before visible box`).toBe(true);
      expect(before?.extendsPast, `${row.className} ::before layout`).toBe(true);
    }
    if (!row.isGlass) {
      expect(row.pointer).toBe("none");
      if (row.webkit) expect(row.overflowHidden).toBe(true);
      continue;
    }
    expect(row.shadow).not.toBe("none");
    expect(row.pointer).toBe("auto");
    if (!row.webkit) continue;
    expect(row.overflowHidden).toBe(true);
    if (debug) continue;
    expect(row.backdrop).toContain("blur(16px)");
    expect(row.pseudos.every((pseudo) => !pseudo.paints)).toBe(true);
  }
}

const debugPaint = `
  .glass {
    background-color: transparent !important;
    color: transparent !important;
  }
  .glass::before {
    content: "" !important;
    position: absolute !important;
    z-index: 5 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    top: auto !important;
    height: 200% !important;
    background: #ff00ff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    mask-image: none !important;
    -webkit-mask-image: none !important;
    border-radius: 0 !important;
    pointer-events: none !important;
  }
  .status-glass { opacity: 1 !important; }
  .status-glass::before {
    content: "" !important;
    position: absolute !important;
    z-index: 5 !important;
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    bottom: auto !important;
    height: 200% !important;
    background: #00e5ff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    mask-image: none !important;
    -webkit-mask-image: none !important;
    pointer-events: none !important;
  }
`;

test("glass layers stay inside the pill", async ({ page }, testInfo) => {
  await openPassage(page, "light");
  await page.getByRole("button", { name: "Change book" }).click();
  await expect(page.getByRole("dialog", { name: "What you’re reading" })).toBeVisible();
  const rows = await page.evaluate(clipReport);
  expect(rows[0]?.webkit).toBe(!testInfo.project.name.endsWith("-touch"));
  expectClipped(rows, false);
});

for (const theme of ["light", "dark"] as const) {
  test(`debug glass paint is clipped to the pill (${theme})`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(testInfo.project.name.endsWith("-touch"), "WebKit clips the extended layer; Chromium masks it");
    test.skip(theme === "dark" && testInfo.project.name !== "iphone-15", "dark reference shot is iPhone 15");
    await openPassage(page, theme);
    const screen = page.locator(".screen");
    await paintRainbow(screen);
    await screen.evaluate((el) => {
      const bar = el.querySelector<HTMLElement>("[data-glass-sample]");
      const nav = document.querySelector(".tabbar");
      if (!bar || !nav) return;
      const navTop = nav.getBoundingClientRect().top;
      const barTop = bar.getBoundingClientRect().top;
      el.scrollTop += barTop - navTop + bar.getBoundingClientRect().height * 0.45;
    });
    if (testInfo.project.name === "iphone-15") {
      await page.screenshot({ path: `${shotDir}/iphone15-${theme}-nav.png` });
    }
    await page.addStyleTag({ content: debugPaint });
    const navRows = await page.evaluate(clipReport);
    expectClipped(
      navRows.filter((row) => !row.className.includes("btn")),
      true,
      false,
    );
    await expectNoBand(page, ".tabbar", "#ff00ff");
    await expectStripClipped(page, ".status-glass", "#00e5ff");
    if (testInfo.project.name === "iphone-15") {
      await page.screenshot({ path: `${shotDir}/iphone15-${theme}-nav-debug.png` });
    }

    await page.getByRole("button", { name: "Change book" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Change book" }).click();
    const sheet = page.getByRole("dialog", { name: "What you’re reading" });
    await expect(sheet).toBeVisible();
    await paintRainbow(sheet.locator(".sheet-body"));
    await sheet.locator(".sheet-body").evaluate((el) => {
      const bar = el.querySelector<HTMLElement>("[data-glass-sample]");
      const button = el.closest(".sheet")?.querySelector(".footer .btn-primary");
      if (!bar || !button) return;
      const buttonBox = button.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      el.scrollTop += barBox.top + barBox.height / 2 - (buttonBox.top + buttonBox.height / 2);
    });
    const rows = await page.evaluate(clipReport);
    expectClipped(rows, true);
    await expectNoBand(page, ".sheet > .footer button.glass", "#ff00ff");
    if (testInfo.project.name === "iphone-15") {
      await page.screenshot({ path: `${shotDir}/iphone15-${theme}-sheet-debug.png` });
    }
  });
}

async function openPassage(page: Page, theme: "light" | "dark") {
  const snapshot = bookPassageSnapshot();
  snapshot.prefs.showInAppEsv = false;
  snapshot.prefs.appearance = theme;
  await page.addInitScript((stored) => {
    const paintSafeArea = () => {
      const root = document.documentElement;
      if (root.dataset.safeArea === "1") return;
      root.dataset.safeArea = "1";
      const style = document.createElement("style");
      style.textContent = "html{--safe-top:59px !important;--safe-bottom:34px !important}";
      root.appendChild(style);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintSafeArea);
    else paintSafeArea();
    localStorage.setItem("drip-by-drip-snapshot", JSON.stringify(stored));
  }, snapshot);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto("/");
  await expect(page.locator(".tabbar")).toBeVisible();
}

async function paintRainbow(parent: Locator) {
  await parent.evaluate((el) => {
    const bar = document.createElement("div");
    bar.dataset.glassSample = "1";
    bar.style.display = "flex";
    bar.style.height = "140px";
    bar.style.flex = "none";
    bar.style.width = "100%";
    for (const color of ["#e03131", "#f08c00", "#f2c94c", "#2f9e44", "#1971c2", "#7048e8", "#c2255c"]) {
      const cell = document.createElement("div");
      cell.style.flex = "1";
      cell.style.background = color;
      bar.appendChild(cell);
    }
    el.appendChild(bar);
  });
}

async function expectStripClipped(page: Page, selector: string, hex: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const samples = await colorsAt(page, [
    { name: "inside", x: box.x + box.width / 2, y: box.y + Math.min(12, box.height / 2) },
    { name: "below", x: box.x + box.width / 2, y: box.y + box.height + 16 },
  ]);
  const inside = samples.find((sample) => sample.name === "inside");
  const below = samples.find((sample) => sample.name === "below");
  expect(matches(below, hex), `${selector} below ${JSON.stringify(below)}`).toBe(false);
  expect(matches(inside, hex), `${selector} inside ${JSON.stringify(inside)}`).toBe(true);
}

function matches(sample: { r: number; g: number; b: number } | undefined, hex: string) {
  const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  if (!sample) return false;
  return Math.abs(sample.r - red) < 40 && Math.abs(sample.g - green) < 40 && Math.abs(sample.b - blue) < 40;
}

async function expectNoBand(page: Page, selector: string, hex: string) {
  const target = page.locator(selector).first();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const samples = await colorsAt(page, [
    { name: "above", x: box.x + box.width / 2, y: box.y - 10 },
    { name: "corner", x: box.x + 2, y: box.y + 2 },
    { name: "inside", x: box.x + box.width / 2, y: box.y + box.height / 2 },
  ]);
  const above = samples.find((sample) => sample.name === "above");
  const corner = samples.find((sample) => sample.name === "corner");
  const inside = samples.find((sample) => sample.name === "inside");
  expect(matches(above, hex), `${selector} above ${JSON.stringify(above)}`).toBe(false);
  expect(matches(corner, hex), `${selector} corner ${JSON.stringify(corner)}`).toBe(false);
  expect(matches(inside, hex), `${selector} inside ${JSON.stringify(inside)}`).toBe(true);
}

async function colorsAt(page: Page, points: { name: string; x: number; y: number }[]) {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) return [];
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      return points.map((point) => {
        const x = Math.min(image.width - 1, Math.max(0, Math.round(point.x * scale)));
        const y = Math.min(image.height - 1, Math.max(0, Math.round(point.y * scale)));
        const pixel = context.getImageData(x, y, 1, 1).data;
        return { name: point.name, r: pixel[0] ?? 0, g: pixel[1] ?? 0, b: pixel[2] ?? 0 };
      });
    },
    { png, points },
  );
}
