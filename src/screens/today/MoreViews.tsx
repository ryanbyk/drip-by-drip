import { useMemo, useState } from "react";
import { chapterCount, getBook, verseCount } from "../../domain/books";
import { addDays } from "../../domain/dates";
import { dripFromPlace, isPlaceFinished, makeRange, placeAfter, verseInRange } from "../../domain/drip";
import { formatRef, parsePassage } from "../../domain/refs";
import type { Range } from "../../domain/types";
import { detourIdeas, suggestedNext } from "../../domain/suggestions";
import { useApp } from "../../state/AppState";
import { MapPin, Share } from "../../components/Icons";
import { BookPicker, Button, PacePicker, Sheet } from "../../components/ui";

const PROMPTS = ["What stood out?", "About God?", "Carry today?"];

export function ReflectView({ onKeep, onRead }: { onKeep: () => void; onRead: () => void }) {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const [text, setText] = useState(day?.reflection ?? "");
  const [huh, setHuh] = useState(Boolean(day?.huh));

  function save() {
    dispatch({ type: "reflection", today, reflection: text, huh });
  }

  return (
    <div className="reflect">
      <div className="nav-row">
        <button type="button" className="text-link" onClick={onKeep}>
          Back
        </button>
        <p>Saved on this device</p>
      </div>
      <p className="kicker">Reflect</p>
      <h1>{day?.passageRef ?? "Today’s drip"}</h1>
      <p className="kicker">Need a nudge?</p>
      <div className="chips">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chip"
            onClick={() => setText((current) => (current.includes(prompt) ? current : `${current}${current ? "\n" : ""}${prompt}\n`))}
          >
            {prompt}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="sr-only">Note</span>
        <textarea
          value={text}
          rows={6}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder="Confusion is welcome. Keep going."
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={huh} onChange={(event) => setHuh(event.target.checked)} />
        Mark it “Huh?” — something confusing is easy to revisit later
      </label>
      <div className="footer">
        <Button
          variant="quiet"
          onClick={() => {
            save();
            onKeep();
          }}
        >
          Save & keep reading
        </Button>
        <Button
          onClick={() => {
            save();
            onRead();
          }}
        >
          I read it
        </Button>
      </div>
    </div>
  );
}

export function DetourView({ onUse, onBack }: { onUse: (ref: string) => void; onBack: () => void }) {
  const { snapshot, today } = useApp();
  const ideas = useMemo(() => detourIdeas(today, snapshot.days), [today, snapshot.days]);
  const [custom, setCustom] = useState("");
  const shorts = ideas.filter((item) => item.group === "short");
  const recent = ideas.filter((item) => item.group === "recent");

  return (
    <div className="detour">
      <div className="nav-row">
        <button type="button" className="text-link" onClick={onBack}>
          Back to {getBook(snapshot.prefs.bookId)?.name ?? "your book"}
        </button>
      </div>
      <p className="kicker">What are you reading today?</p>
      <h1>Something else</h1>
      <p className="soft">{snapshot.prefs.readingMode === "book" ? "Your place stays saved." : "This won’t move your backup bookmark."}</p>
      <div className="choice-list">
        {shorts.map((item) => (
          <button key={item.ref} type="button" className="choice" onClick={() => onUse(item.ref)}>
            <strong>{item.ref}</strong>
            <span>A short drip</span>
          </button>
        ))}
        {recent.map((item) => (
          <button key={item.ref} type="button" className="choice" onClick={() => onUse(item.ref)}>
            <strong>{item.ref}</strong>
            <span>Recent</span>
          </button>
        ))}
      </div>
      <label className="field">
        <span>Or type it</span>
        <input
          value={custom}
          placeholder="e.g. Luke 10:38–42; Psalm 46"
          onChange={(event) => setCustom(event.target.value)}
        />
      </label>
      <div className="footer">
        <Button onClick={() => custom.trim() && onUse(custom.trim())} disabled={!custom.trim()}>
          Read this today
        </Button>
      </div>
    </div>
  );
}

