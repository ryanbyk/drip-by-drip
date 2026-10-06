# PRD — Drip by drip (Bible reading consistency)

**For:** pen.dev design/build  
**Product:** Drip by drip — solo local-first PWA  
**Phase:** v1  
**Source:** [bible-reading-app-plan.md](./bible-reading-app-plan.md) · [sermon notes 2026-10-04](https://ryanbyk.github.io/crossway-milwaukee-sermon-notes/notes/drip-by-drift/2026-10-04/)  
**Do not invent sermon text.** Passage refs + optional short prompts only.

---

## 1. Goals

| Goal | Measure of success |
| --- | --- |
| Make the **question-behavior effect (QBE)** the daily spine | Every day starts with a persisted Yes / Not today answer—not the passage first |
| Support Scripture as a **grace-motivated keystone habit** | Copy never shames; standing with God ≠ streak length |
| Make follow-through easy after “Yes” | Passage → one-tap done in ≤2 taps after commit |
| Stay shippable as a thin PWA | Works offline for today’s ask + passage; no accounts required |

**Non-goals for v1:** social feed, partner sync, accounts, in-app Bible text, pastor CMS, seasons planner.

---

## 2. Users

| Persona | Need |
| --- | --- |
| **Primary — “I want to stick with it”** | Adult who intends to read Scripture regularly but drifts; wants a simple daily ask + clear next drip |
| **Secondary — church companion** | Same person after a series application talk; may later invite one accountability partner (**v1.5+**, not v1) |

Assumes one device, personal use. No login in v1.

---

## 3. Phasing

| Phase | Scope | Backend |
| --- | --- | --- |
| **v1 (this PRD)** | Solo QBE loop, local-first PWA, placeholder plan, streaks + soft Power of Four, reminders = ask, history, settings, optional DOG prayer, optional OS share-commitment | None (local storage) |
| **v1.5+** | One partner via invite; mutual view of today’s QBE answer + read-done only; grace-toned optional nudges | Accounts or link-token + minimal API |
| **v2 / later** | Small group, “reading now,” church admin, seasons | Explicit product ask |

**v1.5 note only:** Partner watches the same spine (answered? read done?) and must not replace the personal daily ask. Do not design partner UI in v1 screens.

---

## 4. Locked defaults (v1)

| Decision | Default |
| --- | --- |
| Platform | **Web / PWA** (mobile-first, installable) |
| QBE question copy | Locked: **“Will you read God’s word today?”** (no variants) |
| “Not today” | Allowed; **gentle grace** line; no guilt stack; streak rules stay soft (see §8) |
| Bible text | **Link out** to a public Bible site for the passage ref (no licensed in-app text) |
| Reading plan | **Placeholder** day-indexed plan until church supplies real schedule |
| Accounts | **None** in v1 |
| Partner / group | **Out of v1** (v1.5+) |

---

## 5. Tone & key copy

**Tone:** Grace, not guilt. Gospel clarity first—frequency does not determine standing with God; Christ alone does. Encourage thirst and follow-through. Confusion (“Huh?”) is normal; keep going.

| Moment | Copy (use or close paraphrase) |
| --- | --- |
| Daily ask | **Will you read God’s word today?** |
| Answers | **Yes** · **Not today** |
| After Yes (optional when/where) | Placeholder: “When / where will you read?” (one line, optional) |
| After Not today | Brief grace—e.g. “Rest in grace. The Word will still be here tomorrow.” (no lecture, no red “missed”) |
| Pre-read (optional DOG) | Short labels: **Discipline** · **Open ears** · **Gladness** (skippable) |
| Post-read optional | “Huh?” — confusion is ok; keep reading / seek God |
| Power of Four | Soft cue: aim for ≥4 days engaged this week (informational, not legalistic) |
| Share (optional) | e.g. “I said yes—I’m reading [passage] today.” via OS share sheet |
| Onboarding framing | One-line keystone + gospel-clarity; not a performance meter |

Reminders **are** the QBE question (not “Don’t forget to read!” guilt).

---

## 6. v1 scope

### In

- QBE daily question → Yes / Not today → persisted commitment  
- Today flow: ask → commit → (optional DOG) → passage → mark done  
- Flexible **placeholder** reading plan (day index, passage ref, optional title/prompt)  
- Mark read done; optional short note / “Huh?” flag  
- Current + longest streak; soft weekly Power of Four cue (≥4/7)  
- User-chosen **ask time** (available + alert); notification carries the QBE question where supported  
- Simple history (Yes / read / Not today / unanswered)  
- Onboarding (framing → ask time → Day 1)  
- Optional DOG prayer prompts (skippable)  
- Optional **Share today’s commitment** via OS share sheet (no social network)  
- Local-first persistence; offline for today’s commitment + cached plan day  
- Settings: ask time, reset progress, about / source link  

### Out

- Partner sync, group feeds, likes, leaderboards  
- Required accounts  
- Audio Bible, in-app licensed text  
- Forums, pastor CMS, season/special-date planner  
- Analytics product, church admin  
- Native App Store apps (unless later required for push)  

---

## 7. Screens & flows (design against these)

### Screen list

| # | Screen | Purpose | Primary action |
| --- | --- | --- | --- |
| A | **Onboarding — framing** | Keystone + gospel-clarity one-liner | Start |
| B | **Onboarding — ask time** | “When are you available *and* alert?” | Save (or skip → default) |
| C | **Today — Ask** | Show locked QBE question | Yes / Not today |
| D | **Today — Commit detail** (optional sheet) | Checkbox + optional when/where after Yes | Continue |
| E | **Today — DOG** (optional) | Discipline / Open ears / Gladness | Continue / Skip |
| F | **Today — Passage** | Day *n* ref, title?, prompt?; link out to Bible | Open passage · I read it |
| G | **Today — Done** | Confirm loop closed; streak / Power of Four secondary; optional share / Huh? | Done / Share |
| H | **Today — Not today** | Grace line only | Close / History |
| I | **History** | Calendar or list of days + answer / read state; reopen prompts | Open day |
| J | **Settings** | Ask time, notifications, reset, about | Save |

**One primary action per day:** answer the question, then read.

### User flows

```text
ONBOARD (first launch)
  A Framing → B Ask time → C Ask (Day 1)

DAILY — answered Yes
  Notification / open → C Ask → Yes
  → D Commit (optional when/where) → E DOG (optional)
  → F Passage (link out) → “I read it”
  → G Done (streak update; optional Huh? / Share)

DAILY — Not today
  C Ask → Not today → H Grace → end (no guilt stack)

MISSED ASK (day ended unanswered)
  Next open → C re-ask once (“Will you…?” again, not a lecture)
  History may show unanswered for that date

LATE / CATCH-UP (v1 default)
  Always offer “today’s drip” by calendar dayIndex of plan
  (Placeholder plan; no complex catch-up engine in v1)

SHARE (optional, after Yes or Done)
  OS share sheet with plain-text commitment line
```

### Layout notes for pen.dev

- **Ask before passage.** Home/Today must not lead with the reading.  
- Mobile-first; large Yes / Not today controls.  
- Streak and Power of Four are **secondary** on Done / Today—never louder than the ask.  
- No red “missed!” banners; soft, calm visual language.  
- Cards only where they aid interaction (e.g. commit checkbox); avoid dashboard clutter.  

---

## 8. Behavior rules

| Rule | Spec |
| --- | --- |
| Commitment persistence | Answer must be checkbox/tap persisted—not “in your head” only |
| Yes unlocks passage | Passage screen after Yes (or after optional DOG) |
| Not today + streak | **Gentle:** “Not today” does not trigger shame UI. Streak: break current streak on Not today / no read-done by end of local day; longest streak preserved. Soft Power of Four still counts only **engaged** days (Yes + read done). |
| Unanswered | Soft re-ask next open; history shows unanswered |
| Power of Four | Show engaged days this week toward 4; informational |
| Notifications | Payload/body = QBE question; tap → Ask screen |
| Offline | Can answer QBE and mark done; passage link needs network when opening external Bible |
| Reset | Settings can clear local commitments / restart Day 1 (confirm) |

---

## 9. Data model sketch

```text
Plan
  id, title, description?, toneTag? ("drip-by-drip")

Day
  dayIndex (1..N)
  passageRef     e.g. "John 15:1–8"
  title?         e.g. "Abide"
  prompt?        short reflection (not sermon text)
  sermonWeek?    optional series week link when known
  bibleUrl?      outbound link for passage (or derived)

DailyCommitment
  date           YYYY-MM-DD (local)
  answer         yes | not_today | unanswered
  answeredAt?
  note?          optional when/where
  readDone       boolean
  readDoneAt?
  huh?           optional flag / short note
  dayIndex       plan day used that date

UserPrefs
  askTime        local time
  notificationsEnabled
  onboardingComplete
  planId
  createdAt
```

**Storage:** IndexedDB or localStorage. No server in v1.  
**Content:** Placeholder plan bundled in app; replace later when church supplies schedule. **No proprietary sermon manuscripts.**

---

## 10. Success criteria (v1)

1. First-time user completes onboarding and answers Day 1 QBE in under ~2 minutes.  
2. Returning user: open → ask → Yes → passage → done without dead ends.  
3. “Not today” never shows shame/guilt stack; grace line only.  
4. Commitment + readDone survive refresh / relaunch (local persistence).  
5. Installable PWA; ask-time reminder works where the browser/OS allows.  
6. History accurately reflects Yes / Not today / read / unanswered.  
7. Share sheet (if used) produces a plain-text commitment line with passage ref.  
8. No account wall; no partner UI shipped.

---

## 11. Open items (do not block pen.dev v1 UI)

These wait on church / product owner; design with placeholders:

- Real day-by-day passage schedule  
- Exact outbound Bible site / URL pattern  
- Default ask time if user skips  
- Final grace one-liner for Not today (tone locked; wording flexible)  
- Whether “Huh?” is a toggle, note field, or both  

Partner visibility, nudges, and group size → **v1.5+ PRD**, not this file.

---

*Grounded in CrossWay *Drip by Drip* application notes (2026-10-04) QBE framing and the project plan. Placeholder plan content only until the church supplies the reading schedule.*
