import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { APPEARANCES, appearanceLabel, type Appearance } from "../domain/appearance";
import { BOOKS } from "../domain/books";
import { formatAskTime } from "../domain/dates";
import type { DripSize } from "../domain/types";
import { CalendarDays, Check, ChevronRight, Droplet, Settings2, SunMoon } from "./Icons";

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

/** Newest sheet is last, so Escape closes the one on top. */
const sheetClosers: Array<() => void> = [];

/**
 * How many sheets are open. The page scroller is locked with overflow, not a
 * document touchmove listener: preventDefault on touchmove also eats scrolling
 * inside the sheet on iOS.
 */
let openSheetCount = 0;

function retainBackgroundScrollLock(): () => void {
  openSheetCount += 1;
  document.documentElement.classList.add("sheet-open");
  return () => {
    openSheetCount -= 1;
    if (openSheetCount <= 0) {
      openSheetCount = 0;
      document.documentElement.classList.remove("sheet-open");
    }
  };
}

function isFooterChild(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  const className = (child.props as { className?: unknown }).className;
  return typeof className === "string" && className.split(/\s+/).includes("footer");
}

export function Sheet({
  title,
  onClose,
  children,
  hideTitle = false,
  description,
  titleAside,
  className,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  hideTitle?: boolean;
  description?: string;
  titleAside?: ReactNode;
  className?: string;
  /** Id of a heading rendered in `children`. Skips the sheet’s own title. */
  labelledBy?: string;
}) {
  const generatedId = useId();
  const titleId = labelledBy ?? generatedId;
  const sheetRef = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const footer = items.filter(isFooterChild);
  const body = items.filter((child) => !isFooterChild(child));
  const hasFooter = footer.length > 0;

  useLayoutEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    const footerEl = root.querySelector<HTMLElement>(":scope > .footer");
    if (!footerEl) {
      root.style.removeProperty("--sheet-footer");
      return;
    }
    const sync = () => {
      root.style.setProperty("--sheet-footer", `${footerEl.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [hasFooter]);

  useEffect(() => {
    sheetClosers.push(onClose);
    const releaseScrollLock = retainBackgroundScrollLock();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || sheetClosers.at(-1) !== onClose) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
      const index = sheetClosers.lastIndexOf(onClose);
      if (index >= 0) sheetClosers.splice(index, 1);
    };
  }, [onClose]);

  const titled = Boolean(!hideTitle && (description || titleAside));

  const dialog = (
    <div className="scrim" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className={className ? `sheet ${className}` : "sheet"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="handle" aria-hidden="true" />
        {labelledBy ? null : titled ? (
          <div className={titleAside ? "sheet-title-row" : "sheet-title-stack"}>
            <div className="sheet-title-copy">
              <h2 id={titleId}>{title}</h2>
              {description ? <p className="start-sub">{description}</p> : null}
            </div>
            {titleAside}
          </div>
        ) : (
          <h2 id={titleId} className={hideTitle ? "sr-only" : undefined}>
            {title}
          </h2>
        )}
        {body.length > 0 ? <div className="sheet-body">{body}</div> : null}
        {footer}
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
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

export function AppearanceField({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="settings-row" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <SunMoon className="row-icon" size={18} aria-hidden="true" />
        <span className="row-label">Appearance</span>
        <strong className="row-value">{appearanceLabel(value)}</strong>
        <ChevronRight className="chev" size={16} aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <Sheet title="Appearance" onClose={() => setOpen(false)}>
              <div className="settings-card" role="group" aria-label="Appearance">
                {APPEARANCES.map((option) => {
                  const selected = value === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className="settings-row"
                      aria-pressed={selected}
                      onClick={() => onChange(option)}
                    >
                      <span className="row-label">{appearanceLabel(option)}</span>
                      {selected ? <Check className="row-icon" size={18} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </Sheet>,
            document.body,
          )
        : null}
    </>
  );
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
