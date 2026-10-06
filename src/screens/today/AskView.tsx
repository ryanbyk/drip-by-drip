import { getBook } from "../../domain/books";
import { diffDays, formatAskTime, formatDayLabel } from "../../domain/dates";
import { powerOfFour, showSoftReask } from "../../domain/streaks";
import { QBE_QUESTION } from "../../domain/types";
import { useApp } from "../../state/AppState";
import { Button } from "../../components/ui";

export function AskView({ onYes, onNotToday }: { onYes: () => void; onNotToday: () => void }) {
  const { snapshot, today } = useApp();
  const week = powerOfFour(snapshot.days, today);
  const reask = showSoftReask(snapshot.days, today, snapshot.prefs.planStartDate);
  const side =
    snapshot.prefs.readingMode === "plan" && snapshot.prefs.planStartDate
      ? `Day ${diffDays(snapshot.prefs.planStartDate, today) + 1}`
      : getBook(snapshot.prefs.bookId)?.name;

  return (
    <div className="ask">
      <header className="ask-head">
        <p>{formatDayLabel(today)}</p>
        {side ? <p>{side}</p> : null}
      </header>
      <div className="ask-question">
        <p className="kicker">Today’s question</p>
        <h1>{QBE_QUESTION}</h1>
        {reask ? (
          <p className="soft">Yesterday went by without an answer. No catching up — just today’s question.</p>
        ) : (
          <p className="soft">Just a yes or a not today. Your answer is saved.</p>
        )}
      </div>
      <div className="answers">
        <Button data-testid="qbe-yes" onClick={onYes}>
          Yes
        </Button>
        <Button data-testid="qbe-not-today" variant="quiet" onClick={onNotToday}>
          Not today
        </Button>
        <p className="week-cue">
          {week.engaged} of {week.goal} this week
          <span> · ask at {formatAskTime(snapshot.prefs.askTime)}</span>
        </p>
      </div>
    </div>
  );
}
