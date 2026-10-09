import { expect, test, type Locator, type Page } from "@playwright/test";

const JOHN_HTML = [
  "<h3>The Word Became Flesh</h3>",
  '<p><b class="chapter-num" id="v43001001">1</b>In the beginning was the Word, and the Word was with God, and the Word was God. ',
  '<b class="verse-num" id="v43001002">2</b>He was in the beginning with God.</p>',
  '<p class="copyright">Scripture quotations are from the ESV Bible, copyright 2001 by Crossway. Used by permission.</p>',
].join("");

test.beforeEach(async ({ page }) => {
  await page.route("**/esv-passage**", (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify({ canonical: "John 1:1-18", passages: [JOHN_HTML] }),
    });
  });
});

for (const appearance of ["light", "dark"] as const) {
  test.describe(appearance, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(preparePage, appearance);
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto("/");
    });

    test("keeps the heading clear at rest and the last reflect action above the nav", async ({ page }) => {
      await page.getByRole("button", { name: "Reflect" }).tap();
      const screen = page.locator(".screen");
      await expect(screen).toBeVisible();
      expect(await screen.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(page.locator(".phone")).not.toHaveClass(/is-scrolled/);

      const title = page.locator(".reflect-title h1");
      const glass = page.locator(".status-glass");
      const titleBox = await boxOf(title);
      const glassBox = await boxOf(glass);
      expect(glassBox.height).toBeGreaterThan(50);
      expect(glassBox.height).toBeLessThan(70);
      expect(titleBox.y).toBeGreaterThanOrEqual(glassBox.y + glassBox.height - 1);
      await shot(page, `today-reflect-rest-${appearance}`);

      await screen.evaluate((el) => {
        el.scrollTop = 80;
      });
      await expect(page.locator(".phone")).toHaveClass(/is-scrolled/);
      await shot(page, `today-reflect-scrolled-${appearance}`);

      await screen.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const keep = page.getByRole("button", { name: "Save & keep reading" });
      await expectAboveNav(page, keep);
      await shot(page, `today-reflect-cleared-${appearance}`);
    });

    test("toggles a verse highlight with touch and marks the day read", async ({ page }) => {
      const verse = page.locator(".reader-verse").first();
      await expect(verse).toBeVisible();
      await shot(page, `today-reader-rest-${appearance}`);

      await tapBox(page, verse);
      await expect(verse).toHaveAttribute("aria-pressed", "true");
      await expectHit(page, verse, ".reader-verse");

      await tapBox(page, verse);
      await expect(verse).toHaveAttribute("aria-pressed", "false");

      await tapBox(page, verse);
      await expect(verse).toHaveAttribute("aria-pressed", "true");
      await tapBox(page, verse);
      await expect(page.locator(".reader-verse[aria-pressed='true']")).toHaveCount(0);

      const read = page.getByTestId("mark-read");
      await expectAboveNav(page, read);
      await tapBox(page, read);
      const finish = page.getByRole("button", { name: "Save & finish" });
      await expect(finish).toBeVisible();
      await finish.tap();
      await expect(page.getByRole("heading", { name: "Today’s drip, received." })).toBeVisible();
    });

    test("scrolls history and settings clear of the nav", async ({ page }) => {
      await page.getByRole("button", { name: "History" }).tap();
      const row = page.locator(".recent-row").first();
      await expect(row).toBeVisible();
      await page.locator(".screen").evaluate((el) => {
        const target = el.querySelector(".recent-row");
        const nav = document.querySelector(".tabbar");
        if (!target || !nav) return;
        const navTop = nav.getBoundingClientRect().top;
        const rowTop = target.getBoundingClientRect().top;
        el.scrollTop += rowTop - navTop + 24;
      });
      await shot(page, `history-under-nav-${appearance}`);

      await page.locator(".screen").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expectAboveNav(page, page.locator(".recent-row").last());

      await page.getByRole("button", { name: "Settings" }).tap();
      await page.locator(".screen").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expectAboveNav(page, page.getByRole("button", { name: "Reset progress…" }));
    });
  });
}

