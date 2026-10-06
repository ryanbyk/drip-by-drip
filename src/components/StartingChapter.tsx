import { useId, useState } from "react";
import {
  chapterSections,
  countEarlierCopy,
  defaultCountEarlier,
  pickerMode,
  startAtLabel,
  startingSubtitle,
  type PickerMode,
} from "../domain/chapters";
import { chapterCount, getBook, verseCount } from "../domain/books";
import { Hash, ListOrdered, Minus, Plus } from "./Icons";
import { Button, Sheet } from "./ui";

export type StartSelection = {
  chapter: number;
  verse: number;
  countEarlier: boolean;
};

const GRID_COLUMNS = 6;
const RANGE_COLUMNS = 7;

function columnsFor(mode: PickerMode): number {
  switch (mode) {
    case "grid":
      return GRID_COLUMNS;
    case "psalms":
    case "ranges":
      return RANGE_COLUMNS;
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

function chunk(chapters: number[], size: number): number[][] {
  const rows: number[][] = [];
  for (let index = 0; index < chapters.length; index += size) rows.push(chapters.slice(index, index + size));
  return rows;
}

export function StartingChapterSheet({
  bookId,
  initialChapter = 1,
  initialVerse = 1,
  initialCountEarlier,
  onClose,
  onConfirm,
}: {
  bookId: string;
  initialChapter?: number;
  initialVerse?: number;
  initialCountEarlier?: boolean;
  onClose: () => void;
  onConfirm: (selection: StartSelection) => void;
}) {
  const book = getBook(bookId);
  const mode = pickerMode(bookId);
  const sections = chapterSections(bookId);
  const total = chapterCount(bookId);
  const [chapter, setChapter] = useState(() => Math.min(Math.max(1, initialChapter), Math.max(1, total)));
  const [verse, setVerse] = useState(() => Math.max(1, initialVerse));
  const [countEarlier, setCountEarlier] = useState(() => initialCountEarlier ?? defaultCountEarlier(bookId));
  const [tab, setTab] = useState(() => {
    const index = sections.findIndex((section) => initialChapter >= section.start && initialChapter <= section.end);
    return index >= 0 ? index : 0;
  });
  const [jump, setJump] = useState("");
  const [pickingVerse, setPickingVerse] = useState(false);
  const countLabelId = useId();

  if (!book || sections.length === 0) return null;

  const active = sections[tab] ?? sections[0];
  const shown =
    mode === "grid"
      ? Array.from({ length: total }, (_, index) => index + 1)
      : Array.from({ length: active.end - active.start + 1 }, (_, index) => active.start + index);
  const columns = columnsFor(mode);
  const compact = mode !== "grid";
  const earlier = countEarlierCopy(bookId, chapter);
  const maxVerse = verseCount(bookId, chapter);
  const title = `Where in ${book.name}?`;

  function selectChapter(next: number) {
    const clamped = Math.min(Math.max(1, next), total);
    setChapter(clamped);
    setVerse((current) => Math.min(Math.max(1, current), verseCount(bookId, clamped) || 1));
    const index = sections.findIndex((section) => clamped >= section.start && clamped <= section.end);
    if (index >= 0) setTab(index);
  }

  function commitJump(raw: string) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > total) return;
    selectChapter(value);
    setJump("");
  }

  function onJumpChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, String(total).length);
    setJump(digits);
    if (!digits) return;
    const value = Number(digits);
    const complete = digits.length >= String(total).length || value * 10 > total;
    if (complete && value >= 1 && value <= total) {
      selectChapter(value);
      setJump("");
    }
  }

  return (
    <Sheet
      title={title}
      description={startingSubtitle(bookId)}
      titleAside={
        compact ? (
          <label className="goto">
            <Hash size={15} aria-hidden="true" />
            <input
              inputMode="numeric"
              aria-label="Go to chapter"
              placeholder="Go to"
              value={jump}
              onChange={(event) => onJumpChange(event.target.value)}
              onBlur={() => commitJump(jump)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitJump(jump);
                }
              }}
            />
          </label>
        ) : null
      }
      onClose={onClose}
    >
      {compact ? (
        <div className="range-tabs" role="tablist" aria-label="Chapter ranges">
          {sections.map((section, index) => {
            const selected = index === tab;
            return (
              <button
                key={section.label}
                type="button"
                role="tab"
                aria-selected={selected}
                className={selected ? "range-tab is-active" : "range-tab"}
                onClick={() => setTab(index)}
              >
                <strong>{section.label}</strong>
                <span>{section.sublabel}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={compact ? "ch-grid is-compact" : "ch-grid"} role="group" aria-label="Chapters">
        {chunk(shown, columns).map((row) => (
          <div key={row[0]} className="ch-row">
            {row.map((number) => {
              const selected = number === chapter;
              const counted = mode === "grid" && countEarlier && number < chapter;
              const className = selected ? "ch-cell is-selected" : counted ? "ch-cell is-counted" : "ch-cell";
              return (
                <button
                  key={number}
                  type="button"
                  className={className}
                  aria-pressed={selected}
                  onClick={() => selectChapter(number)}
                >
                  {number}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {earlier ? (
        <div className={compact ? "count-earlier is-compact" : "count-earlier"}>
          <p className="count-copy" id={countLabelId}>
            <strong>{earlier.label}</strong>
            <span>{earlier.detail}</span>
          </p>
          <button
            type="button"
            className={countEarlier ? "switch is-on" : "switch"}
            role="switch"
            aria-checked={countEarlier}
            aria-labelledby={countLabelId}
            onClick={() => setCountEarlier((on) => !on)}
          >
            <span />
          </button>
        </div>
      ) : null}
      {mode === "grid" ? (
        <div className="link-row">
          <button type="button" aria-expanded={pickingVerse} onClick={() => setPickingVerse((open) => !open)}>
            <ListOrdered size={14} aria-hidden="true" />
            Start mid-chapter? Pick a verse
          </button>
        </div>
      ) : null}
      {mode === "grid" && pickingVerse ? (
        <div className="stepper is-inline">
          <span>Verse</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous verse"
            onClick={() => setVerse((current) => Math.max(1, current - 1))}
          >
            <Minus size={14} />
          </button>
          <strong>{Math.min(verse, maxVerse || 1)}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next verse"
            onClick={() => setVerse((current) => Math.min(maxVerse || 1, current + 1))}
          >
            <Plus size={14} />
          </button>
        </div>
      ) : null}
      <Button
        onClick={() =>
          onConfirm({
            chapter,
            verse: mode === "grid" ? Math.min(Math.max(1, verse), maxVerse || 1) : 1,
            countEarlier: chapter > 1 ? countEarlier : false,
          })
        }
      >
        {startAtLabel(bookId, chapter, mode === "grid" ? Math.min(Math.max(1, verse), maxVerse || 1) : 1)}
      </Button>
    </Sheet>
  );
}
