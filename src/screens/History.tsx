import { useMemo, useState } from "react";
import { addDays, formatDayLabel, formatMonth, formatShortDay, monthGrid } from "../domain/dates";
import { describePastRead } from "../domain/pastRead";
import { currentStreak, longestStreak, markForDate, type DayMark } from "../domain/streaks";
import type { DailyCommitment } from "../domain/types";
import { useApp } from "../state/AppState";
import { ChevronLeft, ChevronRight, NotebookPen } from "../components/Icons";
import { OpenPassageLink } from "../components/OpenPassageLink";
import { Button, Sheet } from "../components/ui";
import { StopSheet } from "./today/MoreViews";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function History({ onOpenToday }: { onOpenToday: () => void }) {
  const { snapshot, today, online, dispatch } = useApp();
  const start = snapshot.prefs.planStartDate;
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const streak = currentStreak(snapshot.days, today, start);
  const longest = longestStreak(snapshot.days, today, start);
  const hasAny = Object.keys(snapshot.days).length > 0;
  const recent = recentDays(start, today, snapshot.days);
  const selectedDay = selected ? snapshot.days[selected] : undefined;
  const selectedMark = selected ? markForDate(selected, today, start, selectedDay) : null;
  const pastRead = selected ? describePastRead(snapshot, selected, today) : null;
  const passageRef = selectedDay?.passageRef ?? pastRead?.day.passageRef;

  function selectDay(iso: string) {
    setStopping(false);
    setSelected(iso);
  }

  function closeDay() {
    setStopping(false);
    setSelected(null);
  }

  function markRead(stop?: { chapter: number; verse: number }) {
    if (!selected) return;
    dispatch({ type: "markPastRead", date: selected, today, at: new Date().toISOString(), stop });
    closeDay();
  }

  return (
    <section className="screen screen-tabbed screen-gap-20">
      <header className="page-head">
        <h1>History</h1>
        <p>
          {streak} day streak · longest {longest}
        </p>
      </header>
      {!hasAny ? (
        <div className="history-empty">
          <p className="empty">Your days will gather here. Nothing is counted against you.</p>
          <Button variant="quiet" onClick={onOpenToday}>
            Go to Today
          </Button>
        </div>
      ) : null}
      <div className="cal-card">
      <div className="cal-head">
        <button type="button" onClick={() => setCursor(addDays(`${cursor.slice(0, 7)}-01`, -1))} aria-label="Previous month">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p>{formatMonth(cursor)}</p>
        <button
          type="button"
          onClick={() => setCursor(addMonth(cursor))}
          aria-label="Next month"
          disabled={cursor.slice(0, 7) >= today.slice(0, 7)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="cal-dow" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day.slice(0, 1)}</span>
        ))}
      </div>
      <div className="cal" role="grid" aria-label={formatMonth(cursor)}>
        {cells.map((cell) => {
          if (!cell.inMonth) return <span key={cell.iso} />;
          const mark = markForDate(cell.iso, today, start, snapshot.days[cell.iso]);
          const disabled = mark === "future" || mark === "before";
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              className={`cal-day mark-${mark}${cell.iso === today ? " is-today" : ""}`}
              aria-label={`${formatDayLabel(cell.iso)}, ${labelFor(mark)}`}
              onClick={() => {
                if (cell.iso === today) onOpenToday();
                else selectDay(cell.iso);
              }}
            >
              {Number(cell.iso.slice(8))}
            </button>
          );
        })}
      </div>
      </div>
      <ul className="legend is-spread">
        <li><i className="swatch mark-read" /> Read</li>
        <li><i className="swatch mark-yes" /> Yes</li>
        <li><i className="swatch mark-not_today" /> Not today</li>
        <li><i className="swatch mark-unanswered" /> Unanswered</li>
      </ul>
      {recent.length > 0 ? (
        <div className="recent">
          {recent.map((item) => (
            <button
              key={item.iso}
              type="button"
              className="recent-row"
              onClick={() => {
                if (item.mark === "today") onOpenToday();
                else selectDay(item.iso);
              }}
            >
              <span className="recent-main">
                <span>
                  <strong>{formatShortDay(item.iso)}</strong>
                  <em>{item.detail}</em>
                </span>
              </span>
              {item.huh ? <span className="huh-tag">Huh?</span> : null}
              {snapshot.days[item.iso]?.reflection || snapshot.days[item.iso]?.huh ? (
                <NotebookPen className="note-mark" size={16} aria-hidden="true" />
              ) : null}
              <span className={`pill mark-${item.mark}`}>{labelFor(item.mark)}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      {selected && selectedMark && !stopping ? (
        <Sheet title={formatDayLabel(selected)} onClose={closeDay}>
          <p className="meta">{labelFor(selectedMark)}</p>
          {passageRef ? <h2 className="sheet-ref">{passageRef}</h2> : null}
          {selectedDay?.prompt ? <p>{selectedDay.prompt}</p> : null}
          {selectedDay?.note ? <p className="soft">{selectedDay.note}</p> : null}
          {selectedDay?.reflection ? <p>{selectedDay.reflection}</p> : null}
          {selectedDay?.huh ? <p className="huh">Huh?</p> : null}
          {selectedMark === "not_today" ? <p>Rest day. The Word was still there.</p> : null}
          {selectedMark === "today" ? <p>Today is still open.</p> : null}
          {selectedMark === "unanswered" && !pastRead ? <p>No answer that day.</p> : null}
          {pastRead ? (
            <p className="soft">{markReadCopy(selected, today, selectedMark, pastRead.advance)}</p>
          ) : null}
          <div className="footer">
            {pastRead ? (
              <Button
                data-testid="history-mark-read"
                onClick={() => {
                  if (pastRead.advance && pastRead.range) setStopping(true);
                  else markRead();
                }}
              >
                I read it
              </Button>
            ) : null}
            {passageRef && online ? <OpenPassageLink reference={passageRef} className="btn btn-quiet" /> : null}
            <Button variant="text" onClick={closeDay}>
              Close
            </Button>
          </div>
        </Sheet>
      ) : null}
      {stopping && pastRead?.range ? (
        <StopSheet
          range={pastRead.range}
          lead="So the next drip picks up in the right place."
          nextLabel="Next drip"
          onClose={() => setStopping(false)}
          onFinish={markRead}
        />
      ) : null}
    </section>
  );
}

function markReadCopy(date: string, today: string, mark: DayMark, advance: boolean): string {
  const lead =
    mark === "yes"
      ? "If you finished this reading, mark it here."
      : date === addDays(today, -1)
        ? "If you read yesterday, mark it here."
        : "If you read, mark it here.";
  return advance ? `${lead} Today’s suggestion moves on with you.` : lead;
}

function labelFor(mark: DayMark): string {
  switch (mark) {
    case "read":
      return "Read";
    case "yes":
      return "Yes";
    case "not_today":
      return "Not today";
    case "unanswered":
      return "Unanswered";
    case "today":
      return "Today";
    case "future":
      return "Ahead";
    case "before":
      return "Before you started";
    default: {
      const exhaustive: never = mark;
      return exhaustive;
    }
  }
}

function addMonth(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(year || 1970, month || 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function recentDays(
  start: string,
  today: string,
  days: Record<string, DailyCommitment>,
): { iso: string; mark: DayMark; detail: string; huh: boolean }[] {
  if (!start) return [];
  const rows: { iso: string; mark: DayMark; detail: string; huh: boolean }[] = [];
  let cursor = today;
  while (cursor >= start && rows.length < 8) {
    const mark = markForDate(cursor, today, start, days[cursor]);
    if (mark !== "before" && mark !== "future") {
      const day = days[cursor];
      rows.push({ iso: cursor, mark, detail: detailFor(mark, day), huh: Boolean(day?.huh) });
    }
    cursor = addDays(cursor, -1);
  }
  return rows;
}

function detailFor(mark: DayMark, day: DailyCommitment | undefined): string {
  if (mark === "not_today") return "Rest day";
  if (mark === "today") return "Still open";
  if (mark === "unanswered") return "No answer";
  return day?.passageRef ?? "Reading";
}
