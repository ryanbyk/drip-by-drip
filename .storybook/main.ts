import { withoutVitePlugins } from "@storybook/builder-vite";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    // The app is served from /drip-by-drip/ and registers a service worker.
    // Storybook needs a root base and should not build that worker.
    config.base = "/";
    config.plugins = await withoutVitePlugins(config.plugins, [
      "vite-plugin-pwa",
      "vite-plugin-pwa:build",
      "vite-plugin-pwa:dev-sw",
      "vite-plugin-pwa:info",
      "vite-plugin-pwa:pwa-assets",
    ]);
    return config;
  },
};

export default config;
