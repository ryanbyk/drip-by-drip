import { useEffect, useState } from "react";
import { getBook } from "../../domain/books";
import { parseLocalDate } from "../../domain/dates";
import { passageLink } from "../../domain/bibleSource";
import type { ResolvedPassage } from "../../domain/resolve";
import { activePlace } from "../../domain/resolve";
import { lastReadDate, showWelcomeBack, yesterdayDetour } from "../../domain/streaks";
import { useApp } from "../../state/AppState";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  CornerDownRight,
  NotebookPen,
  Pencil,
  PenLine,
  Sun,
} from "../../components/Icons";
import { OpenPassageLink } from "../../components/OpenPassageLink";
import { Button } from "../../components/ui";
import { SomethingElse } from "./SomethingElse";

export function PassageView({
  passage,
  onAdjust,
  onChangeBook,
  onDetour,
  onUseDetour,
  onBackToBook,
  onReflect,
  onRead,
  onPlanRef,
  onReadInApp,
}: {
  passage: Extract<ResolvedPassage, { kind: "book" | "plan" | "detour" }>;
  onAdjust: () => void;
  onChangeBook: () => void;
  onDetour: () => void;
  onUseDetour: (ref: string) => void;
  onBackToBook: () => void;
  onReflect: () => void;
  onRead: () => void;
  onPlanRef: (ref: string) => void;
  onReadInApp?: () => void;
}) {
  const { snapshot, today, online } = useApp();
  const bookName = getBook(snapshot.prefs.bookId)?.name ?? "Mark";
  const place = activePlace(snapshot);

  if (passage.kind === "detour") {
    return (
      <SomethingElse
        bookName={bookName}
        backupLabel={passage.backupLabel}
        initialRef={passage.ref}
        onUse={onUseDetour}
        onBackToBook={onBackToBook}
        onReflect={onReflect}
        onRead={onRead}
      />
    );
  }

  const welcome =
    passage.kind === "book" &&
    showWelcomeBack(snapshot.days, today, snapshot.prefs.planStartDate) &&
    !yesterdayDetour(snapshot.days, today);
  const passageClass = passage.kind === "plan" ? "passage passage-plan" : welcome ? "passage passage-welcome" : "passage";
  const note = snapshot.days[today]?.note?.trim();

  return (
    <div className={passageClass}>
      {passage.kind === "plan" ? (
        <div className="nav-row is-centered">
          <p className="nav-title">
            Day {passage.dayIndex} of {passage.planLength}
          </p>
        </div>
      ) : (
        <div className="nav-row">
          <p className="commit-tag">
            <Check size={14} aria-hidden="true" />
            You said yes
          </p>
        </div>
      )}
      {passage.kind === "book" ? (
        <BookPassage
          passage={passage}
          bookName={bookName}
          placeVerse={place.verse}
          online={online}
          welcome={showWelcomeBack(snapshot.days, today, snapshot.prefs.planStartDate)}
          returnedRef={yesterdayDetour(snapshot.days, today)?.passageRef}
          lastRead={lastReadDate(snapshot.days, today)}
          onAdjust={onAdjust}
          onChangeBook={onChangeBook}
          onDetour={onDetour}
          onReflect={onReflect}
          onRead={onRead}
          onReadInApp={onReadInApp}
        />
      ) : (
        <PlanBody
          passage={passage}
          note={note}
          onPlanRef={onPlanRef}
          online={online}
          onRead={onRead}
          onReflect={onReflect}
          onReadInApp={onReadInApp}
        />
      )}
    </div>
  );
}

