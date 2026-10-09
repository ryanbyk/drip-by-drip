import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { bookPassageSnapshot } from "../src/storybook/fixtures";

function readingSnapshot() {
  const snapshot = bookPassageSnapshot();
  snapshot.prefs.showInAppEsv = false;
  return snapshot;
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

  if (testInfo.project.name === "iphone-se") {
    await page.screenshot({ path: "/opt/cursor/artifacts/sheet-iphone-se-top.png", fullPage: false });
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
  await expect(drip).toBeInViewport();
  await expect(switchButton).toBeInViewport();
  const buttonBox = await switchButton.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);

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
