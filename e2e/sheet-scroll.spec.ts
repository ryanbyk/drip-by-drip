import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { bookPassageSnapshot } from "../src/storybook/fixtures";

function readingSnapshot() {
  const snapshot = bookPassageSnapshot();
  snapshot.prefs.showInAppEsv = false;
  snapshot.prefs.appearance = "light";
  return snapshot;
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((next) => {
    document.documentElement.dataset.theme = next;
  }, theme);
}

function channel(hex: string, index: number) {
  return Number.parseInt(hex.slice(index, index + 2), 16);
}

function luminance(hex: string) {
  const linear = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(channel(hex, 0)) + 0.7152 * linear(channel(hex, 2)) + 0.0722 * linear(channel(hex, 4));
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(foreground: string, background: string, alpha: number) {
  const mix = (index: number) => Math.round(channel(foreground, index) * alpha + channel(background, index) * (1 - alpha));
  return [0, 2, 4].map((index) => mix(index).toString(16).padStart(2, "0")).join("");
}

async function expectGlassButton(sheet: Locator, theme: "light" | "dark") {
  const glass = await sheet.locator(".footer .btn-primary").evaluate((button) => {
    const footer = button.parentElement;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const style = getComputedStyle(button);
    const root = getComputedStyle(document.documentElement);
    const css = [...document.querySelectorAll("style")].map((node) => node.textContent ?? "").join("\n");
    const nav = document.querySelector(".tabbar");
    const navStyle = nav ? getComputedStyle(nav) : null;
    return {
      footerBackground: footerStyle?.backgroundColor ?? "",
      footerBackdrop: footerStyle?.backdropFilter ?? "",
      footerPointer: footerStyle?.pointerEvents ?? "",
      background: style.backgroundColor,
      color: style.color,
      weight: style.fontWeight,
      borderWidth: style.borderTopWidth,
      borderStyle: style.borderTopStyle,
      shadow: style.boxShadow,
      backdrop: style.backdropFilter,
      radius: style.borderRadius,
      navBackdrop: navStyle?.backdropFilter ?? "",
      navBackground: navStyle?.backgroundColor ?? "",
      navBorder: navStyle?.borderTopWidth ?? "",
      accent: root.getPropertyValue("--accent").trim(),
      glass: root.getPropertyValue("--glass").trim(),
      navShadow: navStyle?.boxShadow ?? "",
      glassRule: /\.glass\s*\{[^}]*\}/.exec(css)?.[0] ?? "",
      tabRule: /\.tabbar\s*\{[^}]*\}/.exec(css)?.[0] ?? "",
    };
  });
  expect(glass.footerBackground).toBe("rgba(0, 0, 0, 0)");
  expect(glass.footerBackdrop).toBe("none");
  expect(glass.footerPointer).toBe("none");
  expect(glass.backdrop).toContain("blur(16px)");
  expect(glass.navBackdrop).toBe(glass.backdrop);
  expect(glass.navBackground).toBe(glass.background);
  expect(glass.navBorder).toBe("1px");
  expect(glass.navShadow).toBe(glass.shadow);
  expect(glass.glassRule).toContain("background: var(--glass)");
  expect(glass.glassRule).toContain("border: 1px solid var(--line)");
  expect(glass.glassRule).toContain("box-shadow: var(--shadow)");
  expect(glass.glassRule).toContain("backdrop-filter: blur(16px)");
  expect(glass.glassRule).toContain("-webkit-backdrop-filter: blur(16px)");
  expect(glass.tabRule).not.toContain("backdrop-filter");
  expect(glass.borderWidth).toBe("1px");
  expect(glass.borderStyle).toBe("solid");
  expect(glass.shadow).not.toBe("none");
  expect(glass.weight).toBe("600");
  expect(glass.radius).toBe("28px");
  const accent = glass.accent.replace("#", "");
  const fill = glass.glass.replace("#", "").slice(0, 6);
  if (theme === "light") {
    expect(glass.background).toMatch(/255,\s*253,\s*248/);
    expect(glass.color).toMatch(/46,\s*92,\s*97/);
  } else {
    expect(glass.background).toMatch(/26,\s*36,\s*39/);
    expect(glass.color).toMatch(/140,\s*195,\s*194/);
  }
  const alpha = Number.parseInt(glass.glass.replace("#", "").slice(6, 8), 16) / 255;
  for (const ground of ["ffffff", "000000", accent]) {
    expect(contrast(accent, blend(fill, ground, alpha))).toBeGreaterThanOrEqual(4.5);
  }
}

async function openBookSheet(page: Page) {
  await page.addInitScript((stored) => {
    localStorage.setItem("drip-by-drip-snapshot", JSON.stringify(stored));
  }, readingSnapshot());
  await page.goto("/");
  await page.getByRole("button", { name: "Change book" }).click();
  const sheet = page.getByRole("dialog", { name: "What you’re reading" });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function pointIn(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Missing box for scroll gesture");
  return { x: box.x + box.width / 2, y: box.y + Math.min(36, box.height / 2) };
}

/** Trusted scroll gesture. WebKit uses the wheel; Chromium iPhone emulation uses a touch swipe. */
async function scrollByGesture(page: Page, target: Locator, distance: number, testInfo: TestInfo) {
  const start = await pointIn(target);
  if (testInfo.project.name.endsWith("-touch")) {
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }],
    });
    const steps = 8;
    for (let step = 1; step <= steps; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x, y: start.y - (distance * step) / steps }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.wheel(0, distance);
}

