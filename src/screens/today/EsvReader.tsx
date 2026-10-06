import { useEffect, useRef, useState, type ReactNode } from "react";
import { ALargeSmall, BookmarkPlus, ChevronLeft, NotebookPen } from "../../components/Icons";
import { OpenPassageLink } from "../../components/OpenPassageLink";
import { Button } from "../../components/ui";
import { cachedEsvPassage, fetchEsvPassage, type EsvBlock, type EsvPassage, type EsvRun } from "../../lib/esvApi";
import { useApp } from "../../state/AppState";

type ReaderSize = "compact" | "regular" | "large";

export function EsvReader({
  reference,
  onBack,
  onReflect,
  onRead,
  onUnavailable,
  passage: provided,
  continues,
}: {
  reference: string;
  onBack: () => void;
  onReflect: () => void;
  onRead: () => void;
  onUnavailable?: () => void;
  passage?: EsvPassage;
  continues?: string;
}) {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const tags = day?.verseTags ?? [];
  const [passage, setPassage] = useState<EsvPassage | null>(provided ?? cachedEsvPassage(reference));
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<ReaderSize>("regular");
  const [recent, setRecent] = useState<string | null>(tags[tags.length - 1] ?? null);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (provided) {
      setPassage(provided);
      setFailed(false);
      return;
    }
    const cached = cachedEsvPassage(reference);
    if (cached) {
      setPassage(cached);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setPassage(null);
    setFailed(false);
    void fetchEsvPassage(reference).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        onUnavailableRef.current?.();
        return;
      }
      setPassage(result.passage);
    });
    return () => {
      cancelled = true;
    };
  }, [provided, reference]);

  function toggleTag(tag: string) {
    if (!day) return;
    const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
    setRecent(next.includes(tag) ? tag : (next[next.length - 1] ?? null));
    dispatch({
      type: "reflection",
      today,
      reflection: day.reflection ?? "",
      huh: day.huh,
      verseTags: next,
    });
  }

  const tagged = new Set(tags);

  return (
    <>
      <header className="reader-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <div className="reader-title">
          <strong>{reference}</strong>
          <span>ESV · in app</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={sizeLabel(size)}
          onClick={() => setSize((current) => nextSize(current))}
        >
          <ALargeSmall size={18} />
        </button>
      </header>
      <div className={bodyClass(size)}>
        {passage ? (
          <>
            {passage.blocks.map((block, index) => (
              <BlockView key={index} block={block} tagged={tagged} onToggle={toggleTag} />
            ))}
            <p className="reader-hint">
              <BookmarkPlus size={14} aria-hidden="true" />
              {hintFor(tags, recent)}
            </p>
            {continues ? <p className="reader-continues">{continues}</p> : null}
            <p className="reader-copy">
              {passage.copyright}{" "}
              <a href="https://www.esv.org/" target="_blank" rel="noopener noreferrer">
                esv.org
              </a>
            </p>
          </>
        ) : failed ? (
          <div className="reader-fallback">
            <p className="reader-empty">Couldn’t open this passage in the app.</p>
            <OpenPassageLink reference={reference} className="btn btn-quiet btn-open" />
          </div>
        ) : (
          <p className="reader-empty">Opening the passage…</p>
        )}
      </div>
      <div className="reader-actions">
        <button type="button" className="reader-reflect" onClick={onReflect}>
          <NotebookPen size={18} aria-hidden="true" />
          Reflect
        </button>
        <Button data-testid="mark-read" onClick={onRead}>
          I read it
        </Button>
      </div>
    </>
  );
}

function BlockView({
  block,
  tagged,
  onToggle,
}: {
  block: EsvBlock;
  tagged: ReadonlySet<string>;
  onToggle: (tag: string) => void;
}) {
  switch (block.kind) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "paragraph":
      return (
        <>
          {piecesOf(block.runs, tagged).map((piece, index) => (
            <p key={index} className={piece.tagged ? "reader-tagged" : "reader-prose"}>
              {piece.runs.map((run, runIndex) => (
                <span key={runIndex}>
                  {runIndex > 0 ? " " : null}
                  <RunText run={run} tagged={tagged} onToggle={onToggle} />
                </span>
              ))}
            </p>
          ))}
        </>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

function RunText({
  run,
  tagged,
  onToggle,
}: {
  run: EsvRun;
  tagged: ReadonlySet<string>;
  onToggle: (tag: string) => void;
}): ReactNode {
  switch (run.kind) {
    case "text":
      return run.text;
    case "verse": {
      const tag = `${run.chapter}:${run.verse}`;
      return (
        <button type="button" className="reader-verse" aria-pressed={tagged.has(tag)} onClick={() => onToggle(tag)}>
          <sup>{run.verse}</sup>
          {run.text}
        </button>
      );
    }
    default: {
      const exhaustive: never = run;
      return exhaustive;
    }
  }
}

function piecesOf(runs: EsvRun[], tagged: ReadonlySet<string>): Array<{ tagged: boolean; runs: EsvRun[] }> {
  const pieces: Array<{ tagged: boolean; runs: EsvRun[] }> = [];
  let open: { tagged: boolean; runs: EsvRun[] } | null = null;
  for (const run of runs) {
    const isTagged = runIsTagged(run, tagged, open?.tagged ?? false);
    if (!open || open.tagged !== isTagged) {
      open = { tagged: isTagged, runs: [] };
      pieces.push(open);
    }
    open.runs.push(run);
  }
  return pieces;
}

function runIsTagged(run: EsvRun, tagged: ReadonlySet<string>, previous: boolean): boolean {
  switch (run.kind) {
    case "verse":
      return tagged.has(`${run.chapter}:${run.verse}`);
    case "text":
      return previous;
    default: {
      const exhaustive: never = run;
      return exhaustive;
    }
  }
}

function hintFor(tags: string[], recent: string | null): string {
  const shown = recent && tags.includes(recent) ? recent : tags[tags.length - 1];
  if (!shown) return "Tap any verse to tag it";
  return `${shown} added to your note · tap any verse to tag it`;
}

function nextSize(size: ReaderSize): ReaderSize {
  switch (size) {
    case "regular":
      return "large";
    case "large":
      return "compact";
    case "compact":
      return "regular";
    default: {
      const exhaustive: never = size;
      return exhaustive;
    }
  }
}

function sizeLabel(size: ReaderSize): string {
  switch (size) {
    case "compact":
      return "Text size, smaller";
    case "regular":
      return "Text size";
    case "large":
      return "Text size, larger";
    default: {
      const exhaustive: never = size;
      return exhaustive;
    }
  }
}

function bodyClass(size: ReaderSize): string {
  switch (size) {
    case "compact":
      return "reader-body is-compact";
    case "regular":
      return "reader-body";
    case "large":
      return "reader-body is-large";
    default: {
      const exhaustive: never = size;
      return exhaustive;
    }
  }
}
