import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachedEsvPassage,
  checkEsvAvailability,
  esvUnavailable,
  fetchEsvPassage,
  parseEsvHtml,
  resetEsvClientForTests,
  type EsvFetcher,
} from "./esvApi";
import { ESV_COPYRIGHT } from "../domain/esv";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

const SAMPLE_HTML = [
  '<h2 class="extra_text">Mark 4 <small class="audio">(<a href="https://audio.example/x.mp3">Listen</a>)</small></h2>',
  "<h3>Sample Heading</h3>",
  '<p><b class="chapter-num" id="v41004001-1">4&nbsp;</b>First sentence. <b class="verse-num" id="v41004002-1">2&nbsp;</b>Second &quot;sentence.&quot;</p>',
  '<p class="copyright">Scripture quotations are from the ESV® Bible, © 2001 by Crossway. Used by permission.</p>',
].join("");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  resetEsvClientForTests();
  vi.restoreAllMocks();
});

describe("ESV HTML parser", () => {
  it("keeps headings and verse ids, and lifts the copyright out of the body", () => {
    const passage = parseEsvHtml(SAMPLE_HTML, "Mark 4:1-2", "Mark 4:1-2");
    expect(passage.blocks).toEqual([
      { kind: "heading", text: "Sample Heading" },
      {
        kind: "paragraph",
        runs: [
          { kind: "verse", chapter: 4, verse: 1, text: "First sentence." },
          { kind: "verse", chapter: 4, verse: 2, text: 'Second "sentence."' },
        ],
      },
    ]);
    expect(passage.copyright).toContain("Crossway");
    expect(JSON.stringify(passage.blocks)).not.toContain("Listen");
  });

  it("keeps the Crossway permission line when a later copyright note does not name Crossway", () => {
    const html = [
      '<p><b class="verse-num" id="v43011035-1">35</b>Jesus wept.</p>',
      '<p class="copyright">ESV Bible, copyright 2001 by Crossway. Used by permission.</p>',
      "<p class=\"copyright\">The Holy Bible, English Standard Version (ESV) is adapted from the Revised Standard Version of the Bible.</p>",
    ].join("");
    const passage = parseEsvHtml(html, "John 11:35", "John 11:35");
    expect(passage.copyright).toContain("Crossway");
    expect(passage.copyright).not.toContain("Revised Standard");
    expect(passage.blocks).toEqual([
      { kind: "paragraph", runs: [{ kind: "verse", chapter: 11, verse: 35, text: "Jesus wept." }] },
    ]);
  });

  it("uses the standard notice when the response only marks the text as ESV", () => {
    const passage = parseEsvHtml("<p>(<a class=\"copyright\" href=\"https://www.esv.org\">ESV</a>)</p><p>Sample line.</p>", "John 1:1", "John 1:1");
    expect(passage.copyright).toBe(ESV_COPYRIGHT);
    expect(passage.blocks).toEqual([
      { kind: "paragraph", runs: [{ kind: "text", text: "Sample line." }] },
    ]);
  });
});

describe("ESV fetch client", () => {
  it("loads HTML from the edge function with the anon key, never a Crossway token", async () => {
    const logs: unknown[][] = [];
    for (const method of ["log", "info", "debug", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logs.push(args);
      });
    }
    const seen: string[] = [];
    const fetchImpl: EsvFetcher = async (input, init) => {
      const url = input instanceof URL ? input : new URL(String(input));
      seen.push(url.toString());
      expect(url.origin + url.pathname).toBe(`${new URL(SUPABASE_URL).origin}/functions/v1/esv-passage`);
      expect(url.searchParams.get("q")).toBe("Mark 4:1-2");
      expect(url.searchParams.get("format")).toBeNull();
      expect(url.toString()).not.toContain("api.esv.org");
      expect(url.toString()).not.toContain(SUPABASE_ANON_KEY);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
      expect(headers.get("apikey")).toBe(SUPABASE_ANON_KEY);
      expect(headers.get("Authorization")).not.toMatch(/^Token /);
      return jsonResponse({
        canonical: "Mark 4:1-2",
        passages: [SAMPLE_HTML],
      });
    };

    const result = await fetchEsvPassage("Mark 4:1–2", fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.passage.canonical).toBe("Mark 4:1-2");
      expect(result.passage.blocks[0]).toEqual({ kind: "heading", text: "Sample Heading" });
    }
    expect(seen).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(SUPABASE_ANON_KEY);
    expect(cachedEsvPassage("Mark 4:1-2")?.canonical).toBe("Mark 4:1-2");
    expect(esvUnavailable()).toBe(false);
  });

  it("reuses a cached passage without calling the network again", async () => {
    let calls = 0;
    const fetchImpl: EsvFetcher = async () => {
      calls += 1;
      return jsonResponse({ canonical: "Mark 4", passages: ["<p><b class=\"verse-num\" id=\"v41004001-1\">1</b>Sample line.</p>"] });
    };
    await fetchEsvPassage("Mark 4", fetchImpl);
    const second = await fetchEsvPassage("Mark 4", fetchImpl);
    expect(calls).toBe(1);
    expect(second.ok).toBe(true);
  });

  it("reports an empty passage, a rejected proxy, and a network failure", async () => {
    const empty = await fetchEsvPassage("Mark 4", async () => jsonResponse({ passages: ["   "] }));
    expect(empty).toEqual({ ok: false, reason: "empty" });
    expect(esvUnavailable()).toBe(false);

    const denied = await fetchEsvPassage("Mark 4", async () => jsonResponse({ error: "unauthorized" }, 502));
    expect(denied).toEqual({ ok: false, reason: "unauthorized" });
    expect(esvUnavailable()).toBe(true);

    resetEsvClientForTests();
    const offline = await fetchEsvPassage("Mark 5", async () => {
      throw new Error("offline");
    });
    expect(offline).toEqual({ ok: false, reason: "network" });
    expect(esvUnavailable()).toBe(false);
  });

  it("probes the proxy with a short text passage", async () => {
    const connected = await checkEsvAvailability(async (input, init) => {
      const url = input instanceof URL ? input : new URL(String(input));
      expect(url.pathname).toBe("/functions/v1/esv-passage");
      expect(url.searchParams.get("q")).toBe("John 11:35");
      expect(url.searchParams.get("format")).toBe("text");
      expect(url.toString()).not.toContain("api.esv.org");
      expect(url.toString()).not.toContain(SUPABASE_ANON_KEY);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
      expect(headers.get("apikey")).toBe(SUPABASE_ANON_KEY);
      return jsonResponse({ passages: ["Jesus wept. (ESV)"] });
    });
    expect(connected).toBe("available");
    expect(esvUnavailable()).toBe(false);

    const invalid = await checkEsvAvailability(async () => jsonResponse({ error: "unauthorized" }, 401));
    expect(invalid).toBe("unavailable");
    expect(esvUnavailable()).toBe(true);

    resetEsvClientForTests();
    const unreachable = await checkEsvAvailability(async () => {
      throw new Error("offline");
    });
    expect(unreachable).toBe("unreachable");
    expect(esvUnavailable()).toBe(false);
  });
});
