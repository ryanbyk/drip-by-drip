import { getBook, verseCount } from "./books";
import { formatRef, parsePassage } from "./refs";
import type { BibleSourceId, BibleTranslationId, Range, UserPrefs } from "./types";

/** bible.com version ids. The web path is also the app’s universal link. */
const YOUVERSION_VERSION: Record<BibleTranslationId, number> = {
  ESV: 59,
  NIV: 111,
  NLT: 116,
  KJV: 1,
  NKJV: 114,
  NASB: 100,
  CSB: 1713,
};

const USFM: Record<string, string> = {
  genesis: "GEN",
  exodus: "EXO",
  leviticus: "LEV",
  numbers: "NUM",
  deuteronomy: "DEU",
  joshua: "JOS",
  judges: "JDG",
  ruth: "RUT",
  "1-samuel": "1SA",
  "2-samuel": "2SA",
  "1-kings": "1KI",
  "2-kings": "2KI",
  "1-chronicles": "1CH",
  "2-chronicles": "2CH",
  ezra: "EZR",
  nehemiah: "NEH",
  esther: "EST",
  job: "JOB",
  psalms: "PSA",
  proverbs: "PRO",
  ecclesiastes: "ECC",
  "song-of-solomon": "SNG",
  isaiah: "ISA",
  jeremiah: "JER",
  lamentations: "LAM",
  ezekiel: "EZK",
  daniel: "DAN",
  hosea: "HOS",
  joel: "JOL",
  amos: "AMO",
  obadiah: "OBA",
  jonah: "JON",
  micah: "MIC",
  nahum: "NAM",
  habakkuk: "HAB",
  zephaniah: "ZEP",
  haggai: "HAG",
  zechariah: "ZEC",
  malachi: "MAL",
  matthew: "MAT",
  mark: "MRK",
  luke: "LUK",
  john: "JHN",
  acts: "ACT",
  romans: "ROM",
  "1-corinthians": "1CO",
  "2-corinthians": "2CO",
  galatians: "GAL",
  ephesians: "EPH",
  philippians: "PHP",
  colossians: "COL",
  "1-thessalonians": "1TH",
  "2-thessalonians": "2TH",
  "1-timothy": "1TI",
  "2-timothy": "2TI",
  titus: "TIT",
  philemon: "PHM",
  hebrews: "HEB",
  james: "JAS",
  "1-peter": "1PE",
  "2-peter": "2PE",
  "1-john": "1JN",
  "2-john": "2JN",
  "3-john": "3JN",
  jude: "JUD",
  revelation: "REV",
};

const SOURCE_IDS = ["youversion", "biblegateway", "esv", "custom"] as const;
const TRANSLATION_IDS = ["ESV", "NIV", "NLT", "KJV", "NKJV", "NASB", "CSB"] as const;

export const BIBLE_SOURCE_OPTIONS: {
  id: BibleSourceId;
  label: string;
  detail: string;
  badge?: string;
}[] = [
  {
    id: "youversion",
    label: "YouVersion",
    detail: "Bible app · falls back to bible.com",
    badge: "Default",
  },
  { id: "biblegateway", label: "Bible Gateway", detail: "biblegateway.com" },
  { id: "esv", label: "ESV.org", detail: "esv.org" },
  { id: "custom", label: "Custom link", detail: "Use your own URL pattern" },
];

export const BIBLE_TRANSLATIONS: { id: BibleTranslationId; name: string }[] = [
  { id: "ESV", name: "English Standard Version" },
  { id: "NIV", name: "New International Version" },
  { id: "NLT", name: "New Living Translation" },
  { id: "KJV", name: "King James Version" },
  { id: "NKJV", name: "New King James Version" },
  { id: "NASB", name: "New American Standard Bible" },
  { id: "CSB", name: "Christian Standard Bible" },
];

const PLACEHOLDER =
  /\{(passage|reference|ref|version|translation|book|chapter|verse|endChapter|endVerse)\}/;

export function isBibleSource(value: unknown): value is BibleSourceId {
  return typeof value === "string" && (SOURCE_IDS as readonly string[]).includes(value);
}

