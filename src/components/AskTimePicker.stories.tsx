import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AskTimePicker } from "./ui";

function AskTimeDemo({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [time, setTime] = useState(value);
  return (
    <AskTimePicker
      value={time}
      onChange={(next) => {
        setTime(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "UI/AskTimePicker",
  component: AskTimePicker,
  args: {
    value: "06:30",
    onChange: fn(),
  },
  render: (args) => <AskTimeDemo key={args.value} value={args.value} onChange={args.onChange} />,
} satisfies Meta<typeof AskTimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Morning: Story = {};

export const Midday: Story = {
  args: { value: "12:30" },
};

export const Evening: Story = {
  args: { value: "20:30" },
};

export const Custom: Story = {
  args: { value: "09:15" },
};
