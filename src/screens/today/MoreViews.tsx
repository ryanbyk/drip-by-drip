import { useState } from "react";
import { chapterCount, getBook, verseCount } from "../../domain/books";
import { startAtLabel } from "../../domain/chapters";
import { addDays } from "../../domain/dates";
import { dripFromPlace, isPlaceFinished, makeRange, placeAfter, verseInRange } from "../../domain/drip";
import {
  defaultSwitchStart,
  pickUpLabel,
  resolveSwitchPlace,
  savedSwitchPlace,
  startOverConfirmCopy,
  startOverNote,
  switchConfirmCopy,
  switchTargetLabel,
  switchTiming,
  switchTimingNote,
  type SwitchTiming,
} from "../../domain/switchBook";
import { bibleSourceLabel, normalizeBiblePrefs } from "../../domain/bibleSource";
import { formatRef, parsePassage } from "../../domain/refs";
import type { Range } from "../../domain/types";
import { suggestedNext } from "../../domain/suggestions";
import { useApp } from "../../state/AppState";
import {
  ArrowUpRight,
  BookCheck,
  Bookmark,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  CircleQuestionMark,
  CloudOff,
  Keyboard,
  MapPin,
  Minus,
  Plus,
  Share,
} from "../../components/Icons";
import { OpenPassageLink } from "../../components/OpenPassageLink";
import { StartingChapterSheet } from "../../components/StartingChapter";
import { BookPicker, Button, PacePicker, Sheet } from "../../components/ui";
import { SomethingElse } from "./SomethingElse";

const PROMPTS = ["What stood out?", "About God?", "Carry today?"];

export function ReflectView({ onKeep, onRead }: { onKeep: () => void; onRead: () => void }) {
  const { snapshot, today, dispatch, online } = useApp();
  const day = snapshot.days[today];
  const [text, setText] = useState(day?.reflection ?? "");
  const [huh, setHuh] = useState(Boolean(day?.huh));
  const [prompt, setPrompt] = useState<(typeof PROMPTS)[number]>(PROMPTS[0]);
  const [tags, setTags] = useState<string[]>(day?.verseTags ?? []);
  const [adding, setAdding] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const ref = day?.passageRef ?? "Today’s drip";
  const sourceLabel = bibleSourceLabel(normalizeBiblePrefs(snapshot.prefs).bibleSource);

  function save() {
    dispatch({ type: "reflection", today, reflection: text, huh, verseTags: tags });
  }

  function addTag() {
    const next = tagDraft.trim();
    if (next && !tags.includes(next)) setTags((current) => [...current, next]);
    setTagDraft("");
    setAdding(false);
  }

  return (
    <div className="reflect">
      <div className="nav-row">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onKeep}>
          <ChevronLeft size={18} />
        </button>
        <p className="saved-flag">
          <CloudOff size={13} aria-hidden="true" />
          Saved on this device
        </p>
      </div>
      <header className="reflect-head">
        <p className="reflect-kicker">Reflect</p>
        <div className="reflect-title">
          <h1>{ref}</h1>
          {day?.passageRef ? (
            <OpenPassageLink reference={day.passageRef} className="open-chip" online={online}>
              Open in {sourceLabel} <ArrowUpRight size={13} aria-hidden="true" />
            </OpenPassageLink>
          ) : null}
        </div>
      </header>
      <div className="chip-block">
        <p>Need a nudge?</p>
        <div className="chips" role="group" aria-label="Prompts">
          {PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              className={prompt === item ? "chip is-active" : "chip"}
              aria-pressed={prompt === item}
              onClick={() => setPrompt(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="editor-card">
        <p className="editor-prompt">{prompt}</p>
        <textarea
          value={text}
          rows={6}
          maxLength={500}
          aria-label="Note"
          onChange={(event) => setText(event.target.value)}
          placeholder="Confusion is welcome. Keep going."
        />
        <div className="verse-tags">
          {tags.map((tag) => (
            <button key={tag} type="button" className="verse-tag" onClick={() => setTags((current) => current.filter((item) => item !== tag))}>
              <Bookmark size={11} aria-hidden="true" />
              {tag}
              <span className="sr-only">Remove</span>
            </button>
          ))}
          {adding ? (
            <input
              className="tag-input"
              value={tagDraft}
              aria-label="Verse"
              placeholder="4:9"
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={addTag}
              onKeyDown={(event) => {
                if (event.key === "Enter") addTag();
              }}
            />
          ) : (
            <button type="button" className="verse-tag is-add" onClick={() => setAdding(true)}>
              <Plus size={11} aria-hidden="true" /> Verse
            </button>
          )}
        </div>
      </div>
      <div className="huh-row">
        <span className="note-icon" aria-hidden="true">
          <CircleQuestionMark size={16} />
        </span>
        <span>
          <strong>Mark it “Huh?”</strong>
          <span>Something confusing? Easy to revisit later</span>
        </span>
        <button
          type="button"
          className={huh ? "switch is-on" : "switch"}
          role="switch"
          aria-checked={huh}
          aria-label="Mark it Huh?"
          onClick={() => setHuh((current) => !current)}
        >
          <span />
        </button>
      </div>
      <div className="footer">
        <Button
          className="btn-yes"
          onClick={() => {
            save();
            onRead();
          }}
        >
          I read it
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            save();
            onKeep();
          }}
        >
          Save & keep reading
        </Button>
      </div>
    </div>
  );
}