export function FinishedView({ onDetour, onChoose }: { onDetour: () => void; onChoose: () => void }) {
  const { snapshot, today, dispatch } = useApp();
  const passageBook = snapshot.prefs.bookId;
  const book = getBook(passageBook);
  const nextDate = addDays(today, 1);

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
        <h1>You finished {book?.name ?? "this book"}.</h1>
        <p>
          {book ? `${book.verses.length} chapters` : "Every chapter"}, one drip at a time. Where would you like to go next?
        </p>
      </div>
      <p className="kicker">What’s next?</p>
      <div className="choice-list">
        {suggestedNext(passageBook).map((item) => {
          const next = getBook(item.id);
          if (!next) return null;
          return (
            <button
              key={item.id}
              type="button"
              className="choice"
              onClick={() => dispatch({ type: "queueBook", bookId: item.id, when: "today", today, tomorrow: nextDate })}
            >
              <strong>{next.name}</strong>
              <span>{item.blurb}</span>
            </button>
          );
        })}
      </div>
      <div className="footer">
        <Button variant="quiet" onClick={onChoose}>
          Choose another book
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
  return (
    <Sheet title="Yes — I’ll read today" onClose={onContinue}>
      <p className="soft">Saved {day?.answeredAt ? new Date(day.answeredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "just now"}</p>
      <label className="field">
        <span className="label-row">
          When / where will you read?
          <MapPin size={18} aria-hidden="true" />
        </span>
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
      <p className="meta">Optional</p>
      <div className="footer">
        <Button onClick={onContinue}>Continue</Button>
        <Button variant="text" onClick={() => void share(day?.passageRef)}>
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

  return (
    <Sheet title="Today’s passage" onClose={onClose}>
      <p className="meta">{book?.name}</p>
      <div className="range-grid">
        <label className="field">
          <span>From chapter</span>
          <input
            type="number"
            min={1}
            max={chapterCount(draft.bookId)}
            value={draft.startChapter}
            onChange={(event) =>
              setDraft({ ...draft, startChapter: Number(event.target.value) || 1 })
            }
          />
        </label>
        <label className="field">
          <span>From verse</span>
          <input
            type="number"
            min={1}
            max={verseCount(draft.bookId, draft.startChapter)}
            value={draft.startVerse}
            onChange={(event) => setDraft({ ...draft, startVerse: Number(event.target.value) || 1 })}
          />
        </label>
        <label className="field">
          <span>To chapter</span>
          <input
            type="number"
            min={1}
            max={chapterCount(draft.bookId)}
            value={draft.endChapter}
            onChange={(event) => setDraft({ ...draft, endChapter: Number(event.target.value) || draft.startChapter })}
          />
        </label>
        <label className="field">
          <span>To verse</span>
          <input
            type="number"
            min={1}
            max={verseCount(draft.bookId, draft.endChapter)}
            value={draft.endVerse}
            onChange={(event) => setDraft({ ...draft, endVerse: Number(event.target.value) || 1 })}
          />
        </label>
      </div>
      <div className="chips">
        {presets.map((preset) => (
          <button key={preset.label} type="button" className="chip" onClick={() => setDraft(preset.range)}>
            {preset.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Or type it</span>
        <input value={typed} placeholder="e.g. Mark 4:1–20" onChange={(event) => setTyped(event.target.value)} />
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
          Use {formatRef(draft)}
        </Button>
      </div>
    </Sheet>
  );
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

export function StopSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const range = day?.range;
  const [mode, setMode] = useState<"all" | "part">("all");
  const [chapter, setChapter] = useState(range?.endChapter ?? 1);
  const [verse, setVerse] = useState(range?.endVerse ?? 1);
  if (!range) return null;
  const stop = mode === "all" ? { chapter: range.endChapter, verse: range.endVerse } : { chapter, verse };
  const valid = verseInRange(range, stop.chapter, stop.verse);
  const next = placeAfter(range.bookId, stop.chapter, stop.verse);
  const finished = isPlaceFinished(next);
  const upcoming = finished ? null : dripFromPlace(next, snapshot.prefs.dripSize);
  const book = getBook(range.bookId);

  return (
    <Sheet title="Where did you stop?" onClose={onClose}>
      <p className="soft">So tomorrow picks up in the right place.</p>
      <div className="choice-list">
        <button type="button" className={mode === "all" ? "choice is-active" : "choice"} onClick={() => setMode("all")}>
          <strong>Read all of it</strong>
          <span>Through {formatRef({ ...range, startChapter: range.endChapter, startVerse: range.endVerse, endChapter: range.endChapter, endVerse: range.endVerse })}</span>
        </button>
        <button type="button" className={mode === "part" ? "choice is-active" : "choice"} onClick={() => setMode("part")}>
          <strong>Stopped partway</strong>
          <span>Pick the last verse you read</span>
        </button>
      </div>
      {mode === "part" ? (
        <div className="range-grid">
          <label className="field">
            <span>Chapter</span>
            <input
              type="number"
              min={range.startChapter}
              max={range.endChapter}
              value={chapter}
              onChange={(event) => setChapter(Number(event.target.value) || range.startChapter)}
            />
          </label>
          <label className="field">
            <span>Verse</span>
            <input
              type="number"
              min={1}
              max={verseCount(range.bookId, chapter)}
              value={verse}
              onChange={(event) => setVerse(Number(event.target.value) || 1)}
            />
          </label>
        </div>
      ) : null}
      <p className="meta">
        {finished
          ? `That finishes ${book?.name ?? "the book"}.`
          : upcoming
            ? `Tomorrow’s drip: ${formatRef(upcoming)}`
            : "Your place is saved."}
      </p>
      <div className="footer">
        <Button
          disabled={!valid}
          onClick={() => {
            dispatch({ type: "finish", today, at: new Date().toISOString(), stop });
            onClose();
          }}
        >
          Save & finish
        </Button>
      </div>
    </Sheet>
  );
}

export function ChangeBookSheet({ onClose, when }: { onClose: () => void; when: "today" | "track" }) {
  const { snapshot, today, dispatch } = useApp();
  const [bookId, setBookId] = useState(snapshot.prefs.bookId);
  const [dripSize, setDripSize] = useState(snapshot.prefs.dripSize);
  const [chapter, setChapter] = useState(1);
  const book = getBook(bookId);

  return (
    <Sheet title="What you’re reading" onClose={onClose}>
      <BookPicker selectedId={bookId} onSelect={setBookId} />
      <p className="kicker">Daily drip size</p>
      <PacePicker value={dripSize} onChange={setDripSize} />
      <label className="field">
        <span>Start chapter</span>
        <input
          type="number"
          min={1}
          max={book?.verses.length ?? 1}
          value={chapter}
          onChange={(event) => setChapter(Number(event.target.value) || 1)}
        />
      </label>
      <div className="footer">
        <Button
          onClick={() => {
            if (when === "today") {
              dispatch({ type: "queueBook", bookId, when: "today", today, tomorrow: today });
            } else {
              dispatch({ type: "reading", today, bookId, dripSize, mode: "book", startChapter: chapter });
            }
            onClose();
          }}
        >
          Read {book?.name ?? "this book"}
        </Button>
      </div>
    </Sheet>
  );
}
