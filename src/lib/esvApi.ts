import { ESV_COPYRIGHT } from "../domain/esv";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

/**
 * In-app ESV client. Passage text comes from the esv-passage Edge Function.
 * The browser sends the public anon key. It never sends a Crossway API token.
 */

const TIMEOUT_MS = 12_000;
const PROBE_REFERENCE = "John 11:35";

export type EsvFetcher = typeof fetch;

export type EsvVerse = {
  kind: "verse";
  chapter: number;
  verse: number;
  text: string;
};

export type EsvText = {
  kind: "text";
  text: string;
};

export type EsvRun = EsvVerse | EsvText;

export type EsvBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; runs: EsvRun[] };

export type EsvPassage = {
  query: string;
  canonical: string;
  copyright: string;
  blocks: EsvBlock[];
};

export type EsvFetchFailure = "unauthorized" | "empty" | "network" | "invalid";

export type EsvFetchResult = { ok: true; passage: EsvPassage } | { ok: false; reason: EsvFetchFailure };

export type EsvAvailability = "available" | "unavailable" | "unreachable";

type EsvPayload = {
  canonical?: unknown;
  passages?: unknown;
};

const cache = new Map<string, EsvPassage>();
let proxyDown = false;

export function resetEsvClientForTests(): void {
  cache.clear();
  proxyDown = false;
}

export function esvQuery(reference: string): string {
  return reference.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

export function cachedEsvPassage(reference: string): EsvPassage | null {
  return cache.get(esvQuery(reference)) ?? null;
}

/** True after the proxy rejects the client or cannot reach ESV, until a later success. */
export function esvUnavailable(): boolean {
  return proxyDown;
}

export async function checkEsvAvailability(fetchImpl: EsvFetcher = fetch): Promise<EsvAvailability> {
  const result = await esvRequest(PROBE_REFERENCE, fetchImpl, "text");
  if (!result.ok) return result.reason === "network" ? "unreachable" : "unavailable";
  if (!passageText(result.payload.passages)) return "unavailable";
  return "available";
}

export async function fetchEsvPassage(reference: string, fetchImpl: EsvFetcher = fetch): Promise<EsvFetchResult> {
  const query = esvQuery(reference);
  if (!query) return { ok: false, reason: "invalid" };
  const cached = cache.get(query);
  if (cached) return { ok: true, passage: cached };
  const result = await esvRequest(query, fetchImpl);
  if (!result.ok) return result;
  const html = passageText(result.payload.passages);
  if (!html) return { ok: false, reason: "empty" };
  const canonical = typeof result.payload.canonical === "string" ? result.payload.canonical : query;
  const passage = parseEsvHtml(html, canonical, query);
  if (!hasVerseText(passage)) return { ok: false, reason: "empty" };
  cache.set(query, passage);
  return { ok: true, passage };
}

export function parseEsvHtml(html: string, canonical: string, query: string): EsvPassage {
  const cleaned = html.replace(/<small\b[^>]*>[\s\S]*?<\/small>/gi, "");
  const blocks: EsvBlock[] = [];
  let notice = "";
  const blockRe = /<(h[2-4]|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of cleaned.matchAll(blockRe)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    const inner = match[3] ?? "";
    const cls = attr(attrs, "class");
    const text = visibleText(inner);
    if (isCopyright(cls, text)) {
      notice = preferCopyright(notice, text);
      continue;
    }
    if (tag !== "p") {
      if (/\bextra_text\b/.test(cls) || !text) continue;
      blocks.push({ kind: "heading", text });
      continue;
    }
    const runs = parseRuns(inner);
    if (runs.length > 0) blocks.push({ kind: "paragraph", runs });
  }
  return {
    query,
    canonical,
    copyright: displayCopyright(notice),
    blocks,
  };
}

function passageText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function hasVerseText(passage: EsvPassage): boolean {
  return passage.blocks.some(
    (block) => block.kind === "paragraph" && block.runs.some((run) => run.text.trim().length > 0),
  );
}

async function esvRequest(
  query: string,
  fetchImpl: EsvFetcher,
  format?: "text",
): Promise<{ ok: true; payload: EsvPayload } | { ok: false; reason: EsvFetchFailure }> {
  const url = new URL("/functions/v1/esv-passage", SUPABASE_URL);
  url.searchParams.set("q", query);
  if (format === "text") url.searchParams.set("format", "text");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 502 ||
      response.status === 503
    ) {
      proxyDown = true;
      return { ok: false, reason: "unauthorized" };
    }
    if (!response.ok) return { ok: false, reason: "invalid" };
    const payload = (await response.json()) as EsvPayload;
    proxyDown = false;
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function parseRuns(inner: string): EsvRun[] {
  const runs: EsvRun[] = [];
  let current: EsvRun | null = null;
  const tokenRe = /<([a-z0-9]+)\b([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>|<!--[\s\S]*?-->|<[^>]+>|([^<]+)/gi;

  function addText(raw: string) {
    const text = decodeEntities(raw).replace(/\s+/g, " ");
    if (!text) return;
    if (!current) {
      current = { kind: "text", text };
      runs.push(current);
      return;
    }
    current.text += text;
  }

  for (const match of inner.matchAll(tokenRe)) {
    const tag = match[1];
    if (tag) {
      const attrs = match[2] ?? "";
      const cls = attr(attrs, "class");
      if (/\b(?:verse-num|chapter-num)\b/.test(cls)) {
        const located = verseFromId(attr(attrs, "id"));
        if (located) {
          current = { kind: "verse", chapter: located.chapter, verse: located.verse, text: "" };
          runs.push(current);
          continue;
        }
      }
      addText(visibleText(match[3] ?? ""));
      continue;
    }
    if (match[0].startsWith("<br")) {
      addText(" ");
      continue;
    }
    if (match[4]) addText(match[4]);
  }

  return runs
    .map((run) => ({ ...run, text: run.text.replace(/\s+/g, " ").trim() }))
    .filter((run) => run.text.length > 0);
}

function verseFromId(id: string): { chapter: number; verse: number } | null {
  const match = id.match(/v(\d{2})(\d{3})(\d{3})/);
  if (!match) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (chapter < 1 || verse < 1) return null;
  return { chapter, verse };
}

function attr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match?.[2] ?? match?.[3] ?? "";
}

function visibleText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function isCopyright(cls: string, text: string): boolean {
  if (/\bcopyright\b/i.test(cls)) return true;
  if (/crossway|english standard version/i.test(text)) return true;
  return /^\(?\s*ESV\s*\)?$/i.test(text);
}

function preferCopyright(current: string, next: string): string {
  if (!next) return current;
  // The HTML endpoint sends the Crossway permission line, then a separate
  // adaptation note that also says "English Standard Version". Keep the
  // Crossway line once we have it.
  if (/crossway/i.test(current) && !/crossway/i.test(next)) return current;
  if (/crossway|english standard version/i.test(next)) return next;
  return current || next;
}

function displayCopyright(notice: string): string {
  if (/crossway|english standard version/i.test(notice)) return notice;
  return ESV_COPYRIGHT;
}
