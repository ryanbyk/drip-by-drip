import { expect, test, type Locator } from "@playwright/test";
import { bookPassageSnapshot } from "../src/storybook/fixtures";

const shotDir = process.env.GLASS_DIR ?? "/opt/cursor/artifacts";

for (const theme of ["light", "dark"] as const) {
  test(`samples color through the nav and the sheet button (${theme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iphone-15" && process.env.GLASS_ALL !== "1", "WebKit iPhone 15 reference shots");
    const snapshot = bookPassageSnapshot();
    snapshot.prefs.showInAppEsv = false;
    snapshot.prefs.appearance = theme;
    await page.addInitScript(preparePage, snapshot);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");

    const screen = page.locator(".screen");
    await expect(screen).toBeVisible();
    await paintRainbow(screen);
    await screen.evaluate((el) => {
      const bar = el.querySelector<HTMLElement>("[data-glass-sample]");
      const nav = document.querySelector(".tabbar");
      if (!bar || !nav) return;
      const navTop = nav.getBoundingClientRect().top;
      const barTop = bar.getBoundingClientRect().top;
      el.scrollTop += barTop - navTop + bar.getBoundingClientRect().height * 0.45;
    });
    await expect(page.locator("[data-glass-sample]").first()).toBeVisible();
    await page.screenshot({ path: `${shotDir}/iphone15-${theme}-nav.png`, fullPage: false });

    await page.getByRole("button", { name: "Change book" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Change book" }).click();
    const sheet = page.getByRole("dialog", { name: "What you’re reading" });
    await expect(sheet).toBeVisible();
    const body = sheet.locator(".sheet-body");
    await paintRainbow(body);
    const sheetOverlap = await body.evaluate((el) => {
      const bar = el.querySelector<HTMLElement>("[data-glass-sample]");
      const button = el.closest(".sheet")?.querySelector(".footer .btn-primary");
      if (!bar || !button) return null;
      const buttonBox = button.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      const buttonMid = buttonBox.top + buttonBox.height / 2;
      const barMid = barBox.top + barBox.height / 2;
      el.scrollTop += barMid - buttonMid;
      const nextBar = bar.getBoundingClientRect();
      const nextButton = button.getBoundingClientRect();
      const overlap = Math.min(nextBar.bottom, nextButton.bottom) - Math.max(nextBar.top, nextButton.top);
      return { overlap, scrollTop: el.scrollTop, max: el.scrollHeight - el.clientHeight };
    });
    expect(sheetOverlap?.overlap ?? 0).toBeGreaterThan(24);
    await expect(sheet.locator(".footer .btn-primary")).toBeVisible();
    await page.screenshot({ path: `${shotDir}/iphone15-${theme}-sheet.png`, fullPage: false });
  });
}

function preparePage(stored: ReturnType<typeof bookPassageSnapshot>): void {
  const paintSafeArea = () => {
    const root = document.documentElement;
    if (!root || root.dataset.safeArea === "1") return;
    root.dataset.safeArea = "1";
    const style = document.createElement("style");
    style.textContent = "html{--safe-top:59px !important;--safe-bottom:34px !important}";
    root.appendChild(style);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintSafeArea);
  else paintSafeArea();
  localStorage.setItem("drip-by-drip-snapshot", JSON.stringify(stored));
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
