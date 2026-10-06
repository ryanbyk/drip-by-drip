import type { Meta, StoryObj } from "@storybook/react-vite";
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
