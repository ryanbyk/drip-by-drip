import { describe, expect, it } from "vitest";
import { partnerInviteUrl } from "../domain/partner";
import { authRedirectUrl } from "./auth";
import {
  DEFAULT_APP_URL,
  appRoot,
  legacyDestination,
  legacyRedirectPage,
  legacyRedirectSnippet,
  normalizeAppUrl,
  notificationOpenUrl,
  pageOriginForLinks,
} from "./appUrl";

describe("app url", () => {
  it("defaults to the app subdomain and drops a path", () => {
    expect(DEFAULT_APP_URL).toBe("https://app.drip-by-drip.com");
    expect(normalizeAppUrl(undefined)).toBe(DEFAULT_APP_URL);
    expect(normalizeAppUrl("")).toBe(DEFAULT_APP_URL);
    expect(normalizeAppUrl("https://app.drip-by-drip.com/drip-by-drip/")).toBe(DEFAULT_APP_URL);
    expect(normalizeAppUrl("notaurl")).toBe(DEFAULT_APP_URL);
    expect(appRoot("https://app.drip-by-drip.com")).toBe("https://app.drip-by-drip.com/");
  });

  it("keeps localhost links local and sends the old Pages host to the app", () => {
    expect(pageOriginForLinks("http://localhost:5173", undefined)).toBe("http://localhost:5173");
    expect(pageOriginForLinks("http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173");
    expect(pageOriginForLinks("http://192.168.1.20:5173")).toBe("http://192.168.1.20:5173");
    expect(pageOriginForLinks("https://ryanbyk.github.io")).toBe(DEFAULT_APP_URL);
    expect(pageOriginForLinks("https://app.drip-by-drip.com")).toBe(DEFAULT_APP_URL);
    expect(authRedirectUrl(pageOriginForLinks("https://ryanbyk.github.io"), "/")).toBe(
      "https://app.drip-by-drip.com/",
    );
    expect(partnerInviteUrl(pageOriginForLinks("https://app.drip-by-drip.com"), "/", "4K7QXM2P")).toBe(
      "https://app.drip-by-drip.com/?partner=4K7QXM2P",
    );
  });

  it("sends the old base path and the old host back to the app root", () => {
    expect(legacyDestination("https://app.drip-by-drip.com/")).toBeNull();
    expect(legacyDestination("https://app.drip-by-drip.com/?partner=4K7QXM2P")).toBeNull();
    expect(legacyDestination("http://localhost:5173/")).toBeNull();
    expect(legacyDestination("https://app.drip-by-drip.com/drip-by-drip/?partner=4K7QXM2P#code")).toBe(
      "https://app.drip-by-drip.com/?partner=4K7QXM2P#code",
    );
    expect(legacyDestination("https://ryanbyk.github.io/drip-by-drip/?partner=4K7QXM2P")).toBe(
      "https://app.drip-by-drip.com/?partner=4K7QXM2P",
    );
    expect(legacyDestination("http://localhost:5173/drip-by-drip/")).toBe("http://localhost:5173/");
  });

  it("runs the same redirect from the injected script", () => {
    const snippet = legacyRedirectSnippet(undefined);
    expect(runSnippet("https://app.drip-by-drip.com/", snippet)).toBe("https://app.drip-by-drip.com/");
    expect(runSnippet("https://ryanbyk.github.io/drip-by-drip/?partner=4K7QXM2P", snippet)).toBe(
      "https://app.drip-by-drip.com/?partner=4K7QXM2P",
    );
    expect(runSnippet("https://app.drip-by-drip.com/drip-by-drip/?group=4K7QXM", snippet)).toBe(
      "https://app.drip-by-drip.com/?group=4K7QXM",
    );
    expect(legacyRedirectPage(undefined)).toContain('href="https://app.drip-by-drip.com/"');
    expect(legacyRedirectPage(undefined)).toContain("noindex");
  });

  it("opens a notification on the worker scope, not a foreign origin", () => {
    const scope = "https://app.drip-by-drip.com/";
    expect(notificationOpenUrl({ url: "https://app.drip-by-drip.com/" }, scope)).toBe(scope);
    expect(notificationOpenUrl({ href: "/" }, scope)).toBe(scope);
    expect(notificationOpenUrl({ url: "https://ryanbyk.github.io/drip-by-drip/" }, scope)).toBe(scope);
    expect(notificationOpenUrl(null, scope)).toBe(scope);
    expect(notificationOpenUrl({ href: "/?partner=4K7QXM2P" }, "http://localhost:4173/")).toBe(
      "http://localhost:4173/?partner=4K7QXM2P",
    );
  });
});

function runSnippet(href: string, snippet: string): string {
  const url = new URL(href);
  const location = {
    href: url.href,
    pathname: url.pathname,
    hostname: url.hostname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    replace(next: string) {
      this.href = next;
    },
  };
  const source = snippet.replace(/^<script>/, "").replace(/<\/script>$/, "");
  const run = new Function("location", "URL", source);
  run(location, URL);
  return location.href;
}
