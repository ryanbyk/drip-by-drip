import { useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight } from "../components/Icons";
import { Avatar } from "../components/SocialBits";
import { BookPicker, Button, Sheet } from "../components/ui";
import { chapterCount, getBook } from "../domain/books";
import { localDate } from "../domain/dates";
import {
  MON_FRI,
  START_AT_DAY_ONE,
  WEEKDAY_MARKS,
  formatMonthDay,
  formatReadingDate,
  groupView,
  joinWhereCopy,
  paceChoice,
  pacePerDay,
  planBlurb,
  planDayLabel,
  planTitle,
  planTodayLine,
  readersLine,
  readingDaysFact,
  toggleWeekday,
  validPlanDraft,
  weekdayOn,
  type GroupPlanFollow,
  type StoredPlan,
} from "../domain/groupPlan";
import { formatRef } from "../domain/refs";
import { avatarTone, type GroupPlanSnapshot, type HomeMember } from "../domain/social";
import type { DripSize } from "../domain/types";
import { useApp } from "../state/AppState";

const PACES: DripSize[] = ["verses", "chapter", "two"];

export function GroupPlanCard({ plan, onOpen }: { plan: GroupPlanSnapshot; onOpen: () => void }) {
  const { today } = useApp();
  const view = groupView(plan, today);
  const width = `${Math.round(view.progress * 100)}%`;
  return (
    <section className="plan-card">
      <div className="plan-card-head">
        <p className="plan-kicker">Our plan</p>
        <span>{planDayLabel(view)}</span>
      </div>
      <h2>{planTitle(plan)}</h2>
      <div className="track" aria-hidden="true">
        <span style={{ width }} />
      </div>
      <div className="plan-card-today">
        <strong>{planTodayLine(view)}</strong>
        <button type="button" onClick={onOpen}>
          Plan details
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export function PlanSetup({
  initial,
  busy,
  error,
  onBack,
  onSave,
}: {
  initial: StoredPlan | null;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSave: (plan: StoredPlan) => void;
}) {
  const { today } = useApp();
  const [bookId, setBookId] = useState(initial?.bookId ?? "mark");
  const [ranged, setRanged] = useState(Boolean(initial && (initial.startChapter > 1 || initial.endChapter < chapterCount(initial.bookId))));
  const [startChapter, setStartChapter] = useState(initial?.startChapter ?? 1);
  const [endChapter, setEndChapter] = useState(initial?.endChapter ?? chapterCount(initial?.bookId ?? "mark"));
  const [pace, setPace] = useState<DripSize>(initial?.pace ?? "chapter");
  const [days, setDays] = useState(initial?.readingDays ?? MON_FRI);
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [booksOpen, setBooksOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const total = chapterCount(bookId);
  const bookName = getBook(bookId)?.name ?? "Book";

  function save() {
    const plan: StoredPlan = {
      bookId,
      startChapter: ranged ? startChapter : 1,
      endChapter: ranged ? endChapter : total,
      pace,
      readingDays: days,
      startDate,
    };
    const problem = validPlanDraft(plan);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    onSave(plan);
  }

  return (
    <section className="screen screen-tabbed social">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Reading plan</h1>
        <button type="button" className="social-nav-action" onClick={save} disabled={busy}>
          Save
        </button>
      </div>
      <header className="partner-head">
        <p className="partner-title">{initial ? "Replace the plan" : "Set a reading plan"}</p>
        <p>Everyone can join where the group is, or start at day 1. Replacing starts a new plan.</p>
      </header>
      <div className="social-form">
        <div className="social-field">
          <span>Book</span>
          <button type="button" className="social-box social-box-button" onClick={() => setBooksOpen(true)}>
            <strong>{bookName}</strong>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={ranged}
            onChange={(event) => {
              setRanged(event.target.checked);
              setStartChapter(1);
              setEndChapter(total);
            }}
          />
          A chapter range
        </label>
        {ranged ? (
          <div className="plan-range">
            <label className="social-field">
              <span>From</span>
              <span className="social-box">
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={startChapter}
                  onChange={(event) => setStartChapter(Number(event.target.value))}
                />
              </span>
            </label>
            <label className="social-field">
              <span>Through</span>
              <span className="social-box">
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={endChapter}
                  onChange={(event) => setEndChapter(Number(event.target.value))}
                />
              </span>
            </label>
          </div>
        ) : null}
        <div className="social-field">
          <span>Start date</span>
          <label className="social-box">
            <Calendar size={16} aria-hidden="true" />
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value || localDate())} />
          </label>
        </div>
      </div>
      <section className="settings-group">
        <p className="eyebrow">Pace</p>
        <div className="segmented" role="group" aria-label="Pace">
          {PACES.map((option) => (
            <button key={option} type="button" aria-pressed={pace === option} className={pace === option ? "is-on" : ""} onClick={() => setPace(option)}>
              {paceChoice(option)}
            </button>
          ))}
        </div>
        <p className="soft">This is the same drip size as a personal book: a few verses, one chapter, or two.</p>
      </section>
      <section className="settings-group">
        <p className="eyebrow">Reading days</p>
        <div className="weekdays" role="group" aria-label="Reading days">
          {WEEKDAY_MARKS.map((mark, index) => {
            const on = weekdayOn(days, index);
            return (
              <button key={`${mark}-${index}`} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => setDays((current) => toggleWeekday(current, index))}>
                {mark}
              </button>
            );
          })}
        </div>
        <p className="soft">Off days are grace days — nothing is “missed.”</p>
      </section>
      {formError || error ? (
        <p className="auth-error" role="alert">
          {formError || error}
        </p>
      ) : null}
      <div className="footer">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : initial ? "Replace plan" : "Save plan"}
        </Button>
      </div>
      {booksOpen ? (
        <Sheet title="Choose a book" onClose={() => setBooksOpen(false)}>
          <BookPicker
            selectedId={bookId}
            onSelect={(next) => {
              setBookId(next);
              setStartChapter(1);
              setEndChapter(chapterCount(next));
              setBooksOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </section>
  );
}

export function PlanDetail({
  groupName,
  leaderName,
  plan,
  members,
  owner,
  following,
  busy,
  error,
  onBack,
  onJoin,
  onLeave,
  onRead,
  onEdit,
  onEnd,
}: {
  groupName: string;
  leaderName: string;
  plan: GroupPlanSnapshot;
  members: HomeMember[];
  owner: boolean;
  following: GroupPlanFollow | null;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: (mode: "group" | "start") => void;
  onLeave: () => void;
  onRead: () => void;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const { today } = useApp();
  const view = groupView(plan, today);
  const [mode, setMode] = useState<"group" | "start">(following?.planId === plan.id ? following.mode : "group");
  const [all, setAll] = useState(false);
  const days = readingDaysFact(plan.readingDays);
  const followers = members.filter((member) => plan.followerIds.includes(member.id));
  const shown = all ? view.readings : view.readings.slice(0, 6);
  const onThis = following?.planId === plan.id;

  return (
    <section className="screen screen-tabbed social social-home">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Plan</h1>
        <span className="account-nav-end" />
      </div>
      <header className="partner-head social-head">
        <p className="partner-title">{planTitle(plan)}</p>
        <p>{`${groupName} · ${leaderName}`}</p>
        <p className="plan-blurb">{planBlurb(plan)}</p>
      </header>
      <div className="plan-facts">
        <span>
          <strong>{formatMonthDay(plan.startDate)}</strong>
          <span>start date</span>
        </span>
        <span>
          <strong>{pacePerDay(plan.pace)}</strong>
          <span>per day</span>
        </span>
        <span>
          <strong>{days.value}</strong>
          <span>{days.caption}</span>
        </span>
      </div>
      <section className="settings-group">
        <p className="eyebrow">How do you want to start?</p>
        <button type="button" className={mode === "group" ? "plan-option is-on" : "plan-option"} aria-pressed={mode === "group"} onClick={() => setMode("group")}>
          <span>
            <strong>Join where the group is</strong>
            {mode === "group" ? <Check size={16} aria-hidden="true" /> : null}
          </span>
          <span>{joinWhereCopy(view)}</span>
        </button>
        <button type="button" className={mode === "start" ? "plan-option is-on" : "plan-option"} aria-pressed={mode === "start"} onClick={() => setMode("start")}>
          <span>
            <strong>Start at Day 1</strong>
            {mode === "start" ? <Check size={16} aria-hidden="true" /> : null}
          </span>
          <span>{START_AT_DAY_ONE}</span>
        </button>
      </section>
      <section className="settings-group">
        <div className="plan-card-head">
          <p className="eyebrow">Readings</p>
          <span>{`${view.total} ${view.total === 1 ? "day" : "days"}`}</span>
        </div>
        <div className="settings-card plan-days">
          {shown.map((reading) => {
            const current = reading.date === today;
            return (
              <div key={reading.index} className={current ? "plan-day is-today" : "plan-day"}>
                <span>{reading.index}</span>
                <strong>{formatRef(reading.range)}</strong>
                <em>{formatReadingDate(reading.date, today)}</em>
              </div>
            );
          })}
          {!all && view.readings.length > shown.length ? (
            <button type="button" className="plan-more" onClick={() => setAll(true)}>
              {`Show all ${view.total} days`}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>
      {followers.length > 0 ? (
        <div className="plan-readers">
          <span className="avatar-stack">
            {followers.slice(0, 4).map((member, index) => (
              <Avatar key={member.id} name={member.displayName} tone={avatarTone(index, { self: member.self, owner: member.role === "owner" })} size={28} />
            ))}
          </span>
          <p>{readersLine(followers.length)}</p>
        </div>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="footer">
        {onThis && following?.mode === mode ? (
          <Button onClick={onRead}>Read today’s drip</Button>
        ) : (
          <Button onClick={() => onJoin(mode)} disabled={busy || view.status === "finished"}>
            {busy ? "Joining…" : "Join plan"}
          </Button>
        )}
        {onThis ? (
          <Button variant="text" onClick={onLeave} disabled={busy}>
            Leave this plan
          </Button>
        ) : null}
        {owner ? (
          <Button variant="text" onClick={onEdit} disabled={busy}>
            Replace plan
          </Button>
        ) : null}
        {owner ? (
          <Button variant="text" className="partner-unlink" onClick={onEnd} disabled={busy}>
            End plan
          </Button>
        ) : null}
      </div>
    </section>
  );
}
