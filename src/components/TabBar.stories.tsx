import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TabBar } from "./ui";

type Tab = "today" | "history" | "settings";

const TITLES: Record<Tab, string> = {
  today: "Will you read God’s word today?",
  history: "History",
  settings: "Settings",
};

function TabBarDemo({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const [current, setCurrent] = useState(tab);
  return (
    <div className="app-shell">
      <div className="phone">
        <div className="screen screen-tabbed">
          <p className="kicker">Drip by drip</p>
          <h1>{TITLES[current]}</h1>
        </div>
        <TabBar
          tab={current}
          onTab={(next) => {
            setCurrent(next);
            onTab(next);
          }}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "UI/TabBar",
  component: TabBar,
  parameters: { appFrame: "bare" },
  args: {
    tab: "today",
    onTab: fn(),
  },
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {
  render: (args) => <TabBarDemo key={args.tab} tab={args.tab} onTab={args.onTab} />,
};

export const History: Story = {
  args: { tab: "history" },
  render: (args) => <TabBarDemo key={args.tab} tab={args.tab} onTab={args.onTab} />,
};

export const Settings: Story = {
  args: { tab: "settings" },
  render: (args) => <TabBarDemo key={args.tab} tab={args.tab} onTab={args.onTab} />,
};
