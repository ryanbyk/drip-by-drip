import type { Meta, StoryObj } from "@storybook/react-vite";
import { History } from "./History";
import { historySnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";

function HistoryScreen() {
  const snapshot = useFixture(historySnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="history">
        <History onOpenToday={() => undefined} />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/History",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Days: Story = {
  name: "I · History",
  render: () => <HistoryScreen />,
};

export const DaysDark: Story = {
  name: "Dark · I · History",
  globals: { theme: "dark" },
  render: () => <HistoryScreen />,
};
