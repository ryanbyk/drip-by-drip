import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { DripSize } from "../domain/types";
import { PacePicker } from "./ui";

function PaceDemo({ value, onChange }: { value: DripSize; onChange: (size: DripSize) => void }) {
  const [size, setSize] = useState(value);
  return (
    <PacePicker
      value={size}
      onChange={(next) => {
        setSize(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "UI/PacePicker",
  component: PacePicker,
  args: {
    value: "verses",
    onChange: fn(),
  },
  render: (args) => <PaceDemo key={args.value} value={args.value} onChange={args.onChange} />,
} satisfies Meta<typeof PacePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AFewVerses: Story = {};

export const OneChapter: Story = {
  args: { value: "chapter" },
};

export const TwoChapters: Story = {
  args: { value: "two" },
};
