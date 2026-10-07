import { useEffect, useRef, useState } from "react";
import { getBook } from "../domain/books";
import { formatAskTime } from "../domain/dates";
import { activePlace } from "../domain/resolve";
import { isPlaceFinished } from "../domain/drip";
import { paceBlurb } from "../domain/suggestions";
import { bibleSourceLabel, normalizeBiblePrefs } from "../domain/bibleSource";
import { SOURCE_URL } from "../domain/types";
import {
  cancelDelayedTestReminder,
  DELAYED_TEST_DELAY_MS,
  isStandalone,
  notificationsSupported,
  requestNotificationPermission,
  scheduleDelayedTestReminder,
  sendTestAskNotification,
  type DelayedTestReminderResult,
  type TestReminderResult,
} from "../lib/reminders";
import { useApp } from "../state/AppState";
import {
  AlarmClock,
  ArrowUpRight,
  Bell,
  BookOpen,
  BookText,
  ChevronRight,
  Cloud,
  Droplet,
  ExternalLink,
  HeartHandshake,
  RotateCcw,
  WaterDrop,
} from "../components/Icons";
import { AppearanceField, AskTimePicker, Button, Sheet } from "../components/ui";
import { partnerSettingsValue } from "../domain/partner";
import { initialsFor, profileHeading } from "../lib/auth";
import { useAuth } from "../state/auth-context";
import { usePartner } from "../state/partner-context";
import { BibleSource } from "./BibleSource";
import { Account } from "./Account";
import { Partner } from "./Partner";
import { ChangeBookSheet } from "./today/MoreViews";

