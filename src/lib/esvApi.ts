import { ESV_COPYRIGHT } from "../domain/esv";

/**
 * Personal ESV API client.
 * The key is sent only as an Authorization header. Do not log it, put it in
 * the query string, or persist it anywhere except the StorageAdapter snapshot.
 */

const TEXT_URL = "https://api.esv.org/v3/passage/text/";
const HTML_URL = "https://api.esv.org/v3/passage/html/";
const TIMEOUT_MS = 12_000;

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

export type EsvKeyCheck = "connected" | "invalid" | "unreachable";

type EsvPayload = {
  canonical?: unknown;
  passages?: unknown;
};

const cache = new Map<string, EsvPassage>();
const rejectedKeys = new Set<string>();

export function resetEsvClientForTests(): void {
  cache.clear();
  rejectedKeys.clear();
}

export function esvQuery(reference: string): string {
  return reference.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

export function cachedEsvPassage(reference: string): EsvPassage | null {
  return cache.get(esvQuery(reference)) ?? null;
}

export function esvKeyRejected(apiKey: string): boolean {
  const id = fingerprint(apiKey.trim());
  return id !== "" && rejectedKeys.has(id);
}

export async function validateEsvApiKey(apiKey: string, fetchImpl: EsvFetcher = fetch): Promise<EsvKeyCheck> {
  const key = apiKey.trim();
  if (!key) return "invalid";
  const result = await esvRequest(
    TEXT_URL,
    {
      q: "John 11:35",
      "include-headings": "false",
      "include-footnotes": "false",
      "include-footnote-body": "false",
      "include-verse-numbers": "false",
      "include-first-verse-numbers": "false",
      "include-passage-references": "false",
      "include-short-copyright": "true",
      "include-copyright": "false",
    },
    key,
    fetchImpl,
  );
  if (!result.ok) return result.reason === "unauthorized" ? "invalid" : "unreachable";
  if (!passageText(result.payload.passages)) return "invalid";
  return "connected";
}

export async function fetchEsvPassage(
  reference: string,
  apiKey: string,
  fetchImpl: EsvFetcher = fetch,
): Promise<EsvFetchResult> {
  const query = esvQuery(reference);
  const key = apiKey.trim();
  if (!query || !key) return { ok: false, reason: "invalid" };
  const cached = cache.get(query);
  if (cached) return { ok: true, passage: cached };
  const result = await esvRequest(
    HTML_URL,
    {
      q: query,
      "include-headings": "true",
      "include-footnotes": "false",
      "include-footnote-body": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-chapter-numbers": "true",
      "include-passage-references": "false",
      "include-audio-link": "false",
      "include-short-copyright": "false",
      "include-copyright": "true",
      "include-subheadings": "true",
      "include-crossrefs": "false",
      "inline-styles": "false",
      "wrapping-div": "false",
    },
    key,
    fetchImpl,
  );
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
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: EsvFetcher,
): Promise<{ ok: true; payload: EsvPayload } | { ok: false; reason: EsvFetchFailure }> {
  const url = new URL(endpoint);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      rememberKey(apiKey, false);
      return { ok: false, reason: "unauthorized" };
    }
    if (!response.ok) return { ok: false, reason: "invalid" };
    const payload = (await response.json()) as EsvPayload;
    rememberKey(apiKey, true);
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function rememberKey(apiKey: string, accepted: boolean): void {
  const id = fingerprint(apiKey.trim());
  if (!id) return;
  if (accepted) rejectedKeys.delete(id);
  else rejectedKeys.add(id);
}

function fingerprint(key: string): string {
  if (!key) return "";
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
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
  if (/crossway|english standard version/i.test(next)) return next;
  return current || next;
}

function displayCopyright(notice: string): string {
  if (/crossway|english standard version/i.test(notice)) return notice;
  return ESV_COPYRIGHT;
}
