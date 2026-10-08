import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vitest/config";
import { legacyRedirectPage, legacyRedirectSnippet, normalizeAppUrl } from "./src/lib/appUrl";

/** Site root. The hosted app is https://app.drip-by-drip.com, not /drip-by-drip/. */
const base = "/";

function legacyHostRedirect(configured: string | undefined): Plugin {
  const snippet = legacyRedirectSnippet(configured);
  return {
    name: "legacy-host-redirect",
    transformIndexHtml(html) {
      return html.replace("<!-- legacy-host-redirect -->", snippet);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "drip-by-drip/index.html",
        source: legacyRedirectPage(configured),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appOrigin = normalizeAppUrl(env.VITE_APP_URL);
  return {
    base,
    plugins: [
      react(),
      legacyHostRedirect(appOrigin),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: null,
        includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
        manifest: {
          id: base,
          name: "Drip by drip",
          short_name: "Drip",
          description: "A daily question, then a small drip of Scripture.",
          theme_color: "#2E5C61",
          background_color: "#F5F1E8",
          display: "standalone",
          start_url: base,
          scope: base,
          lang: "en",
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: `${base}icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,ttf}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    },
  };
});