export function Settings({
  accountOpen = false,
  onAccountOpen = () => undefined,
  partnerOpen = false,
  onPartnerOpen = () => undefined,
  onSignIn = () => undefined,
}: {
  accountOpen?: boolean;
  onAccountOpen?: (open: boolean) => void;
  partnerOpen?: boolean;
  onPartnerOpen?: (open: boolean) => void;
  onSignIn?: () => void;
}) {
  const auth = useAuth();
  const readingPartner = usePartner();
  const app = useApp();
  const { snapshot, today, dispatch, setPrefs, showToast, canInstall, standalone, promptInstall } = app;
  const place = activePlace(snapshot);
  const book = getBook(snapshot.prefs.bookId);
  const finished = isPlaceFinished(place);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [editingBook, setEditingBook] = useState(false);
  const [editingSource, setEditingSource] = useState(false);
  const [about, setAbout] = useState(false);
  const [developerAction, setDeveloperAction] = useState<"now" | "later" | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [delayPending, setDelayPending] = useState(false);
  const developerActionRef = useRef<"now" | "later" | null>(null);
  const pendingHideRef = useRef<number | null>(null);
  const bible = normalizeBiblePrefs(snapshot.prefs);
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

  useEffect(
    () => () => {
      if (pendingHideRef.current !== null) window.clearTimeout(pendingHideRef.current);
    },
    [],
  );

  function markDelayPending() {
    setDelayPending(true);
    if (pendingHideRef.current !== null) window.clearTimeout(pendingHideRef.current);
    pendingHideRef.current = window.setTimeout(() => {
      pendingHideRef.current = null;
      setDelayPending(false);
    }, DELAYED_TEST_DELAY_MS);
  }

  function clearDelayPending() {
    if (pendingHideRef.current !== null) {
      window.clearTimeout(pendingHideRef.current);
      pendingHideRef.current = null;
    }
    setDelayPending(false);
  }

  async function runDeveloperAction(action: "now" | "later", work: () => Promise<void>) {
    if (developerActionRef.current) return;
    developerActionRef.current = action;
    setDeveloperAction(action);
    setTestNote(null);
    try {
      await work();
    } finally {
      developerActionRef.current = null;
      setDeveloperAction(null);
    }
  }

  async function sendTestReminder() {
    await runDeveloperAction("now", async () => {
      const result = await sendTestAskNotification();
      if (result === "sent") {
        showToast("Test reminder sent.");
        return;
      }
      setTestNote(testReminderNote(result));
    });
  }

  async function scheduleTestReminder() {
    await runDeveloperAction("later", async () => {
      const result = await scheduleDelayedTestReminder();
      if (result === "scheduled") {
        clearDelayPending();
        showToast("Scheduled — you’ll get it in about a minute.");
        return;
      }
      if (result === "fallback") {
        showToast("Scheduled — you’ll get it in about a minute.");
        markDelayPending();
        setTestNote(DELAYED_TIMER_NOTE);
        return;
      }
      setTestNote(delayedReminderNote(result));
    });
  }

  function cancelScheduledTest() {
    if (developerActionRef.current) return;
    cancelDelayedTestReminder();
    clearDelayPending();
    setTestNote("Canceled. That one-minute test won’t arrive.");
  }

  const placeLabel = finished
    ? `${book?.name ?? "Book"} · finished`
    : `${book?.name ?? "Book"} · ch. ${place.chapter}`;

  if (editingSource) return <BibleSource onBack={() => setEditingSource(false)} />;
  if (partnerOpen && auth.status === "signed-in") return <Partner onBack={() => onPartnerOpen(false)} />;
  if (accountOpen && auth.status === "signed-in") {
    return <Account onBack={() => onAccountOpen(false)} onOpenPartner={() => onPartnerOpen(true)} />;
  }

  const signedIn = auth.status === "signed-in" && auth.user ? auth.user : null;
  const partnerLabel = partnerSettingsValue({
    partnerName: readingPartner.partner?.displayName ?? null,
    inviteOpen: Boolean(readingPartner.invite),
  });

  return (
    <section className="screen screen-tabbed">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      {auth.status === "loading" ? null : (
        <button
          type="button"
          className="account-card"
          onClick={() => (signedIn ? onAccountOpen(true) : onSignIn())}
        >
          <span className="account-card-avatar" aria-hidden="true">
            {signedIn ? initialsFor(signedIn.displayName, signedIn.email) : <WaterDrop size={20} />}
          </span>
          <span className="account-card-copy">
            <span className="account-card-name">{signedIn ? profileHeading(signedIn.displayName, signedIn.email) : "Sign in"}</span>
            {signedIn && auth.syncEnabled ? (
              <span className="account-card-status">
                <Cloud size={14} aria-hidden="true" />
                Sync on
              </span>
            ) : (
              <span className="account-card-quiet">
                {signedIn ? "On this device" : "Optional · notes stay on this device"}
              </span>
            )}
          </span>
          <ChevronRight className="chev" size={16} aria-hidden="true" />
        </button>
      )}
      {signedIn ? (
        <section className="settings-group">
          <p className="eyebrow">Together</p>
          <div className="settings-card">
            <button type="button" className="settings-row" onClick={() => onPartnerOpen(true)}>
              <HeartHandshake className="row-icon" size={18} aria-hidden="true" />
              <span className="row-label">Reading partner</span>
              <strong className="row-value">{partnerLabel}</strong>
              <ChevronRight className="chev" size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="soft">One person. A gentle note. Never your answer or notes.</p>
        </section>
      ) : null}
      <section className="settings-group">
        <p className="eyebrow">Daily ask</p>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setEditingTime((open) => !open)}>
            <AlarmClock className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Ask time</span>
            <strong className="row-value">{formatAskTime(snapshot.prefs.askTime)}</strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
          <div className="settings-row">
            <Bell className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Notifications</span>
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
        </div>
        {editingTime ? (
          <AskTimePicker value={snapshot.prefs.askTime} onChange={(askTime) => setPrefs({ askTime })} />
        ) : null}
        <p className="soft">{reminderCopy(snapshot.prefs.notificationState, snapshot.prefs.notificationsEnabled, ios && !standalone)}</p>
      </section>
      <section className="settings-group">
        <p className="eyebrow">Developer</p>
        <div className="settings-card">
          <button
            type="button"
            className="settings-row"
            onClick={() => void sendTestReminder()}
            disabled={developerAction !== null}
          >
            <Bell className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">{developerAction === "now" ? "Sending test reminder…" : "Send test reminder"}</span>
          </button>
          <button
            type="button"
            className="settings-row"
            onClick={() => void (delayPending ? cancelScheduledTest() : scheduleTestReminder())}
            disabled={developerAction !== null}
          >
            <AlarmClock className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">{delayedTestLabel(developerAction, delayPending)}</span>
          </button>
        </div>
        <p className="soft">{testNote ?? DEVELOPER_REMINDER_NOTE}</p>
      </section>
      <section className="settings-group">
        <p className="eyebrow">Reading</p>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setEditingBook(true)}>
            <BookOpen className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">{snapshot.prefs.readingMode === "plan" ? "Plan, with backup" : "Reading through"}</span>
            <strong className="row-value">{snapshot.prefs.readingMode === "plan" ? `Placeholder · ${placeLabel}` : placeLabel}</strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
          <button type="button" className="settings-row" onClick={() => setEditingSource(true)}>
            <BookText className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Open passages in</span>
            <strong className="row-value">{bibleSourceLabel(bible.bibleSource)}</strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
          <AppearanceField value={snapshot.prefs.appearance} onChange={(appearance) => setPrefs({ appearance })} />
        </div>
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
        <p className="eyebrow">About</p>
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setAbout(true)}>
            <Droplet className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">About Drip by drip</span>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
          <a className="settings-row" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Sermon notes — Drip by drip</span>
            <ArrowUpRight className="chev" size={16} aria-hidden="true" />
          </a>
        </div>
      </section>
      <section className="settings-group">
        <p className="eyebrow">Progress</p>
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
        <div className="settings-card">
          <button type="button" className="settings-row is-danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Reset progress…</span>
          </button>
        </div>
        <p className="soft">
          {signedIn
            ? auth.syncEnabled
              ? "Synced with your account"
              : "Stored on this device"
            : "Stored only on this device · no account needed"}
        </p>
      </section>
      {editingBook ? <ChangeBookSheet when="track" onClose={() => setEditingBook(false)} /> : null}
      {about ? (
        <Sheet title="About Drip by drip" onClose={() => setAbout(false)}>
          <p>
            A small, steady practice of reading Scripture. Frequency is not your standing with God — Christ alone is.
          </p>
          <p className="soft">
            Open passage goes to {bibleSourceLabel(bible.bibleSource)}. Today’s passage can be read here in the ESV.
            This app keeps passage references and your own notes, not a Bible edition.
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

const DEVELOPER_REMINDER_NOTE =
  "Each sends the same daily question. Neither turns on your daily reminder, or marks today as reminded.";

const DELAYED_TIMER_NOTE =
  "This one uses a timer in the page. If you leave or the phone sleeps, it may not arrive — especially on iPhone. It’s most reliable in Chrome, or with the app left open.";

function delayedTestLabel(action: "now" | "later" | null, pending: boolean): string {
  if (action === "later") return "Scheduling the one-minute test…";
  if (pending) return "Cancel the one-minute test";
  return "Send test reminder in 1 minute";
}

function delayedReminderNote(result: Exclude<DelayedTestReminderResult, "scheduled" | "fallback">): string {
  switch (result) {
    case "unsupported":
      return "This browser can’t send reminders. The question will be here whenever you open the app.";
    case "denied":
      return "Reminders are blocked in this browser, so the one-minute test couldn’t be scheduled. Allow notifications for this site in your browser settings whenever you want to try again.";
    case "dismissed":
      return "The one-minute test waits until notifications are allowed. You can try again whenever you’re ready.";
    case "failed":
      return "The one-minute reminder couldn’t be scheduled just now. You can try again in a moment.";
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function testReminderNote(result: Exclude<TestReminderResult, "sent">): string {
  switch (result) {
    case "unsupported":
      return "This browser can’t send reminders. The question will be here whenever you open the app.";
    case "denied":
      return "Reminders are blocked in this browser, so the test couldn’t be sent. Allow notifications for this site in your browser settings whenever you want to try again.";
    case "dismissed":
      return "The test reminder waits until notifications are allowed. You can try again whenever you’re ready.";
    case "failed":
      return "The reminder couldn’t be sent just now. You can try again in a moment.";
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
