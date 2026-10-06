import { useEffect, useState } from "react";
import { getBook } from "../../domain/books";
import { bibleUrl } from "../../domain/refs";
import type { ResolvedPassage } from "../../domain/resolve";
import { yesterdayDetour, showWelcomeBack } from "../../domain/streaks";
import { useApp } from "../../state/AppState";
import { BookOpen, Bookmark, Check, ChevronRight, NotebookPen, Pencil, PenLine } from "../../components/Icons";
import { Button } from "../../components/ui";

export function PassageView({
  passage,
  onAdjust,
  onChangeBook,
  onDetour,
  onBackToBook,
  onReflect,
  onRead,
  onPlanRef,
}: {
  passage: Extract<ResolvedPassage, { kind: "book" | "plan" | "detour" }>;
  onAdjust: () => void;
  onChangeBook: () => void;
  onDetour: () => void;
  onBackToBook: () => void;
  onReflect: () => void;
  onRead: () => void;
  onPlanRef: (ref: string) => void;
}) {
  const { snapshot, today, online } = useApp();
  const day = snapshot.days[today];
  const bookName = getBook(snapshot.prefs.bookId)?.name ?? "Mark";
  const welcome = showWelcomeBack(snapshot.days, today, snapshot.prefs.planStartDate);
  const returned = yesterdayDetour(snapshot.days, today);
  const ref = passage.ref;
  const href = bibleUrl(ref);

  return (
    <div className="passage">
      <div className="nav-row">
        <p className="yes-row">
          <Check size={14} aria-hidden="true" />
          You said yes{day?.note ? ` · ${day.note}` : ""}
        </p>
      </div>
      {passage.kind !== "plan" ? (
        <div className="toggle" role="group" aria-label="Reading">
          <button type="button" className={passage.kind === "book" ? "is-active" : ""} onClick={onBackToBook}>
            <Bookmark size={14} aria-hidden="true" /> {bookName}
          </button>
          <button type="button" className={passage.kind === "detour" ? "is-active" : ""} onClick={onDetour}>
            <PenLine size={14} aria-hidden="true" /> Something else
          </button>
        </div>
      ) : null}
      {passage.kind === "book" && returned ? (
        <p className="banner">
          <span className="kicker">Back to {bookName}</span>
          Yesterday you read {returned.passageRef} — your place was saved.
        </p>
      ) : null}
      {passage.kind === "book" && welcome && !returned ? (
        <p className="banner">
          <span className="kicker">Welcome back</span>
          Good to see you. No catching up required — {bookName} will wait.
        </p>
      ) : null}
      <PassageBody passage={passage} onPlanRef={onPlanRef} />
      {passage.kind === "book" ? (
        <div className="link-row">
          <button type="button" onClick={onAdjust}>
            <Pencil size={14} aria-hidden="true" /> Adjust verses
          </button>
          <button type="button" onClick={onChangeBook}>
            <BookOpen size={14} aria-hidden="true" /> Change book
          </button>
        </div>
      ) : null}
      {passage.kind === "detour" ? <p className="soft">{passage.backupLabel}</p> : null}
      {passage.kind === "plan" ? <p className="soft">{passage.backupLabel}</p> : null}
      <button type="button" className="reflect-row" onClick={onReflect}>
        <span className="note-icon" aria-hidden="true">
          <NotebookPen size={16} />
        </span>
        <span>
          <strong>Reflect as you read</strong>
          <span>Jot notes, questions, a verse to keep</span>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <div className="footer">
        <a
          className={online ? "btn btn-quiet" : "btn btn-quiet is-disabled"}
          href={online ? href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!online}
          onClick={(event) => {
            if (!online) event.preventDefault();
          }}
        >
          Open {ref} ↗
        </a>
        <Button data-testid="mark-read" onClick={onRead}>
          I read it
        </Button>
        <p className="caption">
          {online
            ? "Opens in Bible Gateway · needs a connection"
            : "You’re offline. The passage link waits until you’re back — your place is saved here."}
        </p>
      </div>
    </div>
  );
}

function PassageBody({
  passage,
  onPlanRef,
}: {
  passage: Extract<ResolvedPassage, { kind: "book" | "plan" | "detour" }>;
  onPlanRef: (ref: string) => void;
}) {
  if (passage.kind === "book") {
    const headline = passage.range.startChapter === passage.range.endChapter
      ? `${passage.ref.split(":")[0]}`
      : passage.ref;
    return (
      <div className="passage-copy">
        <p className="kicker yes-row">
          <Bookmark size={14} aria-hidden="true" />
          Pick up where you left off
        </p>
        <h1 className="display-52">{headline}</h1>
        <p className="hint">
          {passage.verseLabel}
          {passage.hint ? ` · ${passage.hint}` : ""}
        </p>
        <p className="meta">{passage.chapterLabel}</p>
      </div>
    );
  }
  if (passage.kind === "detour") {
    return (
      <div className="passage-copy">
        <p className="kicker">What you’re reading today</p>
        <h1>{passage.ref}</h1>
      </div>
    );
  }
  return <PlanBody passage={passage} onPlanRef={onPlanRef} />;
}

function PlanBody({
  passage,
  onPlanRef,
}: {
  passage: Extract<ResolvedPassage, { kind: "plan" }>;
  onPlanRef: (ref: string) => void;
}) {
  const [draft, setDraft] = useState(passage.ref);
  useEffect(() => setDraft(passage.ref), [passage.ref]);
  return (
    <div className="passage-copy">
      <p className="kicker">
        Day {passage.dayIndex} of {passage.planLength}
      </p>
      {passage.title ? <p className="meta">{passage.title}</p> : null}
      <h1>{passage.ref}</h1>
      {passage.prompt ? (
        <p className="prompt">
          <span className="kicker">As you read</span>
          {passage.prompt}
        </p>
      ) : null}
      <label className="field">
        <span>Or enter the reading you already follow</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft.trim();
            if (next && next !== passage.ref) onPlanRef(next);
          }}
        />
      </label>
    </div>
  );
}
