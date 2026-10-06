import { describe, expect, it } from "vitest";
import { BOOKS, verseCount } from "./books";
import { formatRef } from "./refs";
import { bibleComIntent, launchPlan, normalizeBiblePrefs, passageLink } from "./bibleSource";
import type { UserPrefs } from "./types";
import { createSnapshot, reducer } from "../state/reducer";

function prefs(partial: Partial<UserPrefs> = {}): UserPrefs {
  return { ...createSnapshot().prefs, ...partial };
}

describe("bible source links", () => {
  it("defaults to a YouVersion ESV link with an app scheme and a bible.com fallback", () => {
    const link = passageLink("Mark 4", createSnapshot().prefs);
    expect(createSnapshot().prefs.bibleSource).toBe("youversion");
    expect(createSnapshot().prefs.bibleTranslation).toBe("ESV");
    expect(link.href).toBe("https://www.bible.com/bible/59/MRK.4.ESV");
    expect(link.appHref).toBe("youversion://bible?reference=MRK.4&version_id=59");
    expect(link.label).toBe("Open Mark 4 in YouVersion ↗");
  });

  it("changes the open URL when the source or translation changes", () => {
    const gateway = reducer(createSnapshot(), {
      type: "prefs",
      prefs: { bibleSource: "biblegateway", bibleTranslation: "NIV" },
    });
    expect(passageLink("Mark 4:21–41", gateway.prefs).href).toBe(
      "https://www.biblegateway.com/passage/?search=Mark%204%3A21-41&version=NIV",
    );
    expect(passageLink("Mark 4:21–41", gateway.prefs).appHref).toBeNull();

    const esv = reducer(createSnapshot(), {
      type: "prefs",
      prefs: { bibleSource: "esv", bibleTranslation: "NIV" },
    });
    expect(passageLink("Mark 4:21–41", esv.prefs).href).toBe("https://www.esv.org/Mark+4:21-41/");

    const youVersion = passageLink("John 3:16", prefs({ bibleTranslation: "NLT" }));
    expect(youVersion.href).toBe("https://www.bible.com/bible/116/JHN.3.16.NLT");
    expect(youVersion.appHref).toBe("youversion://bible?reference=JHN.3.16&version_id=116");
  });

  it("spans chapters in the YouVersion reference", () => {
    const link = passageLink("Mark 4–5", prefs());
    const usfm = `MRK.4.1-MRK.5.${verseCount("mark", 5)}`;
    expect(link.href).toBe(`https://www.bible.com/bible/59/${usfm}.ESV`);
    expect(link.appHref).toBe(`youversion://bible?reference=${usfm}&version_id=59`);
  });

  it("builds a YouVersion link for every book", () => {
    for (const book of BOOKS) {
      const ref = formatRef({
        bookId: book.id,
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
      });
      const link = passageLink(ref, prefs());
      expect(link.href, book.id).toMatch(/^https:\/\/www\.bible\.com\/bible\/59\//);
      expect(link.appHref, book.id).toMatch(/^youversion:\/\/bible\?reference=/);
    }
  });

  it("fills a custom URL pattern and refuses anything that is not an http(s) link", () => {
    const pattern = "https://example.com/{book}/{chapter}?v={version}&q={passage}";
    const link = passageLink("Mark 4:21–41", prefs({ bibleSource: "custom", bibleCustomPattern: pattern }));
    expect(link.href).toBe("https://example.com/Mark/4?v=ESV&q=Mark%204%3A21-41");
    expect(link.label).toBe("Open Mark 4:21–41 in Custom link ↗");

    const translated = passageLink(
      "Mark 4",
      prefs({ bibleSource: "custom", bibleTranslation: "KJV", bibleCustomPattern: "https://example.com/?t={translation}&r={ref}" }),
    );
    expect(translated.href).toBe("https://example.com/?t=KJV&r=Mark%204");

    expect(passageLink("Mark 4", prefs({ bibleSource: "custom", bibleCustomPattern: "" })).href).toBeNull();
    expect(
      passageLink("Mark 4", prefs({ bibleSource: "custom", bibleCustomPattern: "https://example.com/static" })).href,
    ).toBeNull();
    expect(
      passageLink("Mark 4", prefs({ bibleSource: "custom", bibleCustomPattern: "javascript:alert({passage})" })).href,
    ).toBeNull();
  });

  it("searches when the reference is more than one passage", () => {
    const ref = "Luke 10:38–42; Psalm 46";
    expect(passageLink(ref, prefs()).href).toBe(
      "https://www.bible.com/search/bible?query=Luke%2010%3A38-42%3B%20Psalm%2046",
    );
    expect(passageLink(ref, prefs()).appHref).toBeNull();
    expect(passageLink(ref, prefs({ bibleSource: "esv" })).href).toBe(
      `https://www.esv.org/search/?q=${encodeURIComponent("Luke 10:38-42; Psalm 46")}`,
    );
  });

  it("hands a phone tap to YouVersion and leaves other sources in a tab", () => {
    const link = passageLink("Mark 4", prefs());
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile";
    expect(link.href).toBe("https://www.bible.com/bible/59/MRK.4.ESV");
    expect(link.appHref).toBe("youversion://bible?reference=MRK.4&version_id=59");

    expect(launchPlan(link, { userAgent: iphone })).toEqual({
      kind: "universal",
      href: "https://www.bible.com/bible/59/MRK.4.ESV",
    });
    expect(launchPlan(link, { userAgent: iphone, standalone: true })).toEqual({
      kind: "scheme",
      appHref: "youversion://bible?reference=MRK.4&version_id=59",
      fallbackHref: "https://www.bible.com/bible/59/MRK.4.ESV",
    });
    expect(launchPlan(link, { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", touchPoints: 5 })).toEqual({
      kind: "universal",
      href: link.href,
    });
    expect(launchPlan(link, { userAgent: android })).toEqual({
      kind: "intent",
      href: bibleComIntent("https://www.bible.com/bible/59/MRK.4.ESV"),
    });
    expect(bibleComIntent("https://www.bible.com/bible/59/MRK.4.ESV")).toBe(
      "intent://www.bible.com/bible/59/MRK.4.ESV#Intent;scheme=https;package=com.sirma.mobile.bible.android;S.browser_fallback_url=https%3A%2F%2Fwww.bible.com%2Fbible%2F59%2FMRK.4.ESV;end",
    );
    expect(launchPlan(link, { userAgent: "Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/120.0" })).toEqual({
      kind: "universal",
      href: link.href,
    });
    expect(launchPlan(link, { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" })).toEqual({
      kind: "tab",
      href: link.href,
    });

    const search = passageLink("Luke 10:38–42; Psalm 46", prefs());
    expect(launchPlan(search, { userAgent: iphone, standalone: true })).toEqual({
      kind: "universal",
      href: search.href,
    });
    expect(bibleComIntent(search.href ?? "")).toBe(
      "intent://www.bible.com/search/bible?query=Luke%2010%3A38-42%3B%20Psalm%2046#Intent;scheme=https;package=com.sirma.mobile.bible.android;S.browser_fallback_url=https%3A%2F%2Fwww.bible.com%2Fsearch%2Fbible%3Fquery%3DLuke%252010%253A38-42%253B%2520Psalm%252046;end",
    );

    const gateway = passageLink("Mark 4", prefs({ bibleSource: "biblegateway" }));
    expect(launchPlan(gateway, { userAgent: android })).toEqual({
      kind: "tab",
      href: gateway.href,
    });
  });

  it("repairs a stored source that this version does not know", () => {
    const clean = normalizeBiblePrefs({
      ...createSnapshot().prefs,
      bibleSource: "logos" as UserPrefs["bibleSource"],
      bibleTranslation: "MSG" as UserPrefs["bibleTranslation"],
      bibleCustomPattern: 12 as unknown as string,
    });
    expect(clean.bibleSource).toBe("youversion");
    expect(clean.bibleTranslation).toBe("ESV");
    expect(clean.bibleCustomPattern).toBe("");
    expect(passageLink("Psalm 23", clean).href).toBe("https://www.bible.com/bible/59/PSA.23.ESV");
  });
});
