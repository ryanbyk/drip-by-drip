import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { localDate } from "../domain/dates";
import { resolvePassage, type ResolvedPassage } from "../domain/resolve";
import type { Snapshot } from "../domain/types";
import {
  askSnapshot,
  bookPassageSnapshot,
  commitSnapshot,
  detourReturnSnapshot,
  doneSnapshot,
  finishedSnapshot,
  graceSnapshot,
  passagePlanSnapshot,
  recapSnapshot,
  reflectSnapshot,
  somethingElseSnapshot,
  welcomeSnapshot,
} from "../storybook/fixtures";
import type { GroupValue } from "../state/group-context";
import type { PartnerValue } from "../state/partner-context";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { ShareNoteSheet } from "./ShareNote";
import { AskView } from "./today/AskView";
import { DogView } from "./today/DogView";
import { DoneView } from "./today/DoneView";
import { GraceView } from "./today/GraceView";
import { AdjustSheet, CommitSheet, FinishedView, ReflectView, StopSheet } from "./today/MoreViews";
import { PassageView } from "./today/PassageView";
import { RecapView } from "./today/RecapView";

const passageActions = {
  onAdjust: () => undefined,
  onChangeBook: () => undefined,
  onDetour: () => undefined,
  onUseDetour: () => undefined,
  onBackToBook: () => undefined,
  onReflect: () => undefined,
  onRead: () => undefined,
  onPlanRef: () => undefined,
};

function TodayScreen({ create, children }: { create: () => Snapshot; children: ReactNode }) {
  const snapshot = useFixture(create);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="today">
        <section className="screen screen-tabbed">{children}</section>
      </Phone>
    </StoryApp>
  );
}

function PassageScreen({
  create,
  sheet,
}: {
  create: () => Snapshot;
  sheet?: "adjust" | "stop";
}) {
  const snapshot = useFixture(create);
  const passage = resolvePassage(snapshot, localDate());
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="today">
        <section className="screen screen-tabbed">
          <OpenPassage passage={passage} />
          {sheet === "adjust" && passage.kind === "book" ? (
            <AdjustSheet onClose={() => undefined} onDetour={() => undefined} />
          ) : null}
          {sheet === "stop" && passage.kind === "book" ? <StopSheet onClose={() => undefined} /> : null}
        </section>
      </Phone>
    </StoryApp>
  );
}

function OpenPassage({ passage }: { passage: ResolvedPassage }) {
  if (passage.kind === "finished" || passage.kind === "plan-finished") return null;
  return <PassageView passage={passage} {...passageActions} />;
}

