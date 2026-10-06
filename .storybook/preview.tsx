import type { Preview } from "@storybook/react-vite";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-400-italic.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "../src/index.css";

const preview: Preview = {
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
      if (context.parameters.appFrame === "bare") return <Story />;
      return (
        <div className="app-shell">
          <div className="phone">
            <div className="screen">
              <Story />
            </div>
          </div>
        </div>
      );
    },
  ],
};

export default preview;
