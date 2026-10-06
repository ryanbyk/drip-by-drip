import type { Meta, StoryObj } from "@storybook/react-vite";
import { StartingChapterSheet } from "../components/StartingChapter";
import { Onboarding } from "./Onboarding";
import { askTimeSnapshot, framingSnapshot, pickBookSnapshot, whatToReadSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import type { Snapshot } from "../domain/types";

function OnboardingScreen({ create }: { create: () => Snapshot }) {
  const snapshot = useFixture(create);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <Onboarding />
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Onboarding",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Framing: Story = {
  name: "A · Onboarding — Framing",
  render: () => <OnboardingScreen create={framingSnapshot} />,
};

export const AskTime: Story = {
  name: "B · Onboarding — Ask time",
  render: () => <OnboardingScreen create={askTimeSnapshot} />,
};

export const WhatToRead: Story = {
  name: "K · Onboarding — What to read",
  render: () => <OnboardingScreen create={whatToReadSnapshot} />,
};

export const PickABook: Story = {
  name: "L · Onboarding — Pick a book",
  render: () => <OnboardingScreen create={pickBookSnapshot} />,
};

function StartingChapterStory({
  bookId,
  chapter,
  countEarlier,
}: {
  bookId: string;
  chapter: number;
  countEarlier: boolean;
}) {
  const snapshot = useFixture(() => {
    const base = pickBookSnapshot();
    return { ...base, prefs: { ...base.prefs, bookId } };
  });
  return (
    <StoryApp snapshot={snapshot}>
      <Phone>
        <Onboarding />
        <StartingChapterSheet
          bookId={bookId}
          initialChapter={chapter}
          initialCountEarlier={countEarlier}
          onClose={() => undefined}
          onConfirm={() => undefined}
        />
      </Phone>
    </StoryApp>
  );
}

export const StartingChapter: Story = {
  name: "X · Pick a starting chapter sheet",
  render: () => <StartingChapterStory bookId="mark" chapter={4} countEarlier />,
};

export const StartingPsalms: Story = {
  name: "Y · Pick a starting chapter — long book (Psalms)",
  render: () => <StartingChapterStory bookId="psalms" chapter={42} countEarlier={false} />,
};

export const StartingIsaiah: Story = {
  name: "Z · Pick a starting chapter — long book (Isaiah)",
  render: () => <StartingChapterStory bookId="isaiah" chapter={40} countEarlier />,
};