test("the book sheet body touch-scrolls and the page behind stays put", async ({ page }, testInfo) => {
  const sheet = await openBookSheet(page);
  const body = sheet.locator(".sheet-body");
  const screen = page.locator(".screen");

  await expect(page.locator(".screen .sheet")).toHaveCount(0);
  await expect(page.locator("body > .scrim .sheet-body")).toHaveCount(1);
  await expect(page.locator("html")).toHaveClass(/sheet-open/);

  const metrics = await body.evaluate((el) => {
    const style = getComputedStyle(el);
    const css = [...document.querySelectorAll("style")].map((node) => node.textContent ?? "").join("\n");
    return {
      overflowY: style.overflowY,
      minHeight: style.minHeight,
      overscroll: style.overscrollBehavior,
      declaredTouchScroll: css.includes("-webkit-overflow-scrolling: touch"),
      touchAction: style.touchAction,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  });
  expect(metrics.overflowY).toBe("auto");
  expect(metrics.minHeight).toBe("0px");
  expect(metrics.overscroll).toBe("contain");
  expect(metrics.declaredTouchScroll).toBe(true);
  expect(metrics.touchAction).toBe("pan-y");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 40);

  const sheetMax = await sheet.evaluate((el) => Number.parseFloat(getComputedStyle(el).maxHeight));
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(sheetMax).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
  expect(sheetMax).toBeGreaterThan(240);

  const screenBefore = await screen.evaluate((el) => el.scrollTop);
  const switchButton = sheet.locator(".footer .btn-primary");
  await expect(switchButton).toBeVisible();

  await expectGlassButton(sheet, "light");

  const phone = testInfo.project.name === "iphone-se" || testInfo.project.name === "iphone-15" ? testInfo.project.name : null;
  if (phone) {
    const parked = await sheet.locator(".book-picker").evaluate((picker) => {
      const button = picker.closest(".sheet")?.querySelector(".footer .btn-primary");
      const card = [...picker.querySelectorAll(".book-row.is-active")].at(-1);
      if (!button || !card) return false;
      const delta = card.getBoundingClientRect().top - button.getBoundingClientRect().top - 6;
      picker.scrollTop += delta;
      const box = button.getBoundingClientRect();
      const cell = card.getBoundingClientRect();
      const overlap = Math.min(box.bottom, cell.bottom) - Math.max(box.top, cell.top);
      return overlap > 24 && cell.left < box.right - 8 && cell.right > box.left + 8;
    });
    expect(parked).toBe(true);
    await page.screenshot({ path: `/opt/cursor/artifacts/${phone}-light-glass-button.png`, fullPage: false });
    await setTheme(page, "dark");
    await expectGlassButton(sheet, "dark");
    await page.screenshot({ path: `/opt/cursor/artifacts/${phone}-dark-glass-button.png`, fullPage: false });
    await setTheme(page, "light");
  }

  const choices = sheet.getByRole("group", { name: "Where to start" });
  let scrolled = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const atEnd = await body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    if (atEnd && scrolled > 40) break;
    await scrollByGesture(page, choices, 400, testInfo);
    scrolled = await body.evaluate((el) => el.scrollTop);
  }
  expect(scrolled).toBeGreaterThan(40);

  const drip = sheet.getByText("Daily drip size");
  const chips = sheet.getByRole("group", { name: "Daily drip size" });
  await expect(drip).toBeInViewport();
  await expect(switchButton).toBeInViewport();
  const buttonBox = await switchButton.boundingBox();
  const chipsBox = await chips.boundingBox();
  const footerBox = await sheet.locator(".footer").boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(chipsBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
  expect((chipsBox?.y ?? 0) + (chipsBox?.height ?? 0)).toBeLessThanOrEqual((footerBox?.y ?? 0) + 2);

  expect(await screen.evaluate((el) => el.scrollTop)).toBe(screenBefore);

  if (testInfo.project.name === "iphone-se") {
    await page.screenshot({ path: "/opt/cursor/artifacts/sheet-iphone-se-bottom.png", fullPage: false });
  }

  await sheet.getByRole("button", { name: "Pick another chapter" }).click();
  const chapter = page.getByRole("dialog", { name: /Where in / });
  await expect(chapter).toBeVisible();
  const chapterBody = chapter.locator(".sheet-body");
  const chapterStyle = await chapterBody.evaluate((el) => getComputedStyle(el).overflowY);
  expect(chapterStyle).toBe("auto");
  const start = chapter.locator(".footer .btn-primary");
  await expect(start).toBeInViewport();
  const chapterOverflows = await chapterBody.evaluate((el) => el.scrollHeight > el.clientHeight + 8);
  if (chapterOverflows) {
    const grid = chapter.locator(".ch-grid");
    let chapterScrolled = 0;
    for (let attempt = 0; attempt < 6 && chapterScrolled <= 20; attempt += 1) {
      await scrollByGesture(page, grid, 240, testInfo);
      chapterScrolled = await chapterBody.evaluate((el) => el.scrollTop);
    }
    expect(chapterScrolled).toBeGreaterThan(20);
    await expect(start).toBeInViewport();
  }
});