export function DetourView({
  onUse,
  onBack,
  onReflect,
  onRead,
  backup,
}: {
  onUse: (ref: string) => void;
  onBack: () => void;
  onReflect: () => void;
  onRead: () => void;
  backup: string;
}) {
  const { snapshot, today } = useApp();
  const day = snapshot.days[today];
  return (
    <SomethingElse
      bookName={getBook(snapshot.prefs.bookId)?.name ?? "Mark"}
      backupLabel={backup}
      initialRef={day?.detour ? day.passageRef ?? "" : ""}
      onUse={onUse}
      onBackToBook={onBack}
      onReflect={onReflect}
      onRead={onRead}
    />
  );
}

export function FinishedView({
  onDetour,
  onChoose,
  onRecap,
}: {
  onDetour: () => void;
  onChoose: () => void;
  onRecap: () => void;
}) {
  const { snapshot, today, dispatch } = useApp();
  const passageBook = snapshot.prefs.bookId;
  const book = getBook(passageBook);
  const nextDate = addDays(today, 1);
  const ideas = suggestedNext(passageBook);
  const [selected, setSelected] = useState(ideas[0]?.id ?? "");
  const selectedBook = getBook(selected);

  if (snapshot.prefs.readingMode === "plan") {
    return (
      <div className="finished">
        <div className="hero">
          <h1>This placeholder list is finished.</h1>
          <p>You can type each day’s reading in Settings, or continue in {book?.name ?? "Mark"}.</p>
        </div>
        <div className="footer">
          <Button
            onClick={() =>
              dispatch({
                type: "reading",
                today,
                mode: "book",
                bookId: snapshot.prefs.bookId,
              })
            }
          >
            Continue in {book?.name ?? "Mark"}
          </Button>
          <Button variant="text" onClick={onDetour}>
            Read something else today
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="finished">
      <div className="hero">
        <div className="finish-badge" aria-hidden="true">
          <BookCheck size={26} />
        </div>
        <h1 className="display-40">You finished {book?.name ?? "this book"}.</h1>
        <p>
          {book ? `${book.verses.length} chapters` : "Every chapter"}, one drip at a time. Where would you like to go next?
        </p>
      </div>
      <div className="chip-block">
        <p className="eyebrow">What’s next?</p>
        <div className="next-list">
          {ideas.map((item) => {
            const next = getBook(item.id);
            if (!next) return null;
            return (
              <button
                key={item.id}
                type="button"
                className={selected === item.id ? "next-choice is-selected" : "next-choice"}
                onClick={() => setSelected(item.id)}
              >
                <strong>{next.name}</strong>
                <span>{item.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="footer">
        <Button
          disabled={!selectedBook}
          onClick={() => {
            if (!selectedBook) return;
            dispatch({ type: "queueBook", bookId: selectedBook.id, when: "tomorrow", today, tomorrow: nextDate });
          }}
        >
          Start {selectedBook?.name ?? "next"} 1 tomorrow
        </Button>
        <Button variant="text" onClick={onChoose}>
          Choose another book
        </Button>
        <Button variant="text" onClick={onRecap}>
          Look back at the drips
        </Button>
        <Button variant="text" onClick={onDetour}>
          Read something else today
        </Button>
      </div>
    </div>
  );
}

export function CommitSheet({ onContinue }: { onContinue: () => void }) {
  const { snapshot, today, dispatch, share } = useApp();
  const day = snapshot.days[today];
  const chips = ["With coffee", "Lunch break", "Before bed"];
  const saved = day?.answeredAt
    ? new Date(day.answeredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "just now";
  return (
    <Sheet title="Yes — I’ll read today" hideTitle onClose={onContinue}>
      <div className="commit-row">
        <span className="commit-check" aria-hidden="true">
          <Check size={16} />
        </span>
        <span className="commit-copy">
          <strong>Yes — I’ll read today</strong>
          <span>Saved {saved}</span>
        </span>
      </div>
      <div className="when-where">
        <div className="label-row commit-label">
          <span>When / where will you read?</span>
          <span className="optional">Optional</span>
        </div>
        <label className="commit-field">
          <MapPin size={18} aria-hidden="true" />
          <span className="sr-only">When / where will you read?</span>
          <input
            value={day?.note ?? ""}
            maxLength={140}
            placeholder="e.g. 6:45 at the kitchen table"
            onChange={(event) => dispatch({ type: "note", today, note: event.target.value })}
          />
        </label>
        <div className="chips">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={day?.note === chip ? "chip is-active" : "chip"}
              onClick={() => dispatch({ type: "note", today, note: chip })}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <div className="footer">
        <Button onClick={onContinue}>Continue</Button>
        <Button variant="text" className="share-link" onClick={() => void share(day?.passageRef)}>
          <Share size={16} aria-hidden="true" /> Share my commitment
        </Button>
      </div>
    </Sheet>
  );
}

export function AdjustSheet({ onClose, onDetour }: { onClose: () => void; onDetour: (ref: string) => void }) {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const initial = day?.range;
  const [draft, setDraft] = useState<Range | null>(initial ?? null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  if (!initial || !draft) return null;
  const book = getBook(draft.bookId);
  const presets = buildPresets(initial);

  function useDraft(range: Range) {
    dispatch({ type: "range", today, range });
    onClose();
  }

  function applyTyped() {
    const parsed = parsePassage(typed);
    if (!parsed) {
      if (typed.trim()) {
        onDetour(typed.trim());
        return;
      }
      setError("Try a reference like Mark 4:1–20.");
      return;
    }
    if (parsed.bookId !== snapshot.prefs.bookId) {
      onDetour(formatRef(parsed));
      return;
    }
    setDraft(parsed);
    setError("");
  }

  const activeLabel = presets.find((preset) => sameRange(preset.range, draft))?.label;

  return (
    <Sheet title="Today’s passage" onClose={onClose}>
      <label className="field">
        <span>Book</span>
        <span className="range-box">
          <span>{book?.name}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </label>
      <div className="range-grid">
        <label className="field">
          <span>From</span>
          <input
            className="range-box"
            aria-label="From"
            value={`${draft.startChapter}:${draft.startVerse}`}
            onChange={(event) => {
              const point = parsePoint(draft.bookId, event.target.value);
              if (point) setDraft({ ...draft, startChapter: point.chapter, startVerse: point.verse });
            }}
          />
        </label>
        <label className="field">
          <span>To</span>
          <input
            className="range-box is-focus"
            aria-label="To"
            value={`${draft.endChapter}:${draft.endVerse}`}
            onChange={(event) => {
              const point = parsePoint(draft.bookId, event.target.value);
              if (point) setDraft({ ...draft, endChapter: point.chapter, endVerse: point.verse });
            }}
          />
        </label>
      </div>
      <div className="chips">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={activeLabel === preset.label ? "chip is-active" : "chip"}
            onClick={() => setDraft(preset.range)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Or type it</span>
        <span className="ref-input">
          <input value={typed} placeholder="e.g. Mark 4:1–20, Psalm 1" onChange={(event) => setTyped(event.target.value)} />
          <Keyboard size={16} aria-hidden="true" />
        </span>
      </label>
      {error ? <p className="soft">{error}</p> : null}
      <div className="footer">
        {typed.trim() ? (
          <Button variant="quiet" onClick={applyTyped}>
            Use typed reference
          </Button>
        ) : null}
        <Button
          onClick={() => {
            const next = makeRange(draft.bookId, draft.startChapter, draft.startVerse, draft.endChapter, draft.endVerse);
            if (!next) {
              setError("That range doesn’t fit this book.");
              return;
            }
            useDraft(next);
          }}
        >
          Use passage
        </Button>
      </div>
    </Sheet>
  );
}

function sameRange(left: Range, right: Range): boolean {
  return (
    left.bookId === right.bookId &&
    left.startChapter === right.startChapter &&
    left.startVerse === right.startVerse &&
    left.endChapter === right.endChapter &&
    left.endVerse === right.endVerse
  );
}

function parsePoint(bookId: string, value: string): { chapter: number; verse: number } | null {
  const match = value.trim().match(/^(\d+)(?::(\d+))?$/);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = match[2] ? Number(match[2]) : 1;
  if (chapter < 1 || chapter > chapterCount(bookId)) return null;
  if (verse < 1 || verse > verseCount(bookId, chapter)) return null;
  return { chapter, verse };
}

function buildPresets(range: Range): { label: string; range: Range }[] {
  const presets: { label: string; range: Range }[] = [];
  const whole = makeRange(range.bookId, range.startChapter, 1, range.startChapter, verseCount(range.bookId, range.startChapter));
  if (whole) presets.push({ label: `Whole ch. ${range.startChapter}`, range: whole });
  const partialEnd = Math.min(verseCount(range.bookId, range.startChapter), 20);
  if (partialEnd > 1 && partialEnd < verseCount(range.bookId, range.startChapter)) {
    const partial = makeRange(range.bookId, range.startChapter, 1, range.startChapter, partialEnd);
    if (partial) presets.push({ label: `${range.startChapter}:1–${partialEnd}`, range: partial });
  }
  if (range.startChapter < chapterCount(range.bookId)) {
    const through = makeRange(
      range.bookId,
      range.startChapter,
      1,
      range.startChapter + 1,
      verseCount(range.bookId, range.startChapter + 1),
    );
    if (through) presets.push({ label: `Through ch. ${range.startChapter + 1}`, range: through });
  }
  return presets;
}

export function StopSheet({
  onClose,
  range: rangeProp,
  onFinish,
  lead,
  nextLabel = "Tomorrow’s drip",
}: {
  onClose: () => void;
  /** Passage to finish. Defaults to today’s locked book drip. */
  range?: Range;
  /** When set, save this stop instead of finishing today. */
  onFinish?: (stop: { chapter: number; verse: number }) => void;
  lead?: string;
  nextLabel?: string;
}) {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const range = rangeProp ?? day?.range;
  const [mode, setMode] = useState<"all" | "part">("all");
  const [chapter, setChapter] = useState(range?.endChapter ?? 1);
  const [verse, setVerse] = useState(range?.endVerse ?? 1);
  if (!range) return null;
  const passageRange = range;
  const stop = mode === "all" ? { chapter: passageRange.endChapter, verse: passageRange.endVerse } : { chapter, verse };
  const valid = verseInRange(passageRange, stop.chapter, stop.verse);
  const next = placeAfter(passageRange.bookId, stop.chapter, stop.verse);
  const finished = isPlaceFinished(next);
  const upcoming = finished ? null : dripFromPlace(next, snapshot.prefs.dripSize);
  const book = getBook(passageRange.bookId);

  function step(delta: number) {
    let nextChapter = chapter;
    let nextVerse = verse + delta;
    if (nextVerse > verseCount(passageRange.bookId, nextChapter)) {
      if (nextChapter < passageRange.endChapter) {
        nextChapter += 1;
        nextVerse = 1;
      } else {
        nextVerse = verseCount(passageRange.bookId, nextChapter);
      }
    }
    if (nextVerse < 1) {
      if (nextChapter > passageRange.startChapter) {
        nextChapter -= 1;
        nextVerse = verseCount(passageRange.bookId, nextChapter);
      } else {
        nextVerse = 1;
      }
    }
    if (nextChapter === passageRange.startChapter && nextVerse < passageRange.startVerse) nextVerse = passageRange.startVerse;
    if (nextChapter === passageRange.endChapter && nextVerse > passageRange.endVerse) nextVerse = passageRange.endVerse;
    setChapter(nextChapter);
    setVerse(nextVerse);
  }

  return (
    <Sheet title="Where did you stop?" onClose={onClose}>
      <p className="soft">{lead ?? "So tomorrow picks up in the right place."}</p>
      <div className="choice-list">
        <button type="button" className={mode === "all" ? "choice is-active" : "choice"} onClick={() => setMode("all")}>
          <strong>Read all of it</strong>
          <span>
            Through {book?.name ?? "the passage"} {passageRange.endChapter}:{passageRange.endVerse}
          </span>
        </button>
        <div
          className={mode === "part" ? "choice is-active" : "choice"}
          role="button"
          tabIndex={0}
          onClick={() => setMode("part")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setMode("part");
          }}
        >
          <strong>Stopped partway</strong>
          <span>Pick the last verse you read</span>
          {mode === "part" ? (
            <span className="stepper">
              <span>
                {book?.name ?? "Passage"} {chapter}:
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Previous verse"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
              >
                <Minus size={14} />
              </button>
              <strong>{verse}</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Next verse"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
              >
                <Plus size={14} />
              </button>
            </span>
          ) : null}
        </div>
      </div>
      <p className="tomorrow-line">
        <Bookmark size={16} aria-hidden="true" />
        {finished
          ? `That finishes ${book?.name ?? "the book"}.`
          : upcoming
            ? `${nextLabel}: ${formatRef(upcoming)}`
            : "Your place is saved."}
      </p>
      <div className="footer">
        <Button
          disabled={!valid}
          onClick={() => {
            if (onFinish) onFinish(stop);
            else dispatch({ type: "finish", today, at: new Date().toISOString(), stop });
            onClose();
          }}
        >
          Save & finish
        </Button>
      </div>
    </Sheet>
  );
}

type StartChoice = "resume" | "restart" | "custom";

export function SwitchStartChoices({
  pickUp,
  mode,
  onResume,
  onRestart,
}: {
  pickUp: string;
  mode: StartChoice;
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="choice-list" role="group" aria-label="Where to start">
      <button
        type="button"
        className={mode === "resume" ? "choice choice-row is-active" : "choice choice-row"}
        aria-pressed={mode === "resume"}
        onClick={onResume}
      >
        <Bookmark size={18} aria-hidden="true" />
        <span>
          <strong>{pickUp}</strong>
          <span>Where you left off</span>
        </span>
      </button>
      <button
        type="button"
        className={mode === "restart" ? "choice choice-row is-active" : "choice choice-row"}
        aria-pressed={mode === "restart"}
        onClick={onRestart}
      >
        <RotateCcw size={18} aria-hidden="true" />
        <span>
          <strong>Start over from chapter 1</strong>
          <span>This book’s place goes back to the beginning</span>
        </span>
      </button>
    </div>
  );
}

export function ChangeBookSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, today, dispatch } = useApp();
  const [bookId, setBookId] = useState(snapshot.prefs.bookId);
  const [dripSize, setDripSize] = useState(snapshot.prefs.dripSize);
  const [choice, setChoice] = useState<StartChoice>("resume");
  const [custom, setCustom] = useState<{ chapter: number; verse: number } | null>(null);
  const [countEarlier, setCountEarlier] = useState<boolean | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const book = getBook(bookId);
  const fromName = getBook(snapshot.prefs.bookId)?.name ?? "this book";
  const toName = book?.name ?? "this book";
  const sameBook = bookId === snapshot.prefs.bookId;
  const saved = savedSwitchPlace(snapshot.places, bookId);
  const resumed = saved
    ? { chapter: saved.chapter, verse: saved.verse }
    : defaultSwitchStart(snapshot.places, bookId);
  const restarting = Boolean(saved) && choice === "restart";
  const start = restarting ? { chapter: 1, verse: 1 } : choice === "custom" && custom ? custom : resumed;
  const earlier = restarting ? false : countEarlier;
  const startLabel = startAtLabel(bookId, start.chapter, start.verse);
  const atBeginning = start.chapter === 1 && start.verse === 1;
  const description = restarting
    ? "Start over from chapter 1"
    : saved && choice === "resume"
      ? pickUpLabel(toName, saved.chapter, saved.verse)
      : startLabel;

  function selectBook(id: string) {
    setBookId(id);
    setChoice("resume");
    setCustom(null);
    setCountEarlier(undefined);
  }

  function proceed() {
    const next = resolveSwitchPlace(snapshot.places, bookId, start.chapter, start.verse, earlier);
    const current = snapshot.places[bookId];
    const placeChanged =
      !current ||
      current.chapter !== next.chapter ||
      current.verse !== next.verse ||
      current.countedThrough !== next.countedThrough;
    if (sameBook && !placeChanged) {
      if (dripSize !== snapshot.prefs.dripSize) dispatch({ type: "reading", today, dripSize });
      onClose();
      return;
    }
    setConfirming(true);
  }

  function commit() {
    dispatch({
      type: "switchBook",
      bookId,
      today,
      tomorrow: addDays(today, 1),
      startChapter: start.chapter,
      startVerse: start.verse,
      ...(earlier !== undefined ? { countEarlier: earlier } : {}),
      dripSize,
    });
    onClose();
  }

  return (
    <Sheet title="What you’re reading" description={description} onClose={onClose}>
      {saved ? (
        <>
          <SwitchStartChoices
            pickUp={pickUpLabel(toName, saved.chapter, saved.verse)}
            mode={choice}
            onResume={() => {
              setChoice("resume");
              setCustom(null);
              setCountEarlier(undefined);
            }}
            onRestart={() => {
              setChoice("restart");
              setCustom(null);
              setCountEarlier(false);
            }}
          />
          <button type="button" className="partway-link" onClick={() => setPicking(true)}>
            {choice === "custom" ? startLabel : "Pick another chapter"}
          </button>
        </>
      ) : null}
      <BookPicker selectedId={bookId} onSelect={selectBook} />
      <p className="kicker">Daily drip size</p>
      <PacePicker value={dripSize} onChange={setDripSize} />
      {saved ? null : (
        <button type="button" className="partway-link" onClick={() => setPicking(true)}>
          {atBeginning ? "Already partway in? Set a starting chapter" : startLabel}
        </button>
      )}
      <div className="footer">
        <Button onClick={proceed}>{restarting ? "Start over" : sameBook ? startLabel : `Switch to ${toName}`}</Button>
      </div>
      {picking ? (
        <StartingChapterSheet
          key={`${bookId}-${start.chapter}-${start.verse}`}
          bookId={bookId}
          initialChapter={start.chapter}
          initialVerse={start.verse}
          onClose={() => setPicking(false)}
          onConfirm={(selection) => {
            const resolved = resolveSwitchPlace(
              snapshot.places,
              bookId,
              selection.chapter,
              selection.verse,
              selection.countEarlier,
            );
            if (saved && resolved === saved) {
              setChoice("resume");
              setCustom(null);
              setCountEarlier(undefined);
            } else if (saved && resolved.chapter === 1 && resolved.verse === 1 && resolved.countedThrough === 0) {
              setChoice("restart");
              setCustom(null);
              setCountEarlier(false);
            } else {
              setChoice("custom");
              setCustom({ chapter: resolved.chapter, verse: resolved.verse });
              setCountEarlier(selection.countEarlier);
            }
            setPicking(false);
          }}
        />
      ) : null}
      {confirming ? (
        <SwitchBookConfirm
          fromName={fromName}
          toName={toName}
          sameBook={sameBook}
          restarting={restarting}
          startLabel={startLabel}
          detail={switchTargetLabel(toName, start.chapter, start.verse)}
          timing={switchTiming(snapshot, today, bookId)}
          plan={snapshot.prefs.readingMode === "plan"}
          todayDone={snapshot.days[today]?.readDone === true}
          onClose={() => setConfirming(false)}
          onConfirm={commit}
        />
      ) : null}
    </Sheet>
  );
}

export function SwitchBookConfirm({
  fromName,
  toName,
  sameBook,
  restarting,
  startLabel,
  detail,
  timing,
  plan,
  todayDone,
  onClose,
  onConfirm,
}: {
  fromName: string;
  toName: string;
  sameBook: boolean;
  restarting: boolean;
  startLabel: string;
  detail: string;
  timing: SwitchTiming;
  plan: boolean;
  todayDone: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const message = restarting
    ? startOverConfirmCopy(toName)
    : sameBook
      ? `${startLabel}? Days you’ve already read stay as they are.`
      : switchConfirmCopy(fromName, toName);
  const note = restarting
    ? startOverNote({ timing, detail, plan, sameBook, fromName })
    : switchTimingNote({ timing, detail, plan, sameBook, todayDone });
  const actionLabel = restarting
    ? "Start over"
    : sameBook
      ? startLabel
      : timing === "tomorrow"
        ? `Start ${toName} tomorrow`
        : `Switch to ${toName}`;
  const title = restarting ? "Start over?" : sameBook ? "Start here?" : "Switch book?";
  return (
    <Sheet title={title} onClose={onClose}>
      <p>{message}</p>
      <p className="soft">{note}</p>
      <div className="footer">
        <Button onClick={onConfirm}>{actionLabel}</Button>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
