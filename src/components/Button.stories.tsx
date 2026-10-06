import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "./Icons";
import { Button } from "./ui";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    type: "button",
    children: "Continue",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Yes: Story = {
  args: {
    className: "btn-yes",
    children: "Yes",
  },
};

export const Quiet: Story = {
  args: {
    variant: "quiet",
    children: "Not today",
  },
};

export const Text: Story = {
  args: {
    variant: "text",
    children: "Skip for now",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Saved on this device",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Check size={18} aria-hidden="true" />
        Yes, I will
      </>
    ),
  },
};

export const LongLabel: Story = {
  args: {
    children: "Continue with today’s reading in the Gospel of Mark",
  },
};

export const OpenPassage: Story = {
  render: () => (
    <a className="btn btn-quiet btn-open" href="https://www.bible.com/bible/59/MRK.1.1-8.ESV" target="_blank" rel="noopener noreferrer">
      Open Mark 1:1–8 in YouVersion ↗
    </a>
  ),
};

export const OpenPassageOffline: Story = {
  render: () => (
    <a className="btn btn-quiet btn-open is-disabled" aria-disabled="true">
      Open Mark 1:1–8
    </a>
  ),
};