test("keeps the nav fixed while the screen scrolls and the document does not", async ({ page }) => {
  await page.addInitScript(preparePage, "light");
  await page.goto("/");
  await page.getByRole("button", { name: "History" }).tap();
  const screen = page.locator(".screen");
  const nav = page.locator(".tabbar-wrap");
  await expect(screen).toBeVisible();
  await expect(nav).toBeVisible();

  const before = await boxOf(nav);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(before.y + before.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
  expect(before.y + before.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);

  await screen.evaluate((el) => {
    el.scrollTop = 220;
  });
  const screenBox = await boxOf(screen);
  await page.mouse.move(screenBox.x + 30, screenBox.y + 80);
  await page.mouse.wheel(0, 280);
  await page.evaluate(() => {
    window.scrollTo(0, 700);
    const scrolling = document.scrollingElement;
    if (scrolling) scrolling.scrollTop = 700;
    document.documentElement.scrollTop = 700;
    document.body.scrollTop = 700;
  });

  const after = await boxOf(nav);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  expect(after.y + after.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
  expect(after.y + after.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);

  const lock = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    const read = (el: Element) => {
      const style = getComputedStyle(el);
      return { overflow: style.overflow, overscroll: style.overscrollBehavior };
    };
    const phone = document.querySelector(".phone");
    const screenEl = document.querySelector(".screen");
    return {
      scrollTop: scrolling?.scrollTop ?? -1,
      scrollHeight: scrolling?.scrollHeight ?? 0,
      clientHeight: scrolling?.clientHeight ?? 0,
      screenTop: screenEl instanceof HTMLElement ? screenEl.scrollTop : -1,
      html: read(document.documentElement),
      body: read(document.body),
      root: read(document.getElementById("root") ?? document.body),
      navPosition: getComputedStyle(document.querySelector(".tabbar-wrap") ?? document.body).position,
      phoneHeight: phone instanceof HTMLElement ? phone.getBoundingClientRect().height : 0,
      innerHeight: window.innerHeight,
    };
  });
  expect(lock.scrollTop).toBe(0);
  expect(lock.screenTop).toBeGreaterThan(0);
  expect(lock.scrollHeight).toBeLessThanOrEqual(lock.clientHeight + 1);
  expect(lock.html.overflow).toBe("hidden");
  expect(lock.body.overflow).toBe("hidden");
  expect(lock.root.overflow).toBe("hidden");
  expect(lock.html.overscroll).toBe("none");
  expect(lock.body.overscroll).toBe("none");
  expect(lock.root.overscroll).toBe("none");
  expect(lock.navPosition).toBe("fixed");
  expect(lock.phoneHeight).toBeLessThanOrEqual(lock.innerHeight + 1);

  await page.setViewportSize({ width: 900, height: 800 });
  const wide = await page.evaluate(() => {
    const phone = document.querySelector(".phone")?.getBoundingClientRect();
    const wrap = document.querySelector(".tabbar-wrap")?.getBoundingClientRect();
    return {
      phone,
      wrap,
      scrollTop: document.scrollingElement?.scrollTop ?? -1,
    };
  });
  expect(wide.phone).toBeTruthy();
  expect(wide.wrap).toBeTruthy();
  expect(Math.abs((wide.phone?.x ?? 0) - (wide.wrap?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((wide.phone?.width ?? 0) - (wide.wrap?.width ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((wide.wrap?.y ?? 0) + (wide.wrap?.height ?? 0) - 800)).toBeLessThanOrEqual(1);
  expect(wide.scrollTop).toBe(0);
});

function preparePage(theme: "light" | "dark"): void {
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

  const format = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };
  const shift = (iso: string, days: number) => {
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    date.setDate(date.getDate() + days);
    return format(date);
  };
  const today = format(new Date());
  const days: Record<string, unknown> = {};
  for (let index = 1; index <= 20; index += 1) {
    const date = shift(today, -index);
    days[date] = {
      date,
      answer: "yes",
      readDone: true,
      huh: false,
      detour: false,
      passageRef: `John 1:${index}`,
      answeredAt: new Date().toISOString(),
      readDoneAt: new Date().toISOString(),
    };
  }
  days[today] = {
    date: today,
    answer: "yes",
    readDone: false,
    huh: false,
    detour: false,
    passageRef: "John 1:1–18",
    answeredAt: new Date().toISOString(),
    range: { bookId: "john", startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 18 },
  };

  localStorage.setItem(
    "drip-by-drip-snapshot",
    JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      prefs: {
        askTime: "06:30",
        notificationsEnabled: false,
        notificationState: "unknown",
        appearance: theme,
        onboardingComplete: true,
        onboardingStep: "framing",
        createdAt: new Date().toISOString(),
        planStartDate: shift(today, -30),
        readingMode: "book",
        bookId: "john",
        dripSize: "verses",
        planId: "placeholder",
        installNudgeDismissed: true,
        lastNotifiedDate: "",
        queuedBookId: "",
        queuedBookDate: "",
        queuedChapter: 0,
        draftStartChapter: 1,
        bibleSource: "youversion",
        bibleTranslation: "ESV",
        bibleCustomPattern: "",
        showInAppEsv: true,
        timeZone: "UTC",
      },
      places: { john: { bookId: "john", chapter: 1, verse: 1 } },
      days,
    }),
  );
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function tapBox(page: Page, locator: Locator): Promise<void> {
  const box = await boxOf(locator);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function expectHit(page: Page, locator: Locator, selector: string): Promise<void> {
  const box = await boxOf(locator);
  const hit = await page.evaluate(
    ({ x, y, selector: target }) => document.elementFromPoint(x, y)?.closest(target) != null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2, selector },
  );
  expect(hit).toBe(true);
}

async function expectAboveNav(page: Page, locator: Locator): Promise<void> {
  const target = await boxOf(locator);
  const nav = await boxOf(page.locator(".tabbar"));
  expect(target.y + target.height).toBeLessThanOrEqual(nav.y + 1);
  await expectHit(page, locator, "button, a");
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/ios-scroll/${name}.png` });
}
