import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReportIssueSheet, type ReportIssuePreview } from "../components/ReportIssueSheet";
import { BibleSource } from "./BibleSource";
import { Settings } from "./Settings";
import type { GroupValue } from "../state/group-context";
import type { PartnerValue } from "../state/partner-context";
import { bibleSourceSnapshot, settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";

const togetherGroup: Partial<GroupValue> = {
  status: "ready",
  groups: [
    { id: "a", name: "One", description: null, ownerId: "x", role: "member", memberCount: 1, readCount: 0, preview: [], plan: null },
    { id: "b", name: "Two", description: null, ownerId: "x", role: "member", memberCount: 1, readCount: 0, preview: [], plan: null },
    { id: "c", name: "Three", description: null, ownerId: "x", role: "member", memberCount: 1, readCount: 0, preview: [], plan: null },
  ],
};

const togetherPartner: Partial<PartnerValue> = {
  status: "ready",
  partner: { id: "dan", displayName: "Dan K.", readToday: true },
  partners: [{ id: "dan", displayName: "Dan K.", readToday: true }],
};

function SettingsScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="settings">
        <Settings />
      </Phone>
    </StoryApp>
  );
}

function BibleSourceScreen() {
  const snapshot = useFixture(bibleSourceSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="settings">
        <BibleSource onBack={() => undefined} reach="available" />
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

function TogetherScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp
      snapshot={snapshot}
      authUser={{ id: "story-user", email: "ryan@example.com", provider: "apple", displayName: "Ryan Bykowski" }}
      partner={togetherPartner}
      group={togetherGroup}
    >
      <Phone tab="settings">
        <Settings />
      </Phone>
    </StoryApp>
  );
}

export const Together: Story = {
  name: "v1.5 · 15 · Settings together",
  render: () => <TogetherScreen />,
};

export const Main: Story = {
  name: "J · Settings",
  render: () => <SettingsScreen />,
};

export const MainDark: Story = {
  name: "Dark · J · Settings",
  globals: { theme: "dark" },
  render: () => <SettingsScreen />,
};

export const BibleSourceStory: Story = {
  name: "V · Settings — Bible source",
  render: () => <BibleSourceScreen />,
};

const sampleReportDiagnostics = {
  appUrl: "https://app.drip-by-drip.com",
  path: "/",
  displayMode: "standalone" as const,
  appearance: "System",
  signedIn: true,
  syncEnabled: true,
  notificationsEnabled: true,
  viewport: "390×844",
  timeZone: "America/Chicago",
};

function ReportIssueStoryScreen({ preview }: { preview: ReportIssuePreview }) {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp
      snapshot={snapshot}
      authUser={{ id: "story-user", email: "ryan@example.com", provider: "email", displayName: "Ryan Bykowski" }}
    >
      <Phone tab="settings">
        <Settings />
        <ReportIssueSheet onClose={() => undefined} preview={{ diagnostics: sampleReportDiagnostics, ...preview }} />
      </Phone>
    </StoryApp>
  );
}

export const ReportIssue: Story = {
  name: "Settings — Report an issue",
  render: () => <ReportIssueStoryScreen preview={{ category: "bug" }} />,
};

export const ReportIssueDark: Story = {
  name: "Dark · Settings — Report an issue",
  globals: { theme: "dark" },
  render: () => <ReportIssueStoryScreen preview={{ category: "suggestion" }} />,
};

export const ReportIssueSent: Story = {
  name: "Settings — Report sent",
  render: () => <ReportIssueStoryScreen preview={{ submitted: true, identifier: "CW-93" }} />,
};
