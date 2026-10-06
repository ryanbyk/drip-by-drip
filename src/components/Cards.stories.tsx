import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CHAPTER_HINTS } from "../data/chapterHints";
import { getBook } from "../domain/books";
import { formatAskTime } from "../domain/dates";
import { suggestedNext, weeksHint } from "../domain/suggestions";
import { QBE_QUESTION } from "../domain/types";
import {
  AlarmClock,
  AppIcon,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Droplet,
  ExternalLink,
  Layers,
  NotebookPen,
  Pencil,
  RotateCcw,
  Sun,
} from "./Icons";
import { Button } from "./ui";

const meta = {
  title: "UI/Cards",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotifyPreview: Story = {
  render: () => (
    <div className="notify-card">
      <AppIcon />
      <div>
        <p className="notify-app">Drip by drip · {formatAskTime("06:30")}</p>
        <p className="notify-q">{QBE_QUESTION}</p>
      </div>
    </div>
  ),
};

export const QuestionPreview: Story = {
  render: () => (
    <div className="preview-card">
      <p className="kicker">Preview</p>
      <p className="preview-title">Drip by drip · {formatAskTime("06:30")}</p>
      <p className="preview-body">{QBE_QUESTION}</p>
    </div>
  ),
};

export const Passage: Story = {
  render: () => (
    <article className="suggest-card passage-card">
      <p className="card-eyebrow">
        <Sun size={14} aria-hidden="true" />
        Today’s drip
      </p>
      <p className="detour-note">
        <CornerDownRight size={14} aria-hidden="true" />
        Yesterday you read Psalm 23 — your place was saved.
      </p>
      <h1 className="display-52">Mark 1:1–8</h1>
      <p className="hint">{CHAPTER_HINTS.mark?.[1]}</p>
      <div className="track" aria-hidden="true">
        <span style={{ width: "12%" }} />
      </div>
      <p className="meta">Mark · chapter 1 of 16</p>
      <div className="pill-actions">
        <button type="button">
          <Pencil size={14} aria-hidden="true" /> Adjust verses
        </button>
        <button type="button" className="is-muted">
          <BookOpen size={14} aria-hidden="true" /> Change book
        </button>
      </div>
    </article>
  ),
};

export const SuggestedBook: Story = {
  render: () => (
    <article className="suggest-card">
      <p className="kicker">Suggested</p>
      <h2 className="suggest-title">Mark</h2>
      <p className="meta-row">
        <Layers size={13} aria-hidden="true" /> {getBook("mark")?.verses.length ?? 16} chapters
        <Calendar size={13} aria-hidden="true" /> {weeksHint("mark", "chapter")}
        <Droplet size={13} aria-hidden="true" /> 1 chapter / day
      </p>
    </article>
  ),
};

export const NoteEmpty: Story = {
  render: () => (
    <button type="button" className="note-card">
      <span className="note-head">
        <span className="note-icon" aria-hidden="true">
          <NotebookPen size={14} />
        </span>
        <strong>Add a note</strong>
      </span>
      <p className="note-snippet">Huh? is welcome. A short note is optional.</p>
    </button>
  ),
};

export const NoteFilled: Story = {
  render: () => (
    <button type="button" className="note-card">
      <span className="note-head">
        <span className="note-icon" aria-hidden="true">
          <NotebookPen size={14} />
        </span>
        <strong>Your note</strong>
        <span className="huh">Huh?</span>
      </span>
      <p className="note-snippet">John came baptizing. I want to sit with verse 8 a little longer.</p>
    </button>
  ),
};

function SettingsCard({ notificationsOn }: { notificationsOn: boolean }) {
  const [on, setOn] = useState(notificationsOn);
  return (
    <section className="settings-group">
      <p className="eyebrow">Daily ask</p>
      <div className="settings-card">
        <button type="button" className="settings-row">
          <AlarmClock className="row-icon" size={18} aria-hidden="true" />
          <span className="row-label">Ask time</span>
          <strong className="row-value">{formatAskTime("06:30")}</strong>
          <ChevronRight className="chev" size={16} aria-hidden="true" />
        </button>
        <div className="settings-row">
          <Bell className="row-icon" size={18} aria-hidden="true" />
          <span className="row-label">Notifications</span>
          <button
            type="button"
            className={on ? "switch is-on" : "switch"}
            role="switch"
            aria-checked={on}
            aria-label="Notifications"
            onClick={() => setOn((current) => !current)}
          >
            <span />
          </button>
        </div>
      </div>
    </section>
  );
}

export const Settings: Story = {
  render: () => <SettingsCard notificationsOn={false} />,
};

export const SettingsOn: Story = {
  render: () => <SettingsCard notificationsOn />,
};

export const SettingsDanger: Story = {
  render: () => (
    <section className="settings-group">
      <p className="eyebrow">Progress</p>
      <div className="settings-card">
        <button type="button" className="settings-row is-danger">
          <RotateCcw className="row-icon" size={18} aria-hidden="true" />
          <span className="row-label">Reset progress…</span>
        </button>
      </div>
      <div className="settings-card">
        <a className="settings-row" href="https://www.crossway.org/" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="row-icon" size={18} aria-hidden="true" />
          <span className="row-label">Sermon notes — Drip by drip</span>
          <ArrowUpRight className="chev" size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  ),
};

export const Install: Story = {
  render: () => (
    <div className="install-card">
      <p>Add Drip by drip to your home screen. It still lives only on this device.</p>
      <div className="row-actions">
        <Button type="button">Add to Home Screen</Button>
        <Button type="button" variant="text">
          Not now
        </Button>
      </div>
    </div>
  ),
};

export const WhatsNext: Story = {
  render: () => (
    <div className="next-card">
      <p className="kicker">What’s next?</p>
      <p>Where would you like to go next?</p>
      {suggestedNext("mark").map((item, index) => {
        const book = getBook(item.id);
        if (!book) return null;
        return (
          <button key={item.id} type="button" className={index === 0 ? "choice is-active" : "choice"}>
            <strong>{book.name}</strong>
            <span>{item.blurb}</span>
          </button>
        );
      })}
    </div>
  ),
};

export const Editor: Story = {
  render: () => (
    <div className="editor-card">
      <p className="editor-prompt">What stood out?</p>
      <textarea rows={6} defaultValue="The voice in the wilderness." aria-label="Note" />
      <div className="verse-tags">
        <button type="button" className="verse-tag">
          <Bookmark size={11} aria-hidden="true" />
          1:3
        </button>
        <button type="button" className="verse-tag is-add">
          Add a verse
        </button>
      </div>
    </div>
  ),
};

export const Prayer: Story = {
  render: () => (
    <ul className="dog-list dog-card">
      <li>
        <span>D</span>
        <div>
          <strong>Discipline</strong>
          <p>Help me show up and stay with it.</p>
        </div>
      </li>
      <li>
        <span>O</span>
        <div>
          <strong>Open ears</strong>
          <p>Let me hear you, not just read words.</p>
        </div>
      </li>
      <li>
        <span>G</span>
        <div>
          <strong>Gladness</strong>
          <p>Give me joy in your Word today.</p>
        </div>
      </li>
    </ul>
  ),
};

const DAYS: { label: string; className: string; disabled?: boolean }[] = [
  { label: "1", className: "cal-day mark-read" },
  { label: "2", className: "cal-day mark-yes is-today" },
  { label: "3", className: "cal-day mark-not_today" },
  { label: "4", className: "cal-day mark-unanswered" },
  { label: "5", className: "cal-day", disabled: true },
  { label: "6", className: "cal-day", disabled: true },
  { label: "7", className: "cal-day", disabled: true },
];

export const DayMarks: Story = {
  render: () => (
    <div className="cal-card">
      <div className="cal-head">
        <button type="button" aria-label="Previous month">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p>October 2026</p>
        <button type="button" aria-label="Next month" disabled>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="cal">
        {DAYS.map((day) => (
          <button key={day.label} type="button" className={day.className} disabled={day.disabled}>
            {day.label}
          </button>
        ))}
      </div>
      <ul className="legend">
        <li>
          <i className="swatch mark-read" /> Read
        </li>
        <li>
          <i className="swatch mark-yes" /> Yes
        </li>
        <li>
          <i className="swatch mark-not_today" /> Not today
        </li>
        <li>
          <i className="swatch mark-unanswered" /> Unanswered
        </li>
      </ul>
    </div>
  ),
};