const meta = {
  title: "Screens/Today",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ask: Story = {
  name: "C · Today — Ask",
  render: () => (
    <TodayScreen create={askSnapshot}>
      <AskView onYes={() => undefined} onNotToday={() => undefined} />
    </TodayScreen>
  ),
};

export const AskDark: Story = {
  name: "Dark · C · Today — Ask",
  globals: { theme: "dark" },
  render: () => (
    <TodayScreen create={askSnapshot}>
      <AskView onYes={() => undefined} onNotToday={() => undefined} />
    </TodayScreen>
  ),
};

export const Commit: Story = {
  name: "D · Today — Commit sheet",
  render: () => (
    <TodayScreen create={commitSnapshot}>
      <AskView onYes={() => undefined} onNotToday={() => undefined} />
      <CommitSheet onContinue={() => undefined} />
    </TodayScreen>
  ),
};

export const Dog: Story = {
  name: "E · Today — DOG prayer",
  render: () => (
    <TodayScreen create={commitSnapshot}>
      <DogView onContinue={() => undefined} onSkip={() => undefined} />
    </TodayScreen>
  ),
};

export const PassagePlan: Story = {
  name: "F · Today — Passage",
  render: () => <PassageScreen create={passagePlanSnapshot} />,
};

export const Done: Story = {
  name: "G · Today — Done",
  render: () => (
    <TodayScreen create={doneSnapshot}>
      <DoneView />
    </TodayScreen>
  ),
};

const shareGroups: Partial<GroupValue> = {
  status: "ready",
  groups: [
    {
      id: "mens",
      name: "CrossWay Men’s Group",
      description: null,
      ownerId: "mike",
      role: "member",
      memberCount: 8,
      readCount: 5,
      preview: [],
      plan: null,
    },
    {
      id: "family",
      name: "Bykowski Family",
      description: null,
      ownerId: "kate",
      role: "member",
      memberCount: 4,
      readCount: 2,
      preview: [],
      plan: null,
    },
  ],
};

const sharePartner: Partial<PartnerValue> = {
  status: "ready",
  partner: { id: "dan", displayName: "Dan K.", readToday: true },
  partners: [{ id: "dan", displayName: "Dan K.", readToday: true }],
};

export const ShareNote: Story = {
  name: "Share a note",
  render: () => {
    const snapshot = useFixture(doneSnapshot);
    return (
      <StoryApp
        snapshot={snapshot}
        authUser={{ id: "story-user", email: "ryan@example.com", provider: "apple", displayName: "Ryan Bykowski" }}
        partner={sharePartner}
        group={shareGroups}
      >
        <Phone tab="today">
          <section className="screen screen-tabbed">
            <DoneView />
            <ShareNoteSheet
              groups={[
                { id: "mens", name: "CrossWay Men’s Group" },
                { id: "family", name: "Bykowski Family" },
              ]}
              partners={[{ id: "dan", name: "Dan K." }]}
              shared={null}
              busy={false}
              error={null}
              onClose={() => undefined}
              onShare={() => undefined}
              onStop={() => undefined}
            />
          </section>
        </Phone>
      </StoryApp>
    );
  },
};

export const NotToday: Story = {
  name: "H · Today — Not today",
  render: () => (
    <TodayScreen create={graceSnapshot}>
      <GraceView onHistory={() => undefined} onReadAfterAll={() => undefined} />
    </TodayScreen>
  ),
};

export const Passage: Story = {
  name: "M · Today — Passage (book track)",
  render: () => <PassageScreen create={bookPassageSnapshot} />,
};

export const PassageDark: Story = {
  name: "Dark · M · Today — Passage (book track)",
  globals: { theme: "dark" },
  render: () => <PassageScreen create={bookPassageSnapshot} />,
};

export const Adjust: Story = {
  name: "N · Adjust passage sheet",
  render: () => <PassageScreen create={bookPassageSnapshot} sheet="adjust" />,
};

export const Stop: Story = {
  name: "O · Where did you stop? sheet",
  render: () => <PassageScreen create={bookPassageSnapshot} sheet="stop" />,
};

export const WelcomeBack: Story = {
  name: "P · Passage — Welcome back variant",
  render: () => <PassageScreen create={welcomeSnapshot} />,
};

export const AfterDetour: Story = {
  name: "Q · Passage — Back after a detour",
  render: () => <PassageScreen create={detourReturnSnapshot} />,
};

export const BookFinished: Story = {
  name: "R · Book finished",
  render: () => (
    <TodayScreen create={finishedSnapshot}>
      <FinishedView onDetour={() => undefined} onChoose={() => undefined} onRecap={() => undefined} />
    </TodayScreen>
  ),
};

export const SomethingElse: Story = {
  name: "S · Passage — Something else",
  render: () => <PassageScreen create={somethingElseSnapshot} />,
};

export const Recap: Story = {
  name: "T · Book recap — stats",
  render: () => (
    <TodayScreen create={recapSnapshot}>
      <RecapView onNext={() => undefined} />
    </TodayScreen>
  ),
};

export const Reflect: Story = {
  name: "U · Reflect — notes while reading",
  render: () => (
    <TodayScreen create={reflectSnapshot}>
      <ReflectView onKeep={() => undefined} onRead={() => undefined} />
    </TodayScreen>
  ),
};

export const ReflectDark: Story = {
  name: "Dark · U · Reflect — notes while reading",
  globals: { theme: "dark" },
  render: () => (
    <TodayScreen create={reflectSnapshot}>
      <ReflectView onKeep={() => undefined} onRead={() => undefined} />
    </TodayScreen>
  ),
};
