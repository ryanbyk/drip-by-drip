# Drip by drip — Bible reading consistency app

## Purpose

Help someone stick with Scripture **drip by drip**—steady engagement as a grace-motivated keystone habit, not a guilt meter. Standing with God is by Christ’s work alone; the app supports thirst and follow-through after that clarity.

Grounded in CrossWay’s *Drip by Drip* application notes ([2026-10-04](https://ryanbyk.github.io/crossway-milwaukee-sermon-notes/notes/drip-by-drift/2026-10-04/)): the **question-behavior effect (QBE)** is the primary habit mechanic.

## Core habit mechanic: Question-behavior effect

The notes’ **Question Power-Up**: a simple daily ask—“**Will you read God’s word today?**”—tends to increase follow-through (question-behavior effect). Why it works (as framed there): dissonance around “no” / commitment after “yes”; decisive **“will you”** ownership (not “can you / would you”); visualizing the action. Delivery must require a **written or checkbox answer**, not only a thought.

### How QBE shows up in the app

| Moment | Behavior |
| --- | --- |
| **Daily ask (before reading)** | Notification / home screen opens with the yes/no question—not the passage first. |
| **Commit** | User taps **Yes** (or **Not today**). Yes is a decisive commitment, then the passage unlocks. |
| **Checkbox / written answer** | Commitment is persisted (checkbox + optional one-line “when/where”). Mirrors “not only in your head.” |
| **Read → done** | After Yes: show today’s passage → **I read it**. Completing closes the QBE loop for the day. |
| **Not today** | Allowed without shaming copy. Streak rules stay gentle; gospel-clarity tone. |
| **Missed ask** | If the day ends with no answer, next open can re-ask once (still “will you,” not a lecture). |

QBE is the spine of Today and reminders. Streaks and the reading plan support it; they do not replace it.

## MVP (v1)

| Feature | What it does |
| --- | --- |
| **QBE daily question** | “Will you read God’s word today?” → Yes / Not today; stored commitment. |
| **Flexible reading plan** | Day-indexed entries (passage ref + optional short prompt). Placeholder plan until church schedule exists. |
| **Mark today done** | One-tap after reading; optional short note or “Huh?” flag. |
| **Streaks + Power of Four cue** | Current / longest streak. Soft weekly cue toward ≥4 days engaged (informational, not legalistic). |
| **Reminders = ask time** | User picks an **available + alert** slot; notification *is* the QBE question. |
| **Today screen** | Ask → commit → passage → done; streak as secondary. |
| **Simple history** | Days with Yes / read / skipped; reopen prompts. |
| **Onboarding** | One-line keystone + gospel-clarity framing; set ask time; start Day 1. |
| **Optional: DOG prayer** | Short pre-read prompts: Discipline / Open ears / Gladness (skippable). |

**Out of v1 (full product):** partner sync dashboards, group feeds, accounts as a requirement, audio Bible, forums, pastor CMS, season/special-date planner, analytics.

**Tiny v1 hook (solo-compatible, no accounts):** optional **“Share today’s commitment”** — after Yes (or after read-done), copy/share a plain text line via the OS share sheet (e.g. “I said yes—I’m reading [passage] today”). Not a social network; user chooses the channel (text, iMessage, etc.). Call this free because it needs no backend.

### Reading-plan model (placeholder-friendly)

```text
Plan
  id, title, description?, toneTag? ("drip-by-drip")
Day
  dayIndex (1..N)
  passageRef   e.g. "John 15:1–8"
  title?       e.g. "Abide"
  prompt?      short reflection question (not sermon text)
  sermonWeek?  optional link to series week when known

DailyCommitment (QBE)
  date
  answer       yes | not_today | unanswered
  answeredAt?
  note?        optional "when/where" line
  readDone     boolean
  huh?         optional flag / note after reading
```

No proprietary sermon manuscripts in v1—only passage references and optional short prompts the church supplies later.

## Suggested UX flow

1. **Land** → keystone + grace framing (frequency ≠ standing with God) → Start  
2. **Set ask time** → “When are you available *and* alert?” (skippable default)  
3. **Daily open / notification** → **Will you read God’s word today?** → Yes / Not today  
4. **If Yes** → optional DOG prayer → Day *n* passage → Mark complete (optional “Huh?—keep going”) → streak / week cue updates  
5. **If Not today** → brief grace line; no guilt stack  
6. **Missed days** → soft re-ask or “read today’s drip” (decide in open Qs)  
7. **History** → commitments + completed readings  
8. **Settings** → ask time, reset, about  

Mobile-first; **one primary action**: answer the question, then read.

## Partner / accountability (and light “group sessions”)

Goal: someone to hold you accountable—**not** a social feed. Align with gospel-clarity: encourage, don’t shame; “Not today” stays private or softened by design (see open Qs).

### Lightweight shape (what “good” looks like)

| Idea | Lightweight version | Avoid |
| --- | --- | --- |
| **1:1 partner** | Invite one person; each sees whether the other **answered the QBE ask** and/or **marked reading done** today | Activity feeds, likes, public streaks leaderboard |
| **Light group** | Same status tiles for a small set (e.g. 2–6), optional shared plan day label | Chat rooms, posts, sermon discussion threads |
| **“Read with a partner” session** | Optional same-time window: both committed Yes; simple “I’m reading now” presence—or just matched day + check-in status | Live video/co-reading product in early phases |
| **Privacy tone** | Default: partner sees **Yes / done / not answered yet**—not notes, “Huh?” text, or streak length unless opted in | Guilt pings, red “missed!” banners to the partner |

### How it interacts with QBE

- Accountability watches the **same spine**: Did they answer “Will you…?” and did they complete the read?
- Partner does **not** replace the personal ask; each person still gets their own daily QBE.
- Nudges from a partner (if any) should be optional and grace-toned—e.g. “Praying you get a drip in today”—never automatic shame when someone taps Not today.
- Share-commitment (v1 hook) is a **manual** outward signal of the Yes; synced partner status (later) is the **ambient** signal.

### Phasing recommendation

| Phase | Scope | Needs |
| --- | --- | --- |
| **v1** | Solo QBE, local-first. Optional OS **share my commitment** text after Yes/done. | No accounts |
| **v1.5** (smallest useful accountability) | **One partner** via invite link; mutual view of today’s QBE answer + read-done only. Email/magic-link or lightweight account. | Accounts or link-token pairs + minimal backend |
| **v2** | Small group (few partners), optional “reading now,” soft weekly Power-of-Four for the pair/group, leave/mute controls. | Same + group membership |
| **Later** | Church small-group admin, seasons, richer session tools. | Explicit product ask |

**Do not** expand v1 into full social. The only free solo hook worth shipping early is share-via-OS-text.

## Tech approach

**Recommend: modern web app as PWA** (e.g. Next.js or Vite + React).

| Why PWA | Notes |
| --- | --- |
| Ship fast | One codebase; installable on phone home screen |
| Offline-friendly | Cache today’s reading + QBE commitment locally |
| Reminders | Notification carries the QBE question where supported |
| Low friction | No App Store gate for first iteration |

**Local-first storage** (IndexedDB / localStorage) for v1. **Accounts / invite links** only when shipping partner status (v1.5+).

Native apps only if App Store presence or richer push is required later—not for MVP.

## Open questions (need user input)

1. **Content source** — Who provides the day-by-day schedule? When will passage refs be available?  
2. **Plan structure** — Fixed length? Catch-up vs. always “today’s drip”?  
3. **Platforms** — Web/PWA only, or store listings / church-site embed?  
4. **QBE copy** — Exact question locked to “Will you read God’s word today?” or allow variants (still “will you…”)?  
5. **Not today vs. streak** — Does “Not today” break the streak immediately, or use a grace window?  
6. **Power of Four UI** — Show a weekly 4/7 cue in v1, or keep streaks only until tone is validated?  
7. **Account model** — Device-only OK for v1; when is sync/accounts required?  
8. **Bible text** — Link out vs. licensed in-app text?  
9. **Seasons / special dates** — Needed in v1, or explicitly post-MVP?  
10. **Partner count** — Strict 1:1 first, or small group (how many) from the start of accountability?  
11. **Visibility** — Partner sees Yes/done only, or also Not today, streaks, notes? Opt-in vs default?  
12. **Church small-group vs 1:1** — Is the primary ask a friend pair, or existing CG / discipleship pairs?  
13. **Partner nudges** — Silent status only, or allow optional check-in messages / reminders?  
14. **Share hook in v1** — Want the OS “share my commitment” text in v1, or skip until v1.5 invite links?

---

*Placeholder plan content only until the church supplies the real reading schedule. QBE and related habits grounded in the 2026-10-04 notes page—not invented sermon text.*
