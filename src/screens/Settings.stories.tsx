import type { Meta, StoryObj } from "@storybook/react-vite";
import { BibleSource } from "./BibleSource";
import { Settings } from "./Settings";
import { bibleSourceSnapshot, settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";

function SettingsScreen({ developerTools }: { developerTools?: boolean }) {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="settings">
        <Settings developerTools={developerTools} />
      </Phone>
    </StoryApp>
  );
}

function BibleSourceScreen() {
  const snapshot = useFixture(bibleSourceSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="settings">
        <BibleSource onBack={() => undefined} />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Settings",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = {
  name: "J · Settings",
  render: () => <SettingsScreen developerTools={false} />,
};

export const MainDark: Story = {
  name: "Dark · J · Settings",
  globals: { theme: "dark" },
  render: () => <SettingsScreen developerTools={false} />,
};

export const Developer: Story = {
  name: "J · Settings — developer",
  render: () => <SettingsScreen developerTools />,
};

export const BibleSourceStory: Story = {
  name: "V · Settings — Bible source",
  render: () => <BibleSourceScreen />,
};
