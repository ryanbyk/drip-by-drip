import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachedEsvPassage,
  esvKeyRejected,
  fetchEsvPassage,
  parseEsvHtml,
  resetEsvClientForTests,
  validateEsvApiKey,
  type EsvFetcher,
} from "./esvApi";
import { ESV_COPYRIGHT } from "../domain/esv";

const SECRET = "super-secret-esv-key";

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

  it("uses the standard notice when the response only marks the text as ESV", () => {
    const passage = parseEsvHtml("<p>(<a class=\"copyright\" href=\"https://www.esv.org\">ESV</a>)</p><p>Sample line.</p>", "John 1:1", "John 1:1");
    expect(passage.copyright).toBe(ESV_COPYRIGHT);
    expect(passage.blocks).toEqual([
      { kind: "paragraph", runs: [{ kind: "text", text: "Sample line." }] },
    ]);
  });
});

describe("ESV fetch client", () => {
  it("sends the key as a token header, never in the URL, and never logs it", async () => {
    const logs: unknown[][] = [];
    for (const method of ["log", "info", "debug", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logs.push(args);
      });
    }
    const seen: string[] = [];
    const fetchImpl: EsvFetcher = async (input, init) => {
      const url = input instanceof URL ? input.toString() : String(input);
      seen.push(url);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Token ${SECRET}`);
      expect(url).not.toContain(SECRET);
      return jsonResponse({
        canonical: "Mark 4:1-2",
        passages: [SAMPLE_HTML],
      });
    };

    const result = await fetchEsvPassage("Mark 4:1–2", SECRET, fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.passage.canonical).toBe("Mark 4:1-2");
      expect(result.passage.blocks[0]).toEqual({ kind: "heading", text: "Sample Heading" });
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("q=Mark+4%3A1-2");
    expect(JSON.stringify(logs)).not.toContain(SECRET);
    expect(cachedEsvPassage("Mark 4:1-2")?.canonical).toBe("Mark 4:1-2");
  });

  it("reuses a cached passage without calling the network again", async () => {
    let calls = 0;
    const fetchImpl: EsvFetcher = async () => {
      calls += 1;
      return jsonResponse({ canonical: "Mark 4", passages: ["<p><b class=\"verse-num\" id=\"v41004001-1\">1</b>Sample line.</p>"] });
    };
    await fetchEsvPassage("Mark 4", "device-key", fetchImpl);
    const second = await fetchEsvPassage("Mark 4", "device-key", fetchImpl);
    expect(calls).toBe(1);
    expect(second.ok).toBe(true);
  });

  it("reports an empty passage, a rejected key, and a network failure", async () => {
    const empty = await fetchEsvPassage(
      "Mark 4",
      "device-key",
      async () => jsonResponse({ passages: ["   "] }),
    );
    expect(empty).toEqual({ ok: false, reason: "empty" });

    const denied = await fetchEsvPassage("Mark 4", SECRET, async () => jsonResponse({ detail: "no" }, 403));
    expect(denied).toEqual({ ok: false, reason: "unauthorized" });
    expect(esvKeyRejected(SECRET)).toBe(true);

    const offline = await fetchEsvPassage("Mark 5", "device-key", async () => {
      throw new Error("offline");
    });
    expect(offline).toEqual({ ok: false, reason: "network" });
    expect(esvKeyRejected("device-key")).toBe(false);
  });

  it("validates a key with a short passage request", async () => {
    const connected = await validateEsvApiKey(SECRET, async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      expect(url).toContain("/passage/text/");
      expect(url).not.toContain(SECRET);
      return jsonResponse({ passages: ["Sample line. (ESV)"] });
    });
    expect(connected).toBe("connected");
    expect(esvKeyRejected(SECRET)).toBe(false);

    const invalid = await validateEsvApiKey("device-key", async () => jsonResponse({ detail: "no" }, 401));
    expect(invalid).toBe("invalid");
    expect(esvKeyRejected("device-key")).toBe(true);

    const unreachable = await validateEsvApiKey("other-key", async () => {
      throw new Error("offline");
    });
    expect(unreachable).toBe("unreachable");
    expect(esvKeyRejected("other-key")).toBe(false);
  });
});
