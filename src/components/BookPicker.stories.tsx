import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookPicker } from "./ui";

function BookPickerDemo({ selectedId, onSelect }: { selectedId: string; onSelect: (bookId: string) => void }) {
  const [id, setId] = useState(selectedId);
  return (
    <BookPicker
      selectedId={id}
      onSelect={(next) => {
        setId(next);
        onSelect(next);
      }}
    />
  );
}

const meta = {
  title: "UI/BookPicker",
  component: BookPicker,
  args: {
    selectedId: "mark",
    onSelect: fn(),
  },
  render: (args) => <BookPickerDemo key={args.selectedId} selectedId={args.selectedId} onSelect={args.onSelect} />,
} satisfies Meta<typeof BookPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mark: Story = {};

export const Psalms: Story = {
  args: { selectedId: "psalms" },
};

export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText("Search all 66 books"), "zzzz");
    await expect(canvas.queryByText("Old Testament")).not.toBeInTheDocument();
    await expect(canvas.queryByText("New Testament")).not.toBeInTheDocument();
  },
};
