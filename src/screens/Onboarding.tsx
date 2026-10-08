import { useState } from "react";
import { getBook } from "../domain/books";
import { startAtLabel } from "../domain/chapters";
import { formatAskTime } from "../domain/dates";
import { paceBlurb, weeksHint } from "../domain/suggestions";
import { DEFAULT_ASK_TIME, QBE_QUESTION, type DripSize } from "../domain/types";
import { notificationsSupported, requestNotificationPermission } from "../lib/reminders";
import { useApp } from "../state/AppState";
import {
  AppIcon,
  BookOpen,
  Calendar,
  ChevronRight,
  Droplet,
  HeartHandshake,
  Layers,
  ListChecks,
  ProgressDots,
  WaterDrop,
} from "../components/Icons";
import { StartingChapterSheet, type StartSelection } from "../components/StartingChapter";
import { AskTimePicker, BookPicker, Button, PacePicker } from "../components/ui";
import { SignIn } from "./SignIn";

export function Onboarding({ onSignIn }: { onSignIn?: () => void }) {
  const app = useApp();
  const { prefs } = app.snapshot;
  const step = prefs.onboardingStep;
  const [signingIn, setSigningIn] = useState(false);
  const openSignIn = onSignIn ?? (() => setSigningIn(true));

  if (!onSignIn && signingIn) return <SignIn onSkip={() => setSigningIn(false)} />;
  if (step === "time") return <AskTimeStep />;
  if (step === "notify") return <NotifyStep />;
  if (step === "reading") return <ReadingStep />;
  if (step === "book") return <PickBookStep />;
  if (step === "plan") return <PlanStep />;
  return <FramingStep onSignIn={openSignIn} />;
}

function FramingStep({ onSignIn }: { onSignIn: () => void }) {
  const { setPrefs } = useApp();
  return (
    <section className="screen screen-frame">
      <div className="brand">
        <Droplet size={18} aria-hidden="true" />
        <span>Drip by drip</span>
      </div>
      <div className="ripples" aria-hidden="true">
        <span className="ripple ripple-1" />
        <span className="ripple ripple-2" />
        <span className="ripple ripple-3" />
        <span className="drop-mark">
          <WaterDrop size={56} />
        </span>
      </div>
      <div className="copy">
        <h1 className="display-40">One small drip, every day.</h1>
        <p className="lede">
          Reading Scripture is a keystone habit — a small, steady practice that quietly shapes the rest of life.
        </p>
        <div className="gospel-note">
          <HeartHandshake size={18} aria-hidden="true" />
          <p>This isn’t a performance meter. Your standing with God rests on Christ alone — not on how many days you read.</p>
        </div>
      </div>
      <div className="footer">
        <ProgressDots active={0} />
        <Button onClick={() => setPrefs({ onboardingStep: "time" })}>Start</Button>
        <Button variant="quiet" onClick={onSignIn}>
          I already have an account
        </Button>
      </div>
    </section>
  );
}

function AskTimeStep() {
  const { snapshot, setPrefs } = useApp();
  const value = snapshot.prefs.askTime || DEFAULT_ASK_TIME;
  return (
    <section className="screen screen-gap-24">
      <p className="step">Step 2 of 4</p>
      <h1>When are you available and alert?</h1>
      <p className="lede">Once a day, at this time, we’ll ask you a single question. That’s the whole reminder.</p>
      <AskTimePicker value={value} onChange={(askTime) => setPrefs({ askTime })} />
      <div>
        <p className="eyebrow">Preview</p>
        <div className="notify-card">
          <AppIcon />
          <div>
            <p className="notify-app">Drip by drip · {formatAskTime(value)}</p>
            <p className="notify-q">{QBE_QUESTION}</p>
          </div>
        </div>
      </div>
      <div className="footer">
        <ProgressDots active={1} />
        <Button onClick={() => setPrefs({ onboardingStep: "notify", askTime: value })}>Save ask time</Button>
        <Button
          variant="text"
          onClick={() => setPrefs({ onboardingStep: "notify", askTime: DEFAULT_ASK_TIME })}
        >
          Skip for now
        </Button>
      </div>
    </section>
  );
}

