import { useEffect, type ReactNode } from "react";
import type { Preview } from "@storybook/react-vite";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-400-italic.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "@fontsource/roboto/latin-500.css";
import "../src/index.css";

function ThemeFrame({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  document.documentElement.dataset.theme = theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return children;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light and dark design tokens",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      story: {
        inline: false,
        iframeHeight: 780,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";
      const story =
        context.parameters.appFrame === "bare" ? (
          <Story />
        ) : (
          <div className="app-shell">
            <div className="phone">
              <div className="screen">
                <Story />
              </div>
            </div>
          </div>
        );
      return <ThemeFrame theme={theme}>{story}</ThemeFrame>;
    },
  ],
};

export default preview;
