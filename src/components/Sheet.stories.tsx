import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BookPicker, Button, Sheet } from "./ui";

function SheetDemo({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </Button>
    );
  }
  return (
    <Sheet
      title={title}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
    >
      {children}
    </Sheet>
  );
}

const meta = {
  title: "UI/Sheet",
  component: Sheet,
  args: {
    title: "About Drip by drip",
    onClose: fn(),
    children: null,
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <SheetDemo title={args.title} onClose={args.onClose}>
      <p>A small, steady practice of reading Scripture. Frequency is not your standing with God — Christ alone is.</p>
      <p className="soft">Bible text opens in the Bible source you choose. This app keeps passage references and your own notes, not a Bible edition.</p>
      <Button type="button">Done</Button>
    </SheetDemo>
  ),
};

export const Overflow: Story = {
  args: { title: "Choose a book" },
  render: (args) => (
    <SheetDemo title={args.title} onClose={args.onClose}>
      <p className="lede">The list keeps going. The sheet scrolls, and the book list scrolls inside it.</p>
      <BookPicker selectedId="psalms" onSelect={() => {}} />
      <p className="soft">Your place stays saved on this device. Changing books does not erase notes you already wrote.</p>
      <p className="soft">A detour for one day is easy. The track you are reading through waits until tomorrow.</p>
      <Button type="button">Use this book</Button>
    </SheetDemo>
  ),
};
