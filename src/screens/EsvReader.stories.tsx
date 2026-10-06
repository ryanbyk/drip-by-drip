import type { Meta, StoryObj } from "@storybook/react-vite";
import type { EsvPassage } from "../lib/esvApi";
import { ESV_COPYRIGHT } from "../domain/esv";
import { esvReaderSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";
import { EsvReader } from "./today/EsvReader";

const samplePassage: EsvPassage = {
  query: "Mark 4:1-20",
  canonical: "Mark 4:1–20",
  copyright: ESV_COPYRIGHT,
  blocks: [
    { kind: "heading", text: "The Parable of the Sower" },
    {
      kind: "paragraph",
      runs: [
        { kind: "verse", chapter: 4, verse: 1, text: "A crowd gathers, and the teaching begins beside the water." },
        { kind: "verse", chapter: 4, verse: 2, text: "Stories follow, one after another, while the people listen." },
        { kind: "verse", chapter: 4, verse: 3, text: "A sower goes out, and the seed falls in different places." },
        { kind: "verse", chapter: 4, verse: 4, text: "Some of it never takes root." },
      ],
    },
    {
      kind: "paragraph",
      runs: [
        { kind: "verse", chapter: 4, verse: 5, text: "Other seed springs up quickly, then fades in the heat." },
        { kind: "verse", chapter: 4, verse: 8, text: "Other seed lands where it can grow and bear fruit." },
      ],
    },
    {
      kind: "paragraph",
      runs: [{ kind: "verse", chapter: 4, verse: 9, text: "A tagged verse sits on the warm background." }],
    },
  ],
};

function EsvScreen() {
  const snapshot = useFixture(esvReaderSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="today">
        <section className="screen screen-reader">
          <EsvReader
            reference="Mark 4:1–20"
            passage={samplePassage}
            continues="…continues through verse 20"
            onBack={() => undefined}
            onReflect={() => undefined}
            onRead={() => undefined}
          />
        </section>
      </Phone>
    </StoryApp>
  );
}

const meta = {
  title: "Screens/Today",
  parameters: { appFrame: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadInApp: Story = {
  name: "W · Passage — Read in app (ESV)",
  render: () => <EsvScreen />,
};

export const ReadInAppDark: Story = {
  name: "Dark · W · Passage — Read in app (ESV)",
  globals: { theme: "dark" },
  render: () => <EsvScreen />,
};