function NotifyStep() {
  const { snapshot, setPrefs } = useApp();
  const browser = notificationsSupported() ? Notification.permission : "unsupported";
  const [blocked, setBlocked] = useState(browser === "denied" || browser === "unsupported");

  async function allow() {
    const result = await requestNotificationPermission();
    if (result === "granted") {
      setPrefs({ notificationsEnabled: true, notificationState: "granted", onboardingStep: "reading" });
      return;
    }
    if (result === "unsupported") {
      setPrefs({ notificationsEnabled: false, notificationState: "unsupported" });
      setBlocked(true);
      return;
    }
    setPrefs({ notificationsEnabled: false, notificationState: "denied" });
    setBlocked(true);
  }

  function skip() {
    setPrefs({
      notificationsEnabled: false,
      notificationState: browser === "unsupported" ? "unsupported" : "dismissed",
      onboardingStep: "reading",
    });
  }

  return (
    <section className="screen">
      <p className="step">Reminders</p>
      <h1>One question, at your ask time.</h1>
      <p className="lede">
        The notification only says: {QBE_QUESTION} Nothing else. You can say not today.
      </p>
      {blocked ? (
        <p className="note">
          {browser === "unsupported" || snapshot.prefs.notificationState === "unsupported"
            ? "This browser can’t send reminders. The question will be waiting whenever you open the app."
            : "Reminders are blocked here. You can allow them later in your browser settings — we won’t keep asking."}
        </p>
      ) : (
        <div className="preview-card">
          <p className="kicker">Preview</p>
          <p className="preview-title">Drip by drip · {formatAskTime(snapshot.prefs.askTime)}</p>
          <p className="preview-body">{QBE_QUESTION}</p>
        </div>
      )}
      <div className="footer">
        {blocked || browser === "granted" ? (
          <Button
            onClick={() =>
              setPrefs({
                onboardingStep: "reading",
                notificationsEnabled: browser === "granted",
                notificationState: browser === "granted" ? "granted" : snapshot.prefs.notificationState,
              })
            }
          >
            Continue
          </Button>
        ) : (
          <Button onClick={() => void allow()}>Allow reminders</Button>
        )}
        {!blocked && browser !== "granted" ? (
          <Button variant="text" onClick={skip}>
            Not now
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function ReadingStep() {
  const { snapshot, setPrefs, dispatch, today } = useApp();
  const book = getBook("mark");
  const size = snapshot.prefs.dripSize;
  const [picking, setPicking] = useState(false);

  function startMark(selection?: StartSelection) {
    dispatch({
      type: "completeOnboarding",
      today,
      at: new Date().toISOString(),
      mode: "book",
      bookId: "mark",
      dripSize: size,
      startChapter: selection?.chapter ?? 1,
      startVerse: selection?.verse ?? 1,
      ...(selection ? { countEarlier: selection.countEarlier } : {}),
      askTime: snapshot.prefs.askTime,
    });
  }

  return (
    <section className="screen screen-gap-22">
      <p className="step">Step 3 of 4</p>
      <h1>Start with a book. We suggest Mark.</h1>
      <p className="lede">A good first book: short, vivid, and all about Jesus. Reading something else some days? That’s easy too.</p>
      <article className="suggest-card is-featured">
        <p className="kicker">Suggested</p>
        <h2 className="suggest-title">Mark</h2>
        <p className="meta-row">
          <Layers size={13} aria-hidden="true" /> {book?.verses.length ?? 16} chapters
          <Calendar size={13} aria-hidden="true" /> {weeksHint("mark", size)}
          <Droplet size={13} aria-hidden="true" /> {size === "verses" ? "A few verses" : size === "two" ? "2 chapters / day" : "1 chapter / day"}
        </p>
        <PacePicker value={size} onChange={(dripSize) => setPrefs({ dripSize })} />
      </article>
      <div className="path-list">
        <button type="button" className="choice choice-row" onClick={() => setPrefs({ onboardingStep: "book", bookId: "mark" })}>
          <BookOpen size={18} aria-hidden="true" />
          <span>
            <strong>Pick a different book</strong>
            <span>Any of the 66, at your pace</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="choice choice-row" onClick={() => setPrefs({ onboardingStep: "plan" })}>
          <ListChecks size={18} aria-hidden="true" />
          <span>
            <strong>I already follow a plan</strong>
            <span>Enter each day’s reading — Mark stays as your backup</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="footer">
        <ProgressDots active={2} />
        <Button onClick={() => startMark()}>Continue</Button>
        <button type="button" className="partway-link" onClick={() => setPicking(true)}>
          Already partway in? Set a starting chapter
        </button>
      </div>
      {picking ? (
        <StartingChapterSheet bookId="mark" onClose={() => setPicking(false)} onConfirm={startMark} />
      ) : null}
    </section>
  );
}

function PickBookStep() {
  const { snapshot, setPrefs, dispatch, today } = useApp();
  const bookId = snapshot.prefs.bookId || "mark";
  const book = getBook(bookId);
  const [picking, setPicking] = useState(false);

  function start(selection?: StartSelection) {
    dispatch({
      type: "completeOnboarding",
      today,
      at: new Date().toISOString(),
      mode: "book",
      bookId,
      dripSize: snapshot.prefs.dripSize,
      startChapter: selection?.chapter ?? 1,
      startVerse: selection?.verse ?? 1,
      ...(selection ? { countEarlier: selection.countEarlier } : {}),
      askTime: snapshot.prefs.askTime,
    });
  }

  return (
    <section className="screen screen-gap-18">
      <button type="button" className="back" onClick={() => setPrefs({ onboardingStep: "reading" })}>
        Back
      </button>
      <p className="step">Step 3 of 4</p>
      <h1>Pick a book to read through</h1>
      <BookPicker
        selectedId={bookId}
        onSelect={(id) => {
          setPrefs({ bookId: id, draftStartChapter: 1 });
          setPicking(false);
        }}
      />
      <p className="kicker">Daily drip size</p>
      <PacePicker value={snapshot.prefs.dripSize} onChange={(dripSize) => setPrefs({ dripSize })} />
      <p className="meta">{book ? paceBlurb(book.id, snapshot.prefs.dripSize) : ""}</p>
      <div className="footer">
        <Button onClick={() => start()}>{startAtLabel(bookId, 1)}</Button>
        <button type="button" className="partway-link" onClick={() => setPicking(true)}>
          Already partway in? Set a starting chapter
        </button>
      </div>
      {picking ? (
        <StartingChapterSheet key={bookId} bookId={bookId} onClose={() => setPicking(false)} onConfirm={start} />
      ) : null}
    </section>
  );
}

function PlanStep() {
  const { snapshot, setPrefs, dispatch, today } = useApp();
  const size: DripSize = snapshot.prefs.dripSize;
  return (
    <section className="screen">
      <button type="button" className="back" onClick={() => setPrefs({ onboardingStep: "reading" })}>
        Back
      </button>
      <h1>Follow the reading you already have.</h1>
      <p className="lede">
        Each day you can type that day’s passage, or walk a simple placeholder list until your church’s schedule is ready.
        Mark stays saved as a backup.
      </p>
      <div className="footer">
        <Button
          onClick={() =>
            dispatch({
              type: "completeOnboarding",
              today,
              at: new Date().toISOString(),
              mode: "plan",
              bookId: "mark",
              dripSize: size,
              startChapter: 1,
              askTime: snapshot.prefs.askTime,
            })
          }
        >
          Use a plan
        </Button>
      </div>
    </section>
  );
}
