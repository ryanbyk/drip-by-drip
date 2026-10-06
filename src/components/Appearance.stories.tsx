import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { Appearance } from "../domain/appearance";
import { AppearanceField } from "./ui";

function AppearanceDemo({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  const [appearance, setAppearance] = useState(value);
  return (
    <section className="settings-group">
      <p className="eyebrow">What you’re reading</p>
      <div className="settings-card">
        <AppearanceField
          value={appearance}
          onChange={(next) => {
            setAppearance(next);
            onChange(next);
          }}
        />
      </div>
    </section>
  );
}

const meta = {
  title: "UI/Appearance",
  component: AppearanceField,
  args: {
    value: "system",
    onChange: fn(),
  },
  render: (args) => <AppearanceDemo key={args.value} value={args.value} onChange={args.onChange} />,
} satisfies Meta<typeof AppearanceField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = {};

export const Light: Story = {
  args: { value: "light" },
};

export const Dark: Story = {
  args: { value: "dark" },
  globals: { theme: "dark" },
};