export function isBibleTranslation(value: unknown): value is BibleTranslationId {
  return typeof value === "string" && (TRANSLATION_IDS as readonly string[]).includes(value);
}

export function normalizeBiblePrefs(prefs: UserPrefs): UserPrefs {
  const source: unknown = prefs.bibleSource;
  const translation: unknown = prefs.bibleTranslation;
  const pattern: unknown = prefs.bibleCustomPattern;
  return {
    ...prefs,
    bibleSource: isBibleSource(source) ? source : "youversion",
    bibleTranslation: isBibleTranslation(translation) ? translation : "ESV",
    bibleCustomPattern: typeof pattern === "string" ? pattern : "",
  };
}

export function bibleSourceLabel(source: BibleSourceId): string {
  switch (source) {
    case "youversion":
      return "YouVersion";
    case "biblegateway":
      return "Bible Gateway";
    case "esv":
      return "ESV.org";
    case "custom":
      return "Custom link";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

export type PassageLink = {
  href: string | null;
  appHref: string | null;
  label: string;
  source: BibleSourceId;
  sourceLabel: string;
  detail: string;
};

export type LaunchContext = {
  userAgent: string;
  /** Home-screen / standalone PWA. iOS ignores scripted custom schemes there. */
  standalone?: boolean;
  /** iPadOS reports a Macintosh UA; more than one touch point marks it as iPad. */
  touchPoints?: number;
};

export type LaunchPlan =
  | { kind: "tab"; href: string }
  | { kind: "universal"; href: string }
  | { kind: "scheme"; appHref: string; fallbackHref: string }
  | { kind: "intent"; href: string };

/** Play Store id. assetlinks.json grants this package every bible.com URL. */
const YOUVERSION_ANDROID_PACKAGE = "com.sirma.mobile.bible.android";

export function passageLink(reference: string, prefs: UserPrefs): PassageLink {
  const clean = normalizeBiblePrefs(prefs);
  const shown = reference.trim();
  const sourceLabel = bibleSourceLabel(clean.bibleSource);
  const label = shown ? `Open ${shown} in ${sourceLabel} ↗` : "Open passage";
  if (!shown) {
    return {
      href: null,
      appHref: null,
      label,
      source: clean.bibleSource,
      sourceLabel,
      detail: detailFor(clean.bibleSource, false),
    };
  }
  const text = canonicalReference(shown);
  const range = parsePassage(text);
  const built = buildLink(clean, text, range);
  return {
    href: built.href,
    appHref: built.appHref,
    label,
    source: clean.bibleSource,
    sourceLabel,
    detail: detailFor(clean.bibleSource, Boolean(built.href)),
  };
}

export function launchPlan(link: Pick<PassageLink, "href" | "appHref">, context: LaunchContext): LaunchPlan | null {
  if (!link.href) return null;
  const bibleCom = isBibleCom(link.href);
  if (/Android/i.test(context.userAgent) && bibleCom) {
    if (/Firefox\//i.test(context.userAgent)) return { kind: "universal", href: link.href };
    return { kind: "intent", href: bibleComIntent(link.href) };
  }
  // Standalone iOS swallows https universal links inside its webview, and
  // location.assign("youversion://…") never leaves the PWA. The anchor itself
  // has to be the scheme; Safari still gets the https universal link.
  if (isIos(context) && bibleCom && context.standalone && link.appHref) {
    return { kind: "scheme", appHref: link.appHref, fallbackHref: link.href };
  }
  if (isIos(context) && bibleCom) return { kind: "universal", href: link.href };
  return { kind: "tab", href: link.href };
}

export function bibleComIntent(href: string): string {
  const url = new URL(href);
  const fallback = encodeURIComponent(url.href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${YOUVERSION_ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

function isIos(context: LaunchContext): boolean {
  if (/iPhone|iPad|iPod/i.test(context.userAgent)) return true;
  return /Macintosh/i.test(context.userAgent) && (context.touchPoints ?? 0) > 1;
}

function isBibleCom(href: string): boolean {
  try {
    const host = new URL(href).hostname;
    return host === "www.bible.com" || host === "bible.com";
  } catch {
    return false;
  }
}

function detailFor(source: BibleSourceId, ready: boolean): string {
  if (!ready && source === "custom") return "Add a URL pattern in Settings to open this passage.";
  switch (source) {
    case "youversion":
      return "Opens in the Bible app, or bible.com · needs a connection";
    case "biblegateway":
      return "Opens on Bible Gateway · needs a connection";
    case "esv":
      return "Opens on ESV.org · needs a connection";
    case "custom":
      return "Opens your link · needs a connection";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function canonicalReference(reference: string): string {
  const cleaned = reference.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const range = parsePassage(cleaned);
  if (!range) return cleaned;
  return formatRef(range).replace(/[–—]/g, "-");
}

function buildLink(
  prefs: UserPrefs,
  reference: string,
  range: Range | null,
): { href: string | null; appHref: string | null } {
  switch (prefs.bibleSource) {
    case "youversion":
      return youVersionLink(reference, range, prefs.bibleTranslation);
    case "biblegateway":
      return {
        href: `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=${prefs.bibleTranslation}`,
        appHref: null,
      };
    case "esv":
      return { href: esvLink(reference, range), appHref: null };
    case "custom":
      return { href: customLink(prefs.bibleCustomPattern, reference, range, prefs.bibleTranslation), appHref: null };
    default: {
      const exhaustive: never = prefs.bibleSource;
      return exhaustive;
    }
  }
}

function youVersionLink(
  reference: string,
  range: Range | null,
  translation: BibleTranslationId,
): { href: string; appHref: string | null } {
  const versionId = YOUVERSION_VERSION[translation];
  const usfm = range ? youVersionUsfm(range) : null;
  if (!usfm) {
    return {
      href: `https://www.bible.com/search/bible?query=${encodeURIComponent(reference)}`,
      appHref: null,
    };
  }
  const params = new URLSearchParams({
    reference: usfm,
    version_id: String(versionId),
  });
  return {
    href: `https://www.bible.com/bible/${versionId}/${usfm}.${translation}`,
    appHref: `youversion://bible?${params.toString()}`,
  };
}

function youVersionUsfm(range: Range): string | null {
  const code = USFM[range.bookId];
  if (!code) return null;
  const sameChapter = range.startChapter === range.endChapter;
  const fullChapter =
    sameChapter && range.startVerse === 1 && range.endVerse === verseCount(range.bookId, range.startChapter);
  if (fullChapter) return `${code}.${range.startChapter}`;
  if (sameChapter) {
    if (range.startVerse === range.endVerse) return `${code}.${range.startChapter}.${range.startVerse}`;
    return `${code}.${range.startChapter}.${range.startVerse}-${range.endVerse}`;
  }
  return `${code}.${range.startChapter}.${range.startVerse}-${code}.${range.endChapter}.${range.endVerse}`;
}

function esvLink(reference: string, range: Range | null): string {
  if (!range) return `https://www.esv.org/search/?q=${encodeURIComponent(reference)}`;
  return `https://www.esv.org/${reference.replace(/ /g, "+")}/`;
}

function customLink(
  pattern: string,
  reference: string,
  range: Range | null,
  translation: BibleTranslationId,
): string | null {
  const trimmed = pattern.trim();
  if (!trimmed || !PLACEHOLDER.test(trimmed)) return null;
  const book = range ? getBook(range.bookId) : undefined;
  const tokens: Record<string, string> = {
    passage: encodeURIComponent(reference),
    reference: encodeURIComponent(reference),
    ref: encodeURIComponent(reference),
    version: translation,
    translation,
    book: book ? encodeURIComponent(book.refName) : "",
    chapter: range ? String(range.startChapter) : "",
    verse: range ? String(range.startVerse) : "",
    endChapter: range ? String(range.endChapter) : "",
    endVerse: range ? String(range.endVerse) : "",
  };
  const filled = trimmed.replace(/\{(\w+)\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : full,
  );
  try {
    const url = new URL(filled);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}
