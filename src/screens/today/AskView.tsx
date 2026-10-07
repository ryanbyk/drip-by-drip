import { diffDays, formatDayLabel, startOfWeek, addDays } from "../../domain/dates";
import { isEngaged, powerOfFour, showSoftReask } from "../../domain/streaks";
import { QBE_QUESTION } from "../../domain/types";
import { useApp } from "../../state/AppState";
import { WaterDrop } from "../../components/Icons";
import { Button } from "../../components/ui";

export function AskView({ onYes, onNotToday }: { onYes: () => void; onNotToday: () => void }) {
  const { snapshot, today } = useApp();
  const week = powerOfFour(snapshot.days, today);
  const reask = showSoftReask(snapshot.days, today, snapshot.prefs.planStartDate);
  const dayNumber = snapshot.prefs.planStartDate ? diffDays(snapshot.prefs.planStartDate, today) + 1 : 1;
  const weekStart = startOfWeek(today);

  return (
    <div className="ask">
      <header className="ask-head">
        <p>{formatDayLabel(today)}</p>
        <p className="day-pill">
          <WaterDrop size={14} />
          Day {dayNumber}
        </p>
      </header>
      <div className="ask-question">
        <p className="kicker">Today’s question</p>
        <h1 className="display-48">{QBE_QUESTION}</h1>
        {reask ? (
          <p className="ask-hint">Yesterday went by without an answer. If you read, you can mark it in History.</p>
        ) : (
          <p className="ask-hint">Just a yes or a not today. Your answer is saved.</p>
        )}
      </div>
      <div className="answers">
        <Button className="btn-yes" data-testid="qbe-yes" onClick={onYes}>
          Yes
        </Button>
        <Button data-testid="qbe-not-today" variant="quiet" onClick={onNotToday}>
          Not today
        </Button>
      </div>
      <p className="week-cue">
        <span className="week-dots" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => {
            const iso = addDays(weekStart, index);
            const kind = isEngaged(snapshot.days[iso]) ? "engaged" : iso === today ? "today" : iso > today ? "future" : "open";
            return <i key={iso} className={`week-dot is-${kind}`} />;
          })}
        </span>
        {week.engaged} of {week.goal} this week
      </p>
    </div>
  );
}
