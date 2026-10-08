/**
 * Canonical hosted app. The apex drip-by-drip.com is reserved for a future
 * marketing site and is not an app URL.
 * Override with VITE_APP_URL (client) or APP_URL (send-ask-push). A path on
 * the value is ignored: the app is served at the host root.
 */
export const DEFAULT_APP_URL = "https://app.drip-by-drip.com";

/** Previous GitHub Pages project host. Installs from here stay on that origin. */
export const LEGACY_PAGES_HOST = "ryanbyk.github.io";

/** Previous Vite base. GitHub serves the custom domain at `/`, not under this path. */
export const LEGACY_BASE_PATH = "/drip-by-drip";

export function normalizeAppUrl(value: string | undefined | null): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const chosen = raw || DEFAULT_APP_URL;
  try {
    const url = new URL(chosen);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_APP_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export function appRoot(value?: string | null): string {
  return `${normalizeAppUrl(value)}/`;
}

/**
 * Origin for auth returns and invite links.
 * Local and LAN pages stay where they are. The old github.io host builds
 * links on the configured app origin. Partner and group invite URLs should
 * pass this plus `import.meta.env.BASE_URL` (the site root).
 */
export function pageOriginForLinks(pageOrigin: string, configured?: string | null): string {
  try {
    const page = new URL(pageOrigin);
    if (page.hostname === LEGACY_PAGES_HOST) return normalizeAppUrl(configured);
    return page.origin;
  } catch {
    return normalizeAppUrl(configured);
  }
}

function barePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

/** Where a leftover github.io visit or `/drip-by-drip/` path should land. Null when already home. */
export function legacyDestination(href: string, configured?: string | null): string | null {
  let current: URL;
  try {
    current = new URL(href);
  } catch {
    return null;
  }
  const path = barePath(current.pathname);
  const legacyHost = current.hostname === LEGACY_PAGES_HOST;
  const legacyPath = path === LEGACY_BASE_PATH || path.startsWith(`${LEGACY_BASE_PATH}/`);
  if (!legacyHost && !legacyPath) return null;
  const origin = legacyHost ? normalizeAppUrl(configured) : current.origin;
  const next = new URL("/", origin);
  next.search = current.search;
  next.hash = current.hash;
  if (next.href === current.href) return null;
  return next.href;
}

/** Inline script for index.html and the `/drip-by-drip/` fallback page. Same rules as `legacyDestination`. */
export function legacyRedirectSnippet(configured?: string | null): string {
  const app = normalizeAppUrl(configured);
  return `<script>(function(){var app=${JSON.stringify(app)};var path=(location.pathname||"/").replace(/\\/+$/,"")||"/";var legacyHost=location.hostname===${JSON.stringify(LEGACY_PAGES_HOST)};var legacyPath=path===${JSON.stringify(LEGACY_BASE_PATH)}||path.indexOf(${JSON.stringify(`${LEGACY_BASE_PATH}/`)})===0;if(!legacyHost&&!legacyPath)return;var next=new URL("/",legacyHost?app:location.origin);next.search=location.search;next.hash=location.hash;if(next.href!==location.href)location.replace(next.href);})();</script>`;
}

/** Served at `/drip-by-drip/` when a request still carries the old base path. */
export function legacyRedirectPage(configured?: string | null): string {
  const root = appRoot(configured);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${root}" />
    <title>Drip by drip</title>
    ${legacyRedirectSnippet(configured)}
  </head>
  <body>
    <p><a href="${root}">Open Drip by drip</a></p>
  </body>
</html>
`;
}

/**
 * Absolute URL a notification click may open. Same-origin only.
 * `scope` is the service worker registration scope (the app root on that origin).
 */
export function notificationOpenUrl(data: unknown, scope: string): string {
  let fallback: URL;
  try {
    fallback = new URL(scope);
  } catch {
    fallback = new URL(appRoot());
  }
  const raw = notificationHref(data);
  if (!raw) return fallback.href;
  try {
    const url = new URL(raw, fallback);
    if (url.origin !== fallback.origin) return fallback.href;
    return url.href;
  } catch {
    return fallback.href;
  }
}

function notificationHref(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as { url?: unknown; href?: unknown };
  if (typeof record.url === "string" && record.url.trim()) return record.url.trim();
  if (typeof record.href === "string" && record.href.trim()) return record.href.trim();
  return "";
}
