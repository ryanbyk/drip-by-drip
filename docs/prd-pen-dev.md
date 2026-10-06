# PRD — Drip by drip (Bible reading consistency)

**For:** pen.dev design/build  
**Product:** Drip by drip — solo local-first PWA  
**Phase:** v1  
**Design file:** [drip-by-drip.pen](../drip-by-drip.pen) (screens A–Z, design tokens, dark examples)  
**Source:** [bible-reading-app-plan.md](./bible-reading-app-plan.md) · [sermon notes 2026-10-04](https://ryanbyk.github.io/crossway-milwaukee-sermon-notes/notes/drip-by-drift/2026-10-04/)  
**Do not invent sermon text.** Passage refs + optional short prompts only.

---

## Changelog

| Rev | Change |
| --- | --- |
| **r2** | Replaced placeholder day-indexed plan with **reading tracks** (one book + bookmark, plus one-day "something else" detours). Church plan → **v1.5**. Added book / chapter pickers (incl. long-book sections), adjust-passage, "where did you stop?", welcome-back and back-after-detour states, book finished + recap, **Reflect** notes (Huh? folded in), **Bible source** setting (YouVersion default) with optional **in-app ESV text** via user API key, and **light / dark / system** appearance with themed design tokens. Resolved Bible URL + Huh? open items. |
| r1 | Initial v1 PRD: QBE loop, placeholder plan, streaks, Power of Four, history, settings, DOG, share. |

---

## 1. Goals

| Goal | Measure of success |
| --- | --- |
| Make the **question-behavior effect (QBE)** the daily spine | Every day starts with a persisted Yes / Not today answer—not the passage first |
| Support Scripture as a **grace-motivated keystone habit** | Copy never shames; standing with God ≠ streak length |
| Make follow-through easy after “Yes” | Passage → one-tap done in ≤2 taps after commit |
| Always know **what to read next** | After Yes, a suggested passage (book bookmark) is ready; editable or swappable in one tap |
| Stay shippable as a thin PWA | Works offline for today’s ask + suggestion; no accounts required |

**Non-goals for v1:** social feed, partner sync, accounts, church reading plan, pastor CMS, seasons planner, bundled Bible edition.

---

## 2. Users

| Persona | Need |
| --- | --- |
| **Primary — “I want to stick with it”** | Adult who intends to read Scripture regularly but drifts; wants a simple daily ask + clear next drip |
| **Plan follower** | Already follows another plan (church bulletin, other app); wants the daily ask + a fast way to log “something else” without losing a backup book |
| **Secondary — church companion** | Same person after a series application talk; may later invite one accountability partner (**v1.5+**, not v1) |

Assumes one device, personal use. No login in v1.

---

## 3. Phasing

| Phase | Scope | Backend |
| --- | --- | --- |
| **v1 (this PRD)** | Solo QBE loop, **reading track (book + bookmark) with detours**, streaks + soft Power of Four, reminders = ask, history, reflect notes, book recap, settings (Bible source, appearance), optional DOG prayer, optional OS share, optional in-app ESV text (user key) | None (local storage) |
| **v1.5+** | **Church reading plan** as a track type; one partner via invite (mutual view of today’s QBE answer + read-done only); grace-toned optional nudges | Plan content feed; accounts or link-token + minimal API |
| **v2 / later** | Small group, “reading now,” church admin, seasons | Explicit product ask |

**v1.5 note only:** Partner watches the same spine (answered? read done?) and must not replace the personal daily ask. Do not design partner UI in v1 screens.

---

## 4. Locked defaults (v1)

| Decision | Default |
| --- | --- |
| Platform | **Web / PWA** (mobile-first, installable) |
| QBE question copy | Locked: **“Will you read God’s word today?”** (no variants) |
| “Not today” | Allowed; **gentle grace** line; no guilt stack; streak rules stay soft (see §8) |
| What to read | Onboarding **always suggests a book (Mark)**; user may pick another book or choose “I already follow a plan” (Mark stays as backup) |
| Reading track | **One book + bookmark** at a time; “Something else” = one-day detour |
| Daily drip size | **1 chapter** (options: a few verses · 1 chapter · 2 chapters) |
| Bible text | **Link out** to the chosen source — **YouVersion** by default (app, fallback bible.com); Bible Gateway, ESV.org, or custom URL template |
| In-app text | **Optional**: ESV text inside the app when the user supplies their own ESV API key |
| Translation | ESV (user-changeable for link-out sources) |
| Appearance | **System** (Light / Dark selectable) |
| Accounts | **None** in v1 |
| Church plan · Partner / group | **Out of v1** (v1.5+) |

---

## 5. Tone & key copy

**Tone:** Grace, not guilt. Gospel clarity first—frequency does not determine standing with God; Christ alone does. Encourage thirst and follow-through. Confusion (“Huh?”) is normal; keep going.

| Moment | Copy (use or close paraphrase) |
| --- | --- |
| Daily ask | **Will you read God’s word today?** |
| Answers | **Yes** · **Not today** |
| After Yes (optional when/where) | “When / where will you read?” (one line, optional) |
| After Not today | “Rest in grace. The Word will still be here tomorrow.” (no lecture, no red “missed”) |
| Onboarding framing | One-line keystone + gospel-clarity; “This isn’t a performance meter.” |
| Onboarding — what to read | “Start with a book. We suggest Mark.” |
| Pre-read (optional DOG) | **Discipline** · **Open ears** · **Gladness** (skippable) |
| Suggestion | “Pick up where you left off” |
| Back after a detour | “Back to Mark — yesterday you read Psalm 23, your place was saved.” |
| Gap (3+ days) | “Good to see you. No catching up required — Mark will wait.” |
| Detour reassurance | “Detours never move your place in [book].” |
| After reading | “Where did you stop?” — “So tomorrow picks up in the right place.” |
| Huh? | “Something confusing? Mark it ‘Huh?’ — easy to revisit later.” |
| Power of Four | “Power of Four reached — a good rhythm, not a requirement.” |
| Book finished | “You finished [book]. 16 chapters, one drip at a time.” |
| Recap footer | “Not a score — just a look back at the drips. Every one was grace.” |
| Share (optional) | “I said yes—I’m reading [passage] today.” via OS share sheet |

Reminders **are** the QBE question (not “Don’t forget to read!” guilt).

---

## 6. v1 scope

### In

- QBE daily question → Yes / Not today → persisted commitment  
- Today flow: ask → commit → (optional DOG) → passage → (optional reflect) → I read it → where did you stop → done  
- **Reading track:** pick a book (suggested starters + search all 66), daily drip size, optional **start partway** via chapter grid  
- **Passage suggestion** from bookmark; **adjust verses** (book / from / to / quick ranges / type a ref); **change book**  
- **Something else** (detour): type one or more refs (e.g. `Luke 10:38–42; Psalm 46`), today’s short drips (Proverb of the day, next Psalm), recent entries  
- **Where did you stop?** — read all (default) or pick last verse; advances bookmark  
- **Reflect** notes while reading: optional prompts, free text, verse tags, Huh? toggle; autosaved on device  
- **Book finished** → **Recap** (chapters grid, reading days, longest streak, Power of Four weeks, usual time, reflections, detours, Huh? moments, rest days) → choose next book  
- Current + longest streak; soft weekly Power of Four cue (≥4/7)  
- User-chosen **ask time**; notification carries the QBE question where supported  
- History (calendar + recent list): read / yes / not today / unanswered, note + Huh? markers  
- Onboarding: framing → ask time → what to read (→ pick book → starting chapter) → Day 1  
- Optional DOG prayer prompts; optional share via OS sheet  
- **Settings:** ask time, notifications, reading track, **Bible source** (+ translation, custom template, ESV key + in-app toggle), **appearance**, about / source link, reset  
- **Light / dark / system** appearance via themed design tokens  
- Local-first persistence; offline for today’s commitment, suggestion, and notes  

### Out

- Church reading plan (v1.5)  
- Partner sync, group feeds, likes, leaderboards  
- Required accounts  
- Audio Bible; **bundled** Bible edition (in-app text only via user’s own ESV key)  
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
| K | **Onboarding — what to read** | Suggest Mark; alt: pick a different book / I already follow a plan | Start with Mark |
| L | **Pick a book** | Search 66 + starter list (Mark, John, Psalms, Proverbs, James); drip size | Start at [book] 1 |
| X | **Starting chapter (≤36 ch.)** sheet | Full chapter grid; count earlier as read | Start at [book] n |
| Y | **Starting chapter — Psalms** sheet | Five-book range tabs (“1–41 / Book One” …) + Go to | Start at Psalm n |
| Z | **Starting chapter — long book** sheet | Even range tabs (≤30 ch. each) + Go to | Start at [book] n |
| C | **Today — Ask** | Locked QBE question | Yes / Not today |
| D | **Today — Commit** sheet | Saved yes + optional when/where; share | Continue |
| E | **Today — DOG** (optional) | Discipline / Open ears / Gladness | Continue / Skip |
| M | **Passage — book track** | Mark / Something else toggle; suggestion + progress; adjust / change book; reflect entry | Open in [source] · I read it |
| P | **Passage — welcome back** | Gap ≥3 days variant of M | same as M |
| Q | **Passage — back after detour** | Variant of M after a detour day | same as M |
| S | **Passage — something else** | Type ref(s); short drips; recent; bookmark reassurance | Open · I read it |
| N | **Adjust passage** sheet | Book, from/to, quick ranges, type a ref | Use [ref] |
| W | **Passage — in-app ESV** | ESV text when key present; tap verse to tag; Reflect + I read it bar | I read it |
| U | **Reflect** | Prompts, note, verse tags, Huh?; open passage | I read it / Save & keep reading |
| O | **Where did you stop?** sheet | Read all (default) / stopped partway (verse stepper); tomorrow preview | Save & finish |
| G | **Today — Done** | Loop closed; streak / P4 secondary; your note; share | Done |
| T | **Book recap** | Stats for the finished book | Choose what’s next |
| R | **Book finished** | Suggest next book (John / Acts / Psalms) | Start [book] 1 tomorrow |
| H | **Today — Not today** | Grace line only | Close / History |
| I | **History** | Calendar + recent list; note / Huh? markers | Open day |
| J | **Settings** | Ask time, notifications, reading, Bible source, appearance, about, reset | — |
| V | **Settings — Bible source** | Provider, translation, ESV key + in-app toggle | — |

F (plan-based passage) is **superseded by M** and kept only for v1.5 plan reference.

**One primary action per day:** answer the question, then read.

### User flows

```text
ONBOARD (first launch)
  A Framing → B Ask time → K What to read
    → “Start with Mark” → C Ask (Day 1)
    → “Pick a different book” → L → (optional “partway”: X | Y | Z) → C
    → “I already follow a plan” → C (Today defaults to Something else; Mark = backup)

DAILY — answered Yes
  Notification / open → C Ask → Yes → D Commit (optional) → E DOG (optional)
  → Passage: M (default) | Q (yesterday was a detour) | P (gap ≥ 3 days) | W (ESV key on)
      ↳ optional: N Adjust · Change book (L) · Something else (S) · Reflect (U)
  → “I read it”
      → track reading: O Where did you stop? → G Done
      → detour: G Done (bookmark unchanged)
  → final chapter of book: O → T Recap → R Book finished → next book

DAILY — Not today
  C Ask → Not today → H Grace → end (no guilt stack)

MISSED ASK (day ended unanswered)
  Next open → C re-ask once; History shows unanswered for that date

SHARE (optional, after Yes or Done)
  OS share sheet with plain-text commitment line
```

### Layout notes for pen.dev

- **Ask before passage.** Today must not lead with the reading.  
- Mobile-first; large Yes / Not today controls; key actions in the lower half.  
- Streak and Power of Four are **secondary**—never louder than the ask.  
- No red “missed!” banners; soft, calm visual language.  
- Selection = tinted fill + accent border/check; **no radio buttons**.  
- Every color is a themed token (§12); never hard-code hex in screens.  

---

## 8. Behavior rules

| Rule | Spec |
| --- | --- |
| Commitment persistence | Answer must be tap-persisted—not “in your head” only |
| Yes unlocks passage | Passage after Yes (or after optional DOG) |
| Not today + streak | “Not today” never triggers shame UI. Streak breaks on Not today / no read-done by end of local day; longest preserved. Power of Four counts only **engaged** days (Yes + read done). |
| Unanswered | Soft re-ask next open; history shows unanswered |
| Suggestion | `bookmark` + drip size (or rest of current chapter). Variant: **Q** if last reading was a detour; **P** if last engaged day ≥ 3 days ago; else **M** |
| Detours | “Something else” readings count as read (streak, P4, history) but **never move the bookmark** and skip O |
| Bookmark advance | Only on **O** confirm for track readings: “read all” → end of range; “stopped partway” → chosen verse |
| Plan follower | If onboarding chose “I already follow a plan”, Today opens on **Something else**; book one tap away |
| Book finished | Confirming the final chapter → T Recap → R next-book choice; track `finishedAt` set |
| Chapter picker | ≤36 chapters: full grid. >36: range tabs + **Go to**. Psalms: five books (1–41, 42–72, 73–89, 90–106, 107–150; sub-label “Book One”…). Others: `ceil(n/30)` even blocks (Gen 1–25/26–50, Ex 1–20/21–40, Job 1–21/22–42, Isa 1–22/23–44/45–66, Jer 1–26/27–52, Ezek 1–24/25–48) |
| Count earlier as read | On by default; **off for Psalms** |
| Bible link | YouVersion: try `youversion://bible?reference=MRK.4.1-20`, fall back to `https://www.bible.com/bible/{versionId}/MRK.4.1-20.{TR}`. Bible Gateway: `https://www.biblegateway.com/passage/?search={ref}&version={tr}`. Custom: template with `{book} {chapter} {verses} {ref} {tr}` |
| In-app ESV | Only when key present + toggle on. Show ESV headings, verse numbers, required copyright line. Key stored on device only |
| Reflect | Autosaves; one reflection per day/passage; Huh? is a flag on the reflection |
| Notifications | Payload/body = QBE question; tap → Ask screen |
| Appearance | System follows OS `prefers-color-scheme`; Light/Dark override via `data-theme` |
| Offline | Can answer QBE, see suggestion, write notes, mark done. Link-out needs network; in-app ESV needs network unless today’s passage was pre-cached |
| Reset | Settings can clear local commitments, track, and notes (confirm) |

---

## 9. Data model sketch

```text
ReadingTrack            (one active in v1)
  id
  type           book            (plan → v1.5)
  book           e.g. "Mark"
  bookmark       { chapter, verse }   next unread position
  chunk          verses | chapter | 2chapters
  startedAt
  finishedAt?

DailyCommitment
  date           YYYY-MM-DD (local)
  answer         yes | not_today | unanswered
  answeredAt?
  whenWhere?     optional note from commit sheet
  passageRef?    what was actually read, may be multiple ("Luke 10:38–42; Psalm 46")
  source?        track | detour
  endRef?        last verse read (track only; drives bookmark)
  readDone       boolean
  readDoneAt?

Reflection
  date
  passageRef
  prompt?        "What stood out?" | "About God?" | "Carry today?"
  body
  verseTags[]    e.g. ["4:9", "4:20"]
  huh            boolean
  updatedAt

UserPrefs
  askTime
  notificationsEnabled
  onboardingComplete
  readingMode        book | follow_plan
  bibleProvider      youversion | biblegateway | esvorg | custom
  translation        e.g. "ESV"
  customUrlTemplate?
  esvApiKey?
  showInAppText      boolean
  appearance         system | light | dark
  createdAt
```

**Storage:** IndexedDB (+ localStorage mirror) behind a `StorageAdapter`. No server in v1.  
**Content:** Book metadata (66 books, chapter + verse counts) bundled. No bundled Bible text. **No proprietary sermon manuscripts.**

---

## 10. Success criteria (v1)

1. First-time user completes onboarding (incl. book choice) and answers Day 1 QBE in under ~2 minutes.  
2. Returning user: open → ask → Yes → suggested passage → done without dead ends.  
3. “Not today” never shows shame/guilt stack; grace line only.  
4. Commitment, readDone, **bookmark**, and **reflections** survive refresh / relaunch.  
5. Bookmark is unchanged by detours and advances correctly from “Where did you stop?”.  
6. Passage link opens the chosen source with the correct ref; in-app ESV renders when a valid key is set.  
7. Finishing a book’s last chapter shows Recap → Book finished.  
8. History accurately reflects Yes / Not today / read / unanswered + note / Huh? markers.  
9. Light and dark themes meet WCAG AA contrast for text; System follows the OS.  
10. Installable PWA; ask-time reminder works where the browser/OS allows.  
11. No account wall; no partner or plan UI shipped.

---

## 11. Open items (do not block pen.dev v1 UI)

**Resolved in r2**

- ~~Exact outbound Bible site / URL pattern~~ → YouVersion default, configurable (§8)  
- ~~Whether “Huh?” is a toggle, note field, or both~~ → flag on the Reflection  
- ~~Real day-by-day passage schedule~~ → moved to v1.5 church plan  

**Still open**

- Default ask time if user skips  
- Final grace one-liner for Not today (tone locked; wording flexible)  
- ESV API terms review (personal, non-commercial; display limits, attribution)  
- Recap: keep “two sittings” chapter distinction or simplify  
- Natural-section labels for long books (e.g. Isaiah 1–39 / 40–66) as tab sub-labels later?  

Partner visibility, nudges, group size, and church plan → **v1.5+ PRD**, not this file.

---

## 12. Design tokens

All colors are themed variables (`mode: light | dark`) in `drip-by-drip.pen`; see the **Design Tokens — Light / Dark** board.

| Group | Tokens |
| --- | --- |
| Surfaces | `bg` · `surface` · `subtle` · `line` · `scrim` · `glass` |
| Text | `ink` · `muted` · `faint` · `on-accent` |
| Brand | `accent` · `accent-soft` · `drop` · `warm` · `warm-soft` · `warm-ink` · `caution` |
| Utility | `knob` · `shadow` |

Type: **Newsreader** (headings, passage refs, scripture) · **Inter** (UI).

---

*Grounded in CrossWay *Drip by Drip* application notes (2026-10-04) QBE framing and the project plan. No sermon text; passage refs and short prompts only.*
