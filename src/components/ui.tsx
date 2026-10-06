import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { BOOKS } from "../domain/books";
import { formatAskTime } from "../domain/dates";
import type { DripSize } from "../domain/types";
import { CalendarDays, Droplet, Settings2 } from "./Icons";

export function Button({
  variant = "primary",
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "text" }) {
  return (
    <button className={`btn btn-${variant}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </button>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="handle" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function TabBar({
  tab,
  onTab,
}: {
  tab: "today" | "history" | "settings";
  onTab: (tab: "today" | "history" | "settings") => void;
}) {
  const items = [
    { id: "today", label: "Today" },
    { id: "history", label: "History" },
    { id: "settings", label: "Settings" },
  ] as const;

  return (
    <div className="tabbar-wrap">
      <nav className="tabbar" aria-label="Primary">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab is-active" : "tab"}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => onTab(item.id)}
          >
            <TabIcon id={item.id} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabIcon({ id }: { id: "today" | "history" | "settings" }) {
  if (id === "today") return <Droplet size={22} aria-hidden="true" />;
  if (id === "history") return <CalendarDays size={22} aria-hidden="true" />;
  if (id === "settings") return <Settings2 size={22} aria-hidden="true" />;
  const exhaustive: never = id;
  return exhaustive;
}

const PRESETS = [
  { label: "Morning", time: "06:30" },
  { label: "Midday", time: "12:30" },
  { label: "Evening", time: "20:30" },
] as const;

export function AskTimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const label = formatAskTime(value);
  const splitAt = label.lastIndexOf(" ");
  const clock = splitAt > 0 ? label.slice(0, splitAt) : label;
  const meridiem = splitAt > 0 ? label.slice(splitAt + 1) : "";
  return (
    <div className="time-card">
      <p className="time-row">
        <span className="time-display">{clock}</span>
        {meridiem ? <span className="meridiem">{meridiem}</span> : null}
      </p>
      <div className="chips" role="group" aria-label="Ask time presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={value === preset.time ? "chip is-active" : "chip"}
            aria-pressed={value === preset.time}
            onClick={() => onChange(preset.time)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Custom</span>
        <input className="time-input" type="time" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

const PACE: { id: DripSize; label: string }[] = [
  { id: "verses", label: "A few verses" },
  { id: "chapter", label: "1 chapter" },
  { id: "two", label: "2 chapters" },
];

export function PacePicker({ value, onChange }: { value: DripSize; onChange: (size: DripSize) => void }) {
  return (
    <div className="chips" role="group" aria-label="Daily drip size">
      {PACE.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "chip is-active" : "chip"}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BookPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (bookId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const books = BOOKS.filter((book) => !needle || book.name.toLowerCase().includes(needle) || book.aliases.some((alias) => alias.includes(needle)));
  const ot = books.filter((book) => book.testament === "ot");
  const nt = books.filter((book) => book.testament === "nt");

  return (
    <div className="book-picker">
      <label className="field">
        <span className="sr-only">Search all 66 books</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all 66 books"
          type="search"
        />
      </label>
      {!needle ? (
        <div className="book-group">
          <p className="kicker">Good places to start</p>
          {["mark", "john", "psalms", "proverbs", "james"].map((id) => {
            const book = BOOKS.find((item) => item.id === id);
            if (!book) return null;
            return (
              <button
                key={id}
                type="button"
                className={selectedId === id ? "book-row is-active" : "book-row"}
                onClick={() => onSelect(id)}
              >
                <strong>{book.name}</strong>
              </button>
            );
          })}
        </div>
      ) : null}
      <BookGroup title="Old Testament" books={ot} selectedId={selectedId} onSelect={onSelect} />
      <BookGroup title="New Testament" books={nt} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

function BookGroup({
  title,
  books,
  selectedId,
  onSelect,
}: {
  title: string;
  books: typeof BOOKS;
  selectedId: string;
  onSelect: (bookId: string) => void;
}) {
  if (books.length === 0) return null;
  return (
    <div className="book-group">
      <p className="kicker">{title}</p>
      {books.map((book) => (
        <button
          key={book.id}
          type="button"
          className={selectedId === book.id ? "book-row is-active" : "book-row"}
          onClick={() => onSelect(book.id)}
        >
          {book.name}
          <span>{book.verses.length === 1 ? "1 chapter" : `${book.verses.length} chapters`}</span>
        </button>
      ))}
    </div>
  );
}