function BookPassage({
  passage,
  bookName,
  placeVerse,
  online,
  welcome,
  returnedRef,
  lastRead,
  onAdjust,
  onChangeBook,
  onDetour,
  onReflect,
  onRead,
  onReadInApp,
}: {
  passage: Extract<ResolvedPassage, { kind: "book" }>;
  bookName: string;
  placeVerse: number;
  online: boolean;
  welcome: boolean;
  returnedRef?: string;
  lastRead: string | null;
  onAdjust: () => void;
  onChangeBook: () => void;
  onDetour: () => void;
  onReflect: () => void;
  onRead: () => void;
  onReadInApp?: () => void;
}) {
  const total = getBook(passage.range.bookId)?.verses.length ?? 1;
  const progress = Math.min(100, Math.round((passage.range.startChapter / total) * 100));
  const returned = Boolean(returnedRef);
  const greeting = welcome && !returned;
  const eyebrow = returned ? `Back to ${bookName}` : greeting ? "Welcome back" : "Pick up where you left off";
  const detail = returned
    ? placeVerse > 1
      ? `Picking up after verse ${placeVerse - 1}`
      : passage.verseLabel
    : greeting && lastRead
      ? `Where you left off last ${parseLocalDate(lastRead).toLocaleDateString("en-US", { weekday: "long" })} · ${passage.verseLabel}`
      : `${passage.verseLabel}${passage.hint ? ` · ${passage.hint}` : ""}`;

  return (
    <>
      {greeting ? (
        <div className="greeting">
          <h1>Good to see you.</h1>
          <p>No catching up required — {bookName} will wait.</p>
        </div>
      ) : null}
      <div className="toggle" role="group" aria-label="Reading">
        <button type="button" className="is-active">
          <Bookmark size={14} aria-hidden="true" /> {bookName}
        </button>
        <button type="button" onClick={onDetour}>
          <PenLine size={14} aria-hidden="true" /> Something else
        </button>
      </div>
      <article className="suggest-card passage-card">
        <p className="card-eyebrow">
          {greeting ? <Sun size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
          {eyebrow}
        </p>
        {returned && returnedRef ? (
          <p className="detour-note">
            <CornerDownRight size={14} aria-hidden="true" />
            Yesterday you read {returnedRef} — your place was saved.
          </p>
        ) : null}
        <h1 className="display-52">{passage.ref}</h1>
        <p className="hint">{detail}</p>
        <div className="track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="meta">{passage.chapterLabel}</p>
        <div className="pill-actions">
          <button type="button" onClick={onAdjust}>
            <Pencil size={14} aria-hidden="true" /> Adjust verses
          </button>
          <button type="button" className="is-muted" onClick={onChangeBook}>
            <BookOpen size={14} aria-hidden="true" /> Change book
          </button>
        </div>
      </article>
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
        <ReadInAppButton onReadInApp={onReadInApp} />
        <OpenPassageLink reference={passage.ref} className="btn btn-quiet btn-open" online={online} />
        <Button className="btn-yes" data-testid="mark-read" onClick={onRead}>
          I read it
        </Button>
      </div>
    </>
  );
}

function PlanBody({
  passage,
  note,
  onPlanRef,
  online,
  onRead,
  onReflect,
  onReadInApp,
}: {
  passage: Extract<ResolvedPassage, { kind: "plan" }>;
  note?: string;
  onPlanRef: (ref: string) => void;
  online: boolean;
  onRead: () => void;
  onReflect: () => void;
  onReadInApp?: () => void;
}) {
  const { snapshot } = useApp();
  const link = passageLink(passage.ref, snapshot.prefs);
  const [draft, setDraft] = useState(passage.ref);
  useEffect(() => setDraft(passage.ref), [passage.ref]);
  const commit = note ? `You said yes · ${note.toLowerCase()}` : "You said yes";
  return (
    <>
      <div className="passage-copy">
        <p className="commit-tag">
          <Check size={14} aria-hidden="true" />
          {commit}
        </p>
        <p className="kicker">Today’s drip</p>
        <h1 className="display-52">{passage.ref}</h1>
        {passage.title ? <p className="day-title">{passage.title}</p> : null}
        {passage.prompt ? (
          <div className="prompt">
            <div className="prompt-body">
              <span className="kicker">As you read</span>
              <p className="prompt-copy">{passage.prompt}</p>
            </div>
          </div>
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
        <p className="soft">{passage.backupLabel}</p>
      </div>
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
        <ReadInAppButton onReadInApp={onReadInApp} />
        <OpenPassageLink reference={passage.ref} className="btn btn-quiet btn-open" online={online} />
        <Button className="btn-yes" data-testid="mark-read" onClick={onRead}>
          I read it
        </Button>
        <p className="caption">
          {online ? link.detail : "You’re offline. The passage link waits until you’re back — your place is saved here."}
        </p>
      </div>
    </>
  );
}

function ReadInAppButton({ onReadInApp }: { onReadInApp?: () => void }) {
  if (!onReadInApp) return null;
  return (
    <button type="button" className="btn btn-quiet btn-open" onClick={onReadInApp}>
      Read in app
    </button>
  );
}
