import type { Meta, StoryObj } from "@storybook/react-vite";
import { ALargeSmall, BookmarkPlus, ChevronLeft, NotebookPen } from "../components/Icons";
import { settingsSnapshot } from "../storybook/fixtures";
import { Phone, StoryApp, useFixture } from "../storybook/harness";

function EsvReaderPlaceholder() {
  return (
    <section className="screen screen-reader">
      <header className="reader-nav">
        <button type="button" className="icon-btn" aria-label="Back">
          <ChevronLeft size={18} />
        </button>
        <div className="reader-title">
          <strong>Mark 4:1–20</strong>
          <span>ESV · in app</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Text size" disabled>
          <ALargeSmall size={18} />
        </button>
      </header>
      <div className="reader-body">
        <h2>The Parable of the Sower</h2>
        <p className="reader-empty">
          In-app ESV text isn’t available yet. Passages still open in the Bible source you chose in Settings.
        </p>
        <p className="reader-hint">
          <BookmarkPlus size={14} aria-hidden="true" />
          Verse tags will land in your note once a licensed text source is connected.
        </p>
        <p className="reader-continues">The reading would continue through the passage you asked for.</p>
        <p className="reader-copy">
          Scripture quotations would appear here under license, stored only on this device.
        </p>
      </div>
      <div className="reader-actions">
        <button type="button" className="reader-reflect">
          <NotebookPen size={18} aria-hidden="true" />
          Reflect
        </button>
        <button type="button" className="btn btn-primary" disabled>
          I read it
        </button>
      </div>
    </section>
  );
}

function EsvScreen() {
  const snapshot = useFixture(settingsSnapshot);
  return (
    <StoryApp snapshot={snapshot}>
      <Phone tab="today">
        <EsvReaderPlaceholder />
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
