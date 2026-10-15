import type { Meta, StoryObj } from "@storybook/react-vite";
import { localDate } from "../domain/dates";
import { NUDGE_NOTES } from "../domain/partner";
import type { GroupValue } from "../state/group-context";
import type { PartnerValue } from "../state/partner-context";
import { settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { Partner } from "./Partner";

const fromGroups: Partial<GroupValue> = {
  status: "ready",
  people: [
    { id: "dan", displayName: "Dan K.", groupName: "CrossWay Men’s Group" },
    { id: "jon", displayName: "Jon M.", groupName: "CrossWay Men’s Group" },
    { id: "kate", displayName: "Kate B.", groupName: "Bykowski Family" },
  ],
};

const paired: Partial<PartnerValue> = {
  status: "ready",
  partner: { id: "dan", displayName: "Dan K.", readToday: true },
  partners: [{ id: "dan", displayName: "Dan K.", readToday: true }],
  drops: [
    {
      id: "n1",
      senderId: "dan",
      recipientId: "ryan",
      body: NUDGE_NOTES[0],
      day: "2026-10-06",
      fromSelf: false,
      seen: true,
    },
  ],
};

const invite: Partial<PartnerValue> = {
  status: "ready",
  invite: { code: "4K7QXM2P", expiresAt: "2026-10-20T15:00:00.000Z" },
};

const incoming: Partial<PartnerValue> = {
  status: "ready",
  incoming: { code: "4K7QXM2P", inviterName: "Dan K." },
  pendingInvite: true,
};

function PartnerScreen({ partner, group }: { partner?: Partial<PartnerValue>; group?: Partial<GroupValue> }) {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp
      snapshot={snapshot}
      authUser={{ id: "story-user", email: "ryan@example.com", provider: "apple", displayName: "Ryan Bykowski" }}
      partner={partner}
      group={group}
    >
      <Phone tab="settings">
        <Partner onBack={() => undefined} initialId={partner?.partners?.[0]?.id ?? null} />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Partner",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Choose: Story = {
  name: "v1.5 · 12 · Choose a partner",
  render: () => <PartnerScreen partner={{ status: "ready" }} group={fromGroups} />,
};

export const Invite: Story = {
  name: "v1.5 · Partner invite",
  render: () => <PartnerScreen partner={invite} />,
};

export const Incoming: Story = {
  name: "v1.5 · Partner invite received",
  render: () => <PartnerScreen partner={incoming} />,
};

export const Paired: Story = {
  name: "v1.5 · Reading partner",
  render: () => <PartnerScreen partner={paired} />,
};

export const Shared: Story = {
  name: "Partner · shared note",
  render: () => (
    <PartnerScreen
      partner={paired}
      group={{
        status: "ready",
        notes: [
          {
            id: "note-dan",
            authorId: "dan",
            authorName: "Dan K.",
            day: localDate(),
            body: "The wind and the sea obey him.",
            groupIds: [],
            partnerIds: ["story-user"],
          },
        ],
      }}
    />
  ),
};
