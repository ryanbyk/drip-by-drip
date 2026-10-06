import { useState } from "react";
import { getBook } from "../domain/books";
import { formatAskTime } from "../domain/dates";
import { activePlace } from "../domain/resolve";
import { isPlaceFinished } from "../domain/drip";
import { paceBlurb } from "../domain/suggestions";
import { SOURCE_URL } from "../domain/types";
import { isStandalone, notificationsSupported, requestNotificationPermission } from "../lib/reminders";
import { useApp } from "../state/AppState";
import { AskTimePicker, Button, Sheet } from "../components/ui";
import { ChangeBookSheet } from "./today/MoreViews";

export function Settings() {
  const app = useApp();
  const { snapshot, today, dispatch, setPrefs, canInstall, standalone, promptInstall } = app;
  const place = activePlace(snapshot);
  const book = getBook(snapshot.prefs.bookId);
  const finished = isPlaceFinished(place);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [editingBook, setEditingBook] = useState(false);
  const [about, setAbout] = useState(false);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function enableReminders() {
    const result = await requestNotificationPermission();
    if (result === "granted") {
      setPrefs({ notificationsEnabled: true, notificationState: "granted" });
      return;
    }
    if (result === "unsupported") {
      setPrefs({ notificationsEnabled: false, notificationState: "unsupported" });
      return;
    }
    setPrefs({ notificationsEnabled: false, notificationState: "denied" });
  }

  const placeLabel = finished
    ? `${book?.name ?? "Book"} · finished`
    : `${book?.name ?? "Book"} · ch. ${place.chapter}`;

  return (
    <section className="screen screen-tabbed">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <section className="settings-group">
        <p className="kicker">Daily ask</p>
        <button type="button" className="settings-row" onClick={() => setEditingTime((open) => !open)}>
          <span>Ask time</span>
          <strong>{formatAskTime(snapshot.prefs.askTime)}</strong>
        </button>
        {editingTime ? (
          <AskTimePicker value={snapshot.prefs.askTime} onChange={(askTime) => setPrefs({ askTime })} />
        ) : null}
        <div className="settings-block">
          <div className="settings-row">
            <span>Notifications</span>
            <button
              type="button"
              className={snapshot.prefs.notificationsEnabled ? "switch is-on" : "switch"}
              role="switch"
              aria-checked={snapshot.prefs.notificationsEnabled}
              onClick={() => {
                if (snapshot.prefs.notificationsEnabled) setPrefs({ notificationsEnabled: false });
                else void enableReminders();
              }}
            >
              <span />
            </button>
          </div>
          <p className="soft">{reminderCopy(snapshot.prefs.notificationState, snapshot.prefs.notificationsEnabled, ios && !standalone)}</p>
        </div>
      </section>
      <section className="settings-group">
        <p className="kicker">What you’re reading</p>
        <button type="button" className="settings-row" onClick={() => setEditingBook(true)}>
          <span>{snapshot.prefs.readingMode === "plan" ? "Plan, with backup" : "Reading through"}</span>
          <strong>{snapshot.prefs.readingMode === "plan" ? `Placeholder · ${placeLabel}` : placeLabel}</strong>
        </button>
        <p className="soft">{paceBlurb(snapshot.prefs.bookId, snapshot.prefs.dripSize)}</p>
        {snapshot.prefs.readingMode === "book" ? (
          <Button variant="text" onClick={() => dispatch({ type: "reading", today, mode: "plan" })}>
            I already follow a plan
          </Button>
        ) : (
          <Button variant="text" onClick={() => dispatch({ type: "reading", today, mode: "book" })}>
            Continue in {book?.name ?? "Mark"}
          </Button>
        )}
      </section>
      <section className="settings-group">
        <p className="kicker">About</p>
        <button type="button" className="settings-row" onClick={() => setAbout(true)}>
          <span>About Drip by drip</span>
        </button>
        <a className="settings-row" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
          <span>Sermon notes — Drip by drip</span>
        </a>
      </section>
      <section className="settings-group">
        <p className="kicker">Progress</p>
        {!standalone && !isStandalone() ? (
          <div className="settings-block">
            <p>Add this app to your home screen to open it like any other.</p>
            {canInstall ? (
              <Button onClick={() => void promptInstall()}>Add to Home Screen</Button>
            ) : (
              <p className="soft">
                {ios
                  ? "On iPhone, tap Share, then Add to Home Screen."
                  : "If your browser offers it, use the install icon in the address bar."}
              </p>
            )}
          </div>
        ) : null}
        <button type="button" className="settings-row" onClick={() => setConfirmReset(true)}>
          <span>Reset progress…</span>
        </button>
        <p className="soft">Stored only on this device · no account needed</p>
      </section>
      {editingBook ? <ChangeBookSheet when="track" onClose={() => setEditingBook(false)} /> : null}
      {about ? (
        <Sheet title="About Drip by drip" onClose={() => setAbout(false)}>
          <p>
            A small, steady practice of reading Scripture. Frequency is not your standing with God — Christ alone is.
          </p>
          <p className="soft">
            Bible text opens on Bible Gateway. This app keeps passage references and your own notes, not a Bible edition.
          </p>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            Source notes
          </a>
        </Sheet>
      ) : null}
      {confirmReset ? (
        <Sheet title="Reset progress?" onClose={() => setConfirmReset(false)}>
          <p>
            This clears your answers, streaks, and notes on this device, and starts you again at the beginning of{" "}
            {book?.name ?? "your book"}. Your ask time stays.
          </p>
          <div className="footer">
            <Button
              onClick={() => {
                dispatch({ type: "reset", today });
                setConfirmReset(false);
              }}
            >
              Reset progress
            </Button>
            <Button variant="quiet" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function reminderCopy(
  state: "unknown" | "granted" | "denied" | "dismissed" | "unsupported",
  enabled: boolean,
  iosBrowser: boolean,
): string {
  if (!notificationsSupported() || state === "unsupported") {
    return "This browser can’t send reminders. The question will be here whenever you open the app.";
  }
  if (state === "denied") {
    return "Reminders are blocked in this browser. Allow notifications for this site in your browser settings, then turn them on here. We won’t keep asking.";
  }
  if (iosBrowser) {
    return "On iPhone, reminders work after you add Drip by drip to your Home Screen. The notification is only the daily question.";
  }
  if (enabled) {
    return "At your ask time, the reminder is the question itself. If the app is fully closed, your browser may only deliver it after you’ve opened Drip by drip at least once.";
  }
  return "Turn this on for one daily reminder. It asks the question — it doesn’t scold.";
}
