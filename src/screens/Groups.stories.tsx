import type { Meta, StoryObj } from "@storybook/react-vite";
import type { GroupCard, HomeMember, PartnerCandidate } from "../domain/social";
import type { GroupValue } from "../state/group-context";
import type { PartnerValue } from "../state/partner-context";
import { settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { Groups } from "./Groups";

const mens: GroupCard = {
  id: "mens",
  name: "CrossWay Men’s Group",
  description: null,
  ownerId: "mike",
  role: "member",
  memberCount: 8,
  readCount: 5,
  preview: [
    { id: "dan", displayName: "Dan K.", readToday: true },
    { id: "jon", displayName: "Jon M.", readToday: true },
    { id: "sam", displayName: "Sam P.", readToday: true },
    { id: "alex", displayName: "Alex L.", readToday: true },
  ],
};

const family: GroupCard = {
  id: "family",
  name: "Bykowski Family",
  description: null,
  ownerId: "kate",
  role: "member",
  memberCount: 4,
  readCount: 2,
  preview: [
    { id: "kate", displayName: "Kate B.", readToday: true },
    { id: "erin", displayName: "Erin B.", readToday: true },
    { id: "luke", displayName: "Luke B.", readToday: false },
  ],
};

const members: HomeMember[] = [
  { id: "dan", displayName: "Dan K.", readToday: true, role: "member", self: false, sentDropToday: true },
  { id: "jon", displayName: "Jon M.", readToday: true, role: "member", self: false, sentDropToday: false },
  { id: "ryan", displayName: "Ryan", readToday: true, role: "member", self: true, sentDropToday: false },
  { id: "sam", displayName: "Sam P.", readToday: true, role: "member", self: false, sentDropToday: false },
  { id: "alex", displayName: "Alex L.", readToday: true, role: "member", self: false, sentDropToday: false },
  { id: "mike", displayName: "Mike T.", readToday: false, role: "owner", self: false, sentDropToday: false },
];

const people: PartnerCandidate[] = [
  { id: "dan", displayName: "Dan K.", groupName: "CrossWay Men’s Group" },
  { id: "jon", displayName: "Jon M.", groupName: "CrossWay Men’s Group" },
  { id: "kate", displayName: "Kate B.", groupName: "Bykowski Family" },
];

const group: Partial<GroupValue> = {
  status: "ready",
  groups: [mens, family],
  members: { mens: members },
  invites: { mens: { code: "4K7QXM", expiresAt: "2026-10-15T18:00:00.000Z" } },
  people,
  pendingCode: "4K7QXM",
  lookup: async () => ({
    name: "CrossWay Men’s Group",
    leaderName: "Pastor Mike",
    memberCount: 8,
    alreadyMember: false,
    full: false,
  }),
};

const partner: Partial<PartnerValue> = {
  status: "ready",
  partner: { id: "dan", displayName: "Dan K.", readToday: true },
  partners: [{ id: "dan", displayName: "Dan K.", readToday: true }],
};

const user = { id: "story-user", email: "ryan@example.com", provider: "apple" as const, displayName: "Ryan Bykowski" };

function GroupsScreen({
  start,
  draft,
  value = group,
}: {
  start?: "list" | "create" | "join" | "home" | "invite";
  draft?: { name: string; description: string };
  value?: Partial<GroupValue>;
}) {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot} authUser={user} partner={partner} group={value}>
      <Phone tab="settings">
        <Groups onBack={() => undefined} onOpenPartner={() => undefined} onReadToday={() => undefined} start={start} draft={draft} />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Groups",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mine: Story = {
  name: "v1.5 · 4 · My groups",
  render: () => <GroupsScreen />,
};

export const Create: Story = {
  name: "v1.5 · 5 · Create group",
  render: () => (
    <GroupsScreen
      start="create"
      draft={{ name: "Tuesday Night Group", description: "Men’s small group · reading together this fall" }}
    />
  ),
};

export const Join: Story = {
  name: "v1.5 · 6 · Join with code",
  render: () => <GroupsScreen start="join" />,
};

export const Home: Story = {
  name: "v1.5 · 7 · Group home",
  render: () => <GroupsScreen start="home" />,
};

export const Invite: Story = {
  name: "v1.5 · 8 · Invite",
  render: () => <GroupsScreen start="invite" />,
};
