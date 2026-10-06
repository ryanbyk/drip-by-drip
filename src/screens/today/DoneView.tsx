import { useState } from "react";
import { getBook } from "../../domain/books";
import { addDays, formatClock } from "../../domain/dates";
import { activePlace } from "../../domain/resolve";
import { isPlaceFinished } from "../../domain/drip";
import { currentStreak, longestStreak, powerOfFour } from "../../domain/streaks";
import { suggestedNext } from "../../domain/suggestions";
import { useApp } from "../../state/AppState";
import { BookPicker, Button, Sheet } from "../../components/ui";

export function DoneView() {
  const app = useApp();
  const { snapshot, today, dispatch, share, canInstall, standalone, promptInstall, dismissInstall } = app;
  const day = snapshot.days[today];
  const streak = currentStreak(snapshot.days, today, snapshot.prefs.planStartDate);
  const longest = longestStreak(snapshot.days, today, snapshot.prefs.planStartDate);
  const week = powerOfFour(snapshot.days, today);
  const place = activePlace(snapshot);
  const finished = snapshot.prefs.readingMode === "book" && isPlaceFinished(place);
  const book = getBook(place.bookId);
  const [picking, setPicking] = useState(false);
  const [seen, setSeen] = useState(false);
  const tomorrow = addDays(today, 1);
  const queued = snapshot.prefs.queuedBookId ? getBook(snapshot.prefs.queuedBookId) : undefined;

  return (
    <div className="done">
      <div className="hero">
        <h1>Today’s drip, received.</h1>
        <p>
          {day?.passageRef ?? "Today’s reading"}
          {day?.readDoneAt ? ` · read at ${formatClock(day.readDoneAt)}` : ""}
        </p>
        {finished && book ? <p className="soft">You finished {book.name}.</p> : null}
      </div>
      <div className="stats" aria-label="A quiet look at your rhythm">
        <div>
          <strong>{streak}</strong>
          <span>day streak</span>
        </div>
        <div>
          <strong>{longest}</strong>
          <span>longest</span>
        </div>
        <div>
          <strong>
            {Math.min(week.engaged, week.goal)}/{week.goal}
          </strong>
          <span>this week</span>
        </div>
      </div>
      <p className="soft p4">
        {week.engaged >= week.goal
          ? "Power of Four reached — a good rhythm, not a requirement."
          : `${week.engaged} of ${week.goal} this week. A soft aim, not a requirement.`}
      </p>
      <NoteSummary />
      {finished && book ? (
        <div className="next-card">
          <p className="kicker">What’s next?</p>
          {queued ? <p>{queued.name} begins tomorrow.</p> : <p>Where would you like to go next?</p>}
          {suggestedNext(book.id).map((item) => {
            const next = getBook(item.id);
            if (!next) return null;
            return (
              <button
                key={item.id}
                type="button"
                className="choice"
                onClick={() => dispatch({ type: "queueBook", bookId: item.id, when: "tomorrow", today, tomorrow })}
              >
                <strong>{next.name}</strong>
                <span>{item.blurb}</span>
              </button>
            );
          })}
          <Button variant="text" onClick={() => setPicking(true)}>
            Choose another book
          </Button>
        </div>
      ) : null}
      {canInstall && !standalone ? (
        <div className="install-card">
          <p>Add Drip by drip to your home screen. It still lives only on this device.</p>
          <div className="row-actions">
            <Button onClick={() => void promptInstall()}>Add to Home Screen</Button>
            <Button variant="text" onClick={dismissInstall}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
      <div className="footer">
        <Button onClick={() => setSeen(true)} disabled={seen}>
          {seen ? "Saved on this device" : "Done"}
        </Button>
        <Button variant="quiet" onClick={() => void share(day?.passageRef)}>
          Share today’s drip
        </Button>
      </div>
      {picking ? (
        <Sheet title="Choose what’s next" onClose={() => setPicking(false)}>
          <BookPicker
            selectedId={snapshot.prefs.queuedBookId || book?.id || "john"}
            onSelect={(bookId) => {
              dispatch({ type: "queueBook", bookId, when: "tomorrow", today, tomorrow });
              setPicking(false);
            }}
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function NoteSummary() {
  const { snapshot, today, dispatch } = useApp();
  const day = snapshot.days[today];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(day?.reflection ?? "");
  const [huh, setHuh] = useState(Boolean(day?.huh));

  if (!editing) {
    return (
      <button type="button" className="reflect-row" onClick={() => setEditing(true)}>
        <strong>{day?.reflection ? "Your note" : "Add a note"}</strong>
        <span>{day?.reflection ?? "Huh? is welcome. A short note is optional."}</span>
        {day?.huh ? <span className="huh">Huh?</span> : null}
      </button>
    );
  }

  return (
    <div className="note-card note-edit">
      <label className="field">
        <span>Huh? or a short note — optional</span>
        <textarea
          value={text}
          maxLength={500}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          placeholder="Confusion is welcome. Keep going."
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={huh} onChange={(event) => setHuh(event.target.checked)} />
        Mark it “Huh?”
      </label>
      <Button
        onClick={() => {
          dispatch({ type: "reflection", today, reflection: text, huh });
          setEditing(false);
        }}
      >
        Save note
      </Button>
    </div>
  );
}
