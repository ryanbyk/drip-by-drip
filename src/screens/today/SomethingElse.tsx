import { useMemo, useState } from "react";
import { bibleUrl } from "../../domain/refs";
import { detourIdeas } from "../../domain/suggestions";
import { useApp } from "../../state/AppState";
import { Bookmark, Check, ChevronRight, NotebookPen, PenLine, X } from "../../components/Icons";
import { Button } from "../../components/ui";

export function SomethingElse({
  bookName,
  backupLabel,
  initialRef,
  onUse,
  onBackToBook,
  onReflect,
  onRead,
}: {
  bookName: string;
  backupLabel: string;
  initialRef: string;
  onUse: (ref: string) => void;
  onBackToBook: () => void;
  onReflect: () => void;
  onRead: () => void;
}) {
  const { snapshot, today, online } = useApp();
  const ideas = useMemo(() => detourIdeas(today, snapshot.days), [today, snapshot.days]);
  const [value, setValue] = useState(initialRef);
  const shorts = ideas.filter((item) => item.group === "short");
  const recent = ideas.filter((item) => item.group === "recent");
  const ref = value.trim();
  const href = ref ? bibleUrl(ref) : undefined;

  function commit(next: string) {
    const trimmed = next.trim();
    setValue(trimmed);
    if (trimmed) onUse(trimmed);
  }

  return (
    <div className="passage">
      <div className="nav-row">
        <p className="commit-tag">
          <Check size={14} aria-hidden="true" />
          You said yes
        </p>
      </div>
      <div className="toggle" role="group" aria-label="Reading">
        <button type="button" onClick={onBackToBook}>
          <Bookmark size={14} aria-hidden="true" /> {bookName}
        </button>
        <button type="button" className="is-active">
          <PenLine size={14} aria-hidden="true" /> Something else
        </button>
      </div>
      <article className="suggest-card passage-card">
        <p className="card-eyebrow">What are you reading today?</p>
        <label className="ref-input">
          <span className="sr-only">Passage</span>
          <input
            value={value}
            placeholder="Luke 10:38–42; Psalm 46"
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => commit(value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(value);
            }}
          />
          {value ? (
            <button type="button" className="icon-btn" aria-label="Clear passage" onClick={() => setValue("")}>
              <X size={16} />
            </button>
          ) : null}
        </label>
        <div className="chip-block">
          <p>Today’s short drips</p>
          <div className="chips">
            {shorts.map((item) => (
              <button key={item.ref} type="button" className="chip" onClick={() => commit(item.ref)}>
                {item.ref}
              </button>
            ))}
          </div>
        </div>
        {recent.length > 0 ? (
          <div className="chip-block">
            <p>Recent</p>
            <div className="chips">
              {recent.map((item) => (
                <button key={item.ref} type="button" className="chip" onClick={() => commit(item.ref)}>
                  {item.ref}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </article>
      <p className="saved-place">
        <Bookmark size={14} aria-hidden="true" />
        {backupLabel}
      </p>
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
          className={online && href ? "btn btn-quiet btn-open" : "btn btn-quiet btn-open is-disabled"}
          href={online ? href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!online || !href}
          onClick={(event) => {
            if (!online || !href) event.preventDefault();
          }}
        >
          {ref ? `Open ${ref} ↗` : "Open passage"}
        </a>
        <Button
          className="btn-yes"
          data-testid="mark-read"
          onClick={() => {
            commit(ref);
            onRead();
          }}
          disabled={!ref}
        >
          I read it
        </Button>
      </div>
    </div>
  );
}
