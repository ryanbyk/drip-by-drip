import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { historySnapshot, settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { History } from "./History";
import { Settings } from "./Settings";

type StatusScreen = "history" | "settings";

const REST =
  "At rest the glass stays behind the screen. Titles stay sharp; there is no frost.";
const SCROLLED =
  "Once the title scrolls into the strip, blur is only in that top 16px band. The rest of the title stays sharp.";

/** Keep the shell phone-tall so History and Settings can scroll the title into the strip. */
function fitStatusGlassPhone(phone: HTMLElement) {
  phone.style.minHeight = "0";
  phone.style.height = "min(100dvh, 844px)";
}

/** Place the page title across the status strip so the frost is visible on the word. */
function scrollTitleIntoStatusStrip(phone: HTMLElement) {
  const scroller = phone.querySelector<HTMLElement>(".screen");
  const title = scroller?.querySelector("h1");
  const band = phone.querySelector<HTMLElement>(".status-glass");
  if (!scroller || !title || !band) return;
  const bandRect = band.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const targetTop = bandRect.top + bandRect.height * 0.25;
  scroller.scrollTop += titleRect.top - targetTop;
}

function ScreenBody({ screen }: { screen: StatusScreen }): ReactNode {
  switch (screen) {
    case "history":
      return <History onOpenToday={() => undefined} />;
    case "settings":
      return <Settings />;
    default: {
      const exhaustive: never = screen;
      return exhaustive;
    }
  }
}

function StatusGlassScreen({ screen, scrolled }: { screen: StatusScreen; scrolled: boolean }) {
  const snapshot = useFixture(screen === "history" ? historySnapshot : settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone
        tab={screen}
        prepare={(phone) => {
          fitStatusGlassPhone(phone);
          if (scrolled) scrollTitleIntoStatusStrip(phone);
        }}
      >
        <ScreenBody screen={screen} />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Status glass",
  parameters: {
    appFrame: "bare",
    docs: {
      description: {
        component:
          "Status glass is the short strip at the top of the phone. At rest it sits behind the screen, so titles stay sharp. After content scrolls into the strip, blur is only in that top 16px band.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HistoryRest: Story = {
  name: "History · rest · sharp titles",
  parameters: { docs: { description: { story: REST } } },
  render: () => <StatusGlassScreen screen="history" scrolled={false} />,
};

export const HistoryScrolled: Story = {
  name: "History · scrolled · blur only in the top strip",
  parameters: { docs: { description: { story: SCROLLED } } },
  render: () => <StatusGlassScreen screen="history" scrolled />,
};

export const SettingsRest: Story = {
  name: "Settings · rest · sharp titles",
  parameters: { docs: { description: { story: REST } } },
  render: () => <StatusGlassScreen screen="settings" scrolled={false} />,
};

export const SettingsScrolled: Story = {
  name: "Settings · scrolled · blur only in the top strip",
  parameters: { docs: { description: { story: SCROLLED } } },
  render: () => <StatusGlassScreen screen="settings" scrolled />,
};

export const HistoryRestDark: Story = {
  name: "Dark · History · rest · sharp titles",
  globals: { theme: "dark" },
  parameters: { docs: { description: { story: REST } } },
  render: () => <StatusGlassScreen screen="history" scrolled={false} />,
};

export const HistoryScrolledDark: Story = {
  name: "Dark · History · scrolled · blur only in the top strip",
  globals: { theme: "dark" },
  parameters: { docs: { description: { story: SCROLLED } } },
  render: () => <StatusGlassScreen screen="history" scrolled />,
};

export const SettingsRestDark: Story = {
  name: "Dark · Settings · rest · sharp titles",
  globals: { theme: "dark" },
  parameters: { docs: { description: { story: REST } } },
  render: () => <StatusGlassScreen screen="settings" scrolled={false} />,
};

export const SettingsScrolledDark: Story = {
  name: "Dark · Settings · scrolled · blur only in the top strip",
  globals: { theme: "dark" },
  parameters: { docs: { description: { story: SCROLLED } } },
  render: () => <StatusGlassScreen screen="settings" scrolled />,
};
