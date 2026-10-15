# PRD — Drip by drip (Bible reading consistency)

**For:** pen.dev design/build  
**Product:** Drip by drip — local-first PWA with an optional account  
**Phase:** v1 and v1.5a shipped; v1.5b social layer plus group plans and opt-in notes  
**Rev:** r4 · Oct 8, 2026  
**Design file:** [drip-by-drip.pen](../drip-by-drip.pen) (screens A–Z + v1.5 1–20, design tokens)  
**Source:** [bible-reading-app-plan.md](./bible-reading-app-plan.md) · [sermon notes 2026-10-04](https://ryanbyk.github.io/crossway-milwaukee-sermon-notes/notes/drip-by-drift/2026-10-04/)  
**Do not invent sermon text.** Passage refs + optional short prompts only.  
**App URL:** [https://app.drip-by-drip.com](https://app.drip-by-drip.com) (GitHub Pages, site root). The apex `drip-by-drip.com` is reserved for a future marketing site.

---

## Changelog

| Rev | Change |
| --- | --- |
| **r4** | Group reading plans move out of v1.5c into this slice. A group owner sets one plan (book, optional chapter range, the app’s drip size, reading days, start date). Members join where the group is or start at day 1. Today shows that plan’s drip when the reader has joined it; otherwise personal reading. Opt-in note sharing: a note stays private unless the reader shares that note with chosen groups or partners. Church-wide plans, browse plans, the admin plan editor, and the leader dashboard stay later. |
| **r3** | Caught the PRD up to main (Oct 7, 2026). Optional email sign-in (magic link plus a 6–8 digit code; the code is primary in the installed iPhone PWA; Apple/Google built and hidden). Snapshot sync to `user_snapshots` (newest `updatedAt` wins, no merge screen). One reading partner. Web Push ask-time reminders when signed in. In-app ESV on by default through the Edge proxy — §8 now matches §4; no API key on the device. Weeks run Sunday–Saturday. Default ask time 6:30 AM. History can mark any of the last 7 days (not today) read. Phasing splits **v1.5a shipped** (sign-in, sync, partner, push), **v1.5b next** (groups, more than one partner, drops), **v1.5c** (church/group plans), and later (activity feed, leader dashboard). |
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
| Stay shippable as a thin PWA | Works offline for today’s ask + suggestion; an account is optional |
| Let people read alongside each other without replacing the ask | A signed-in reader can sync, keep one partner, and receive the ask as Web Push. The partner sees read-done only |

**Non-goals:** required accounts; a separate friends or follower graph; activity feed and leader dashboard (later); church-wide plans, browse-plans, and the admin plan editor (later); pastor CMS; seasons planner; a bundled Bible edition; a sync merge screen.

---

## 2. Users

| Persona | Need |
| --- | --- |
| **Primary — “I want to stick with it”** | Adult who intends to read Scripture regularly but drifts; wants a simple daily ask + clear next drip |
| **Plan follower** | Already follows another plan (church bulletin, other app); wants the daily ask + a fast way to log “something else” without losing a backup book |
| **Reading partner (v1.5a)** | One optional person. Sees read-done days and a display name. Never sees answers, Not today, notes, Huh?, or the book |
| **Group member** | Same person in a group they created or joined. Without a plan, everyone reads their own book. With a plan, Today can follow that plan. Members never see notes unless you choose to share one |

Assumes personal use and one primary device for sync. Sign-in is optional. Skipping it leaves reading, notes, and reminders on this device.

---

## 3. Phasing

| Phase | Scope | Backend |
| --- | --- | --- |
| **v1 (shipped)** | Solo QBE loop, **reading track (book + bookmark) with detours**, streaks + soft Power of Four, reminders = ask, history (including mark-read on a recent day), reflect notes, book recap, settings (Bible source, appearance), optional DOG prayer, optional OS share, in-app ESV text (server-held key, on by default) | Local storage. No account required |
| **v1.5a (shipped)** | Optional email sign-in, snapshot sync, **one** reading partner (invite, accept/decline, unlink, one canned note a day), Web Push ask-time reminders | Supabase Auth, `user_snapshots`, partner tables, `push_subscriptions`, Edge Functions |
| **v1.5b** | **Groups**, **more than one partner**, **drops** | Group and drop records |
| **This slice** | **Group reading plans** and **opt-in note sharing**. Church-wide plans stay later | Plan, follow, and shared-note rows. Apply after the social-layer migration |
| **v1.5c** | Church-wide plans, browse plans (v1.5·9), the admin plan editor (v1.5·11) | Plan content feed |
| **Later** | Activity feed (v1.5·13), leader dashboard (v1.5·20) | Explicit product ask |

**v1.5a note:** The partner watches read-done days and must not replace the personal daily ask.

### v1.5b product requirements

The social layer plays off the name. People encourage each other **drip by drip**. Design reference: v1.5·4–8 (groups), v1.5·12 (partner pick), and the Drop control already drawn on v1.5·13.

#### Groups

Create a group, join with a code, and invite with a code or a link. Matches design screens v1.5·4–8.

- **My groups** (v1.5·4) lists groups the reader belongs to.
- **Create** (v1.5·5) asks for a name. A new group starts as “everyone reads their own book.” The owner sets a plan later, from the group home.
- **Join** (v1.5·6) takes the group’s code. The design shows a 6-character code.
- **Group home** (v1.5·7) shows who has read today (display name + a read-done mark, and a count such as “5 have read”). Never answers, Not today, Huh?, or the book. Members never see notes unless you choose to share one. A missing mark is silence, not a No. When the group has a plan, the home shows **Our plan** with today’s passage and progress.
- **Invite** (v1.5·8) shares a code or a link.
- Group size cap for v1.5b is **20** members (§11).

#### More than one partner

v1.5a allows **exactly one** active partner. The database keeps a single active partnership per person, and the screen says “one person.”

v1.5b lets a reader keep **more than one** partner if they want. Each partnership is still an invite (code or link), an accept or decline, and an unlink. Each one keeps the v1.5a privacy rule: read-done days and display name only.

The partner cap for v1.5b is **5** (§11). v1.5·12 is the picker (search, and people from your groups). “Which book you’re in” on that screen stays **off**. Shipped data has no book, and that stays the default.

#### Drops

A **drop** is how people react to each other. A reader can send a drop to a partner or a group member — for example after that person has read today, or as encouragement. Drops are the reaction and encouragement primitive across partners and groups. They replace and extend the v1.5a canned partner note.

The activity feed (v1.5·13, later) already shows a **Drop** thank-you on a read (“Dan read today” → Sent / Drop). Notification preferences (v1.5·16) already name “Someone sends you a drop” as “a quiet thank-you when people see you read.”

| Question | v1.5b requirement |
| --- | --- |
| Who can send to whom | A signed-in reader, to a partner or to a member of a group they share. That set is **friends** (below). Not to anyone outside it |
| When | When that person has a read-done day showing, or as encouragement while you share a partnership or a group |
| Rate limit | **One drop per sender per recipient per local day** (§11). v1.5a’s note was one canned note per sender per day, because there was only one partner |
| Message along for the ride | Yes, optional, and **canned**. A short grace line from a small list (the three v1.5a notes are the start). No free text |
| Where a received drop shows | A quiet line on **Today**, the person’s row on **group home**, and a **small inbox**. The full activity feed is later |
| Push | In-app in v1.5b. Web Push for drops may come later, from the preferences on v1.5·16. That delivery is an open item (§11) |

#### Friends

**Friends** is not a separate follower graph. A friend is someone you share a group or a partnership with. Screens that say “Friends” mean that set.

#### Group reading plans

One active plan per group. The owner (the leader) sets it and can end or replace it. Replacing deletes the old plan, so members choose again.

- **Book**, and an optional chapter range inside that book.
- **Pace** is the app’s existing drip size: a few verses, one chapter, or two chapters. There is no separate “N chapters” control beyond those two chapter sizes.
- **Reading days** are a Sunday-first weekday mask (Mon–Fri, every day, or a custom set). Off days are grace: Today shows the personal book, and that day does not count as a plan read.
- **Start date** anchors the group calendar.

A member opens plan detail (v1.5·10) and picks **Join where the group is** (the group’s calendar) or **Start at Day 1** (the same sequence, dated from the day they join). Personal reading keeps working. Today shows the plan’s drip only when the reader has joined a plan and today is one of its reading days. Otherwise Today is the personal book, and the bookmark does not move for plan days. One followed plan is Today’s reading; joining another replaces it. The older “I already follow a plan” placeholder remains for someone who is not on a group plan.

A group with no plan stays “everyone reads their own book.” Read-today on a plan group counts plan reads among people currently following that plan. Church-wide plans, browse-plans tabs, the admin editor (v1.5·11), and the leader dashboard are out of this slice.

#### Opt-in note sharing

After a drip, wherever the day’s note is written, the reader may share that note with one or more of their groups and/or partners. Sharing is **off** until they pick recipients. It is a choice for that note, not a setting.

Only the note text is shared. Answers, Not today, and Huh? are never sent. Copy on the share sheet: “Only the people you pick will see this note.”

Recipients see the note for that day: on the group home under Shared notes, and on the partner screen. They can react with the existing drop. A note does not get its own drop; the one-per-pair-per-day limit still applies. The author can stop sharing or delete the note at any time. Leaving a group or unlinking a partner removes access, because a read requires current membership or an active partnership.

---

## 4. Locked defaults (v1, plus what v1.5a locked)

| Decision | Default |
| --- | --- |
| Platform | **Web / PWA** (mobile-first, installable) |
| QBE question copy | Locked: **“Will you read God’s word today?”** (no variants) |
| “Not today” | Allowed; **gentle grace** line; no guilt stack; streak rules stay soft (see §8) |
| What to read | Onboarding **always suggests a book (Mark)**; user may pick another book or choose “I already follow a plan” (Mark stays as backup) |
| Reading track | **One book + bookmark** at a time; “Something else” = one-day detour |
| Daily drip size | **1 chapter** (options: a few verses · 1 chapter · 2 chapters) |
| Bible text | **Link out** to the chosen source — **YouVersion** by default (app, fallback bible.com); Bible Gateway, ESV.org, or custom URL template |
| In-app text | **On by default**: today’s passage renders as the ESV inside the app. The Crossway key is held server-side (Edge Function `esv-passage`). There is no API key field on the device. Open passage still uses the chosen external source. Off, offline, or a failed fetch falls back to that link |
| Translation | ESV (user-changeable for link-out sources) |
| Appearance | **System** (Light / Dark selectable) |
| Week | **Sunday–Saturday** for Power of Four and History |
| Ask time | User-chosen. **6:30 AM** if they skip |
| Accounts | **Optional.** Email sign-in is a magic link plus a 6–8 digit code in the same email. In the installed iPhone PWA the **code is the primary path**; the link stays available (on iPhone it may open Safari, which does not share the Home Screen app’s storage). In a browser tab the link is primary and “Email me a code” stays on the screen. Apple and Google are built and **hidden** for v1. Settings → Sign in, and the screen after Sign out, use this same path |
| Sync | One row in `user_snapshots` per account. Newest snapshot `updatedAt` wins. **No merge screen.** Sync defaults on. Guests never write that table |
| Partner | **Optional.** v1.5a shipped exactly one. v1.5b allows up to **5**. Invite by code or link; accept, decline, or unlink. Sees read-done days and display name only |
| Groups | Up to **20** members. Without a plan, everyone reads their own book. Members see who read today |
| Drops | One drop per sender per recipient per local day, with an optional canned line. In the app. A shared note uses that same drop |
| Group plan | One active plan per group. Pace is the drip size. Today follows it only after the reader joins |
| Shared notes | Off unless that note is shared. Members never see notes unless you choose to share one |
| Church-wide plan | Later, with browse plans and the admin editor |

---

## 5. Tone & key copy

**Tone:** Grace, not guilt. Gospel clarity first—frequency does not determine standing with God; Christ alone does. Encourage thirst and follow-through. Confusion (“Huh?”) is normal; keep going. A partner note and a drop are a quiet hello, never a missed-day lecture.

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
| Sign in | “Optional. Sign in to sync, join a group, or read a plan together. Your notes stay private unless you share one.” |
| Check email (installed app) | “On iPhone, a sign-in link may open Safari. Enter the code so this app stays signed in.” |
| Partner | “One person who sees whether you read today — never your answers. A note stays private unless you share it.” |
| Partner will see | “Whether you read today.” “Never: Yes, Not today, or unanswered days.” “Never: Huh?, or a note you didn’t share.” The book is not on this card |
| Canned note (one per sender per day) | “Thinking of you. How’s the Word today?” · “A quiet hello. The Word will still be here whenever you’re ready.” · “Praying you get a drip in today, whenever it fits.” |
| Group | “Read together, gently. Members see who read today — never answers. A note stays private unless you share it.” |
| Share a note | “Only the people you pick will see this note.” |
| Drop (v1.5b) | A quiet thank-you. The control label in the design is **Drop** |

Reminders **are** the QBE question (not “Don’t forget to read!” guilt).

---

## 6. Scope

### In — v1

- QBE daily question → Yes / Not today → persisted commitment  
- Today flow: ask → commit → (optional DOG) → passage → (optional reflect) → I read it → where did you stop → done  
- **Reading track:** pick a book (suggested starters + search all 66), daily drip size, optional **start partway** via chapter grid  
- **Passage suggestion** from bookmark; **adjust verses** (book / from / to / quick ranges / type a ref); **change book**  
- **Something else** (detour): type one or more refs (e.g. `Luke 10:38–42; Psalm 46`), today’s short drips (Proverb of the day, next Psalm), recent entries  
- **Where did you stop?** — read all (default) or pick last verse; advances bookmark  
- **Reflect** notes while reading: optional prompts, free text, verse tags, Huh? toggle; autosaved on device  
- **Book finished** → **Recap** (chapters grid, reading days, longest streak, Power of Four weeks, usual time, reflections, detours, Huh? moments, rest days) → choose next book  
- Current + longest streak; soft weekly Power of Four cue (≥4/7), week = Sunday–Saturday  
- User-chosen **ask time** (default **6:30 AM**); notification carries the QBE question where supported  
- History (calendar + recent list): read / yes / not today / unanswered, note + Huh? markers. Any of the **last 7 days** (not today) that is unanswered or Yes without read-done can be marked read  
- Onboarding: framing → ask time → what to read (→ pick book → starting chapter) → Day 1  
- Optional DOG prayer prompts; optional share via OS sheet  
- **Settings:** ask time, notifications, reading track, **Bible source** (+ translation, custom template, in-app ESV toggle, **no API key**), **appearance**, about / source link, reset  
- **Light / dark / system** appearance via themed design tokens  
- Local-first persistence; offline for today’s commitment, suggestion, and notes  

### In — v1.5a (shipped)

- Optional account. Skip sign-in and the app stays local  
- Email magic link and a 6–8 digit code. Code is primary in the installed iPhone PWA. Same screen from Settings and after Sign out  
- Apple and Google sign-in built, hidden  
- Account: display name (shown to a partner), sync on/off, export, sign out, delete account  
- Snapshot sync to `user_snapshots`. Newest `updatedAt` wins. No merge screen  
- One reading partner: invite code (8 characters, 14 days) and link, accept, decline, unlink  
- Partner sees read-done days and display name only. One canned note per sender per day, in the app  
- Web Push ask-time reminder when signed in. The server reads ask time from the synced snapshot. iPhone needs the Home Screen app. Local notification otherwise  

### In — v1.5b (next)

- Groups: create, join with a code, invite by code or link, group home of who read today (§3)  
- More than one partner, same privacy rule, cap **5**  
- Drops to a partner or group member (§3)  
- Friends = people you share a group or a partnership with  

### Out

- Church / group reading plan (**v1.5c**)  
- Activity feed, leader dashboard (**later**)  
- Required accounts  
- A separate friends or follower graph  
- Sync merge / conflict picker (design v1.5·18 is not the product rule)  
- Audio Bible; **bundled** Bible edition (in-app ESV is fetched per passage, not stored as an edition)  
- Forums, pastor CMS, season/special-date planner  
- Analytics product, church admin  
- Native App Store apps (unless later required for push)  
- Free-text partner messages; shame copy in a note or a drop  
- API key entry on the device  

---

## 7. Screens & flows (design against these)

### Screen list — v1 (A–Z)

| # | Screen | Purpose | Primary action |
| --- | --- | --- | --- |
| A | **Onboarding — framing** | Keystone + gospel-clarity one-liner | Start |
| B | **Onboarding — ask time** | “When are you available *and* alert?” Default 6:30 AM | Save (or skip → 6:30 AM) |
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
| W | **Passage — in-app ESV** | ESV text when the in-app toggle is on (default). Tap verse to tag; Reflect + I read it bar. No key UI | I read it |
| U | **Reflect** | Prompts, note, verse tags, Huh?; open passage | I read it / Save & keep reading |
| O | **Where did you stop?** sheet | Read all (default) / stopped partway (verse stepper); tomorrow preview | Save & finish |
| G | **Today — Done** | Loop closed; streak / P4 secondary; your note; share | Done |
| T | **Book recap** | Stats for the finished book | Choose what’s next |
| R | **Book finished** | Suggest next book (John / Acts / Psalms) | Start [book] 1 tomorrow |
| H | **Today — Not today** | Grace line only | Close / History |
| I | **History** | Calendar + recent list; Sunday-first; note / Huh? markers | Open day |
| I·day | **History — day sheet** | That day’s mark, passage, note, Huh?. Last 7 days (not today) can be marked read | I read it |
| J | **Settings** | Ask time, notifications, reading, Bible source, appearance, account, partner, about, reset | — |
| V | **Settings — Bible source** | Provider, translation, in-app ESV toggle. **No API key** | — |

F (plan-based passage) is **superseded by M** and kept only for v1.5c plan reference.

### Screen list — account (v1.5a, shipped)

| # | Screen | Purpose | Primary action |
| --- | --- | --- | --- |
| v1.5·1 | **Sign in** | Optional email. Code primary when installed; link primary in a browser tab. Apple/Google hidden | Email me a code / Email me a sign-in link |
| v1.5·2 | **Check your email** | Code field and the link, on one email. Design sheet was link-only; the shipped sheet is code + link | Enter code / Open the link |
| v1.5·3 | **Account** | Display name, sync, export, sign out, delete, reading partner | Save name |
| — | **Reading partner** | Invite code/link, accept or decline, canned note, unlink. v1.5·12 is the later multi-partner picker | Create an invite / Read together |

### Design file — v1.5 screens 1–20

| # | Screen | Phase |
| --- | --- | --- |
| 1 | Sign in | v1.5a shipped (email only on screen) |
| 2 | Check email | v1.5a shipped (code + link) |
| 3 | Account / profile | v1.5a shipped |
| 4 | My groups | v1.5b |
| 5 | Create group | v1.5b |
| 6 | Join with code | v1.5b |
| 7 | Group home | Social layer; Our plan card is this slice |
| 8 | Invite | Social layer |
| 9 | Browse plans | Later (church-wide) |
| 10 | Plan detail | This slice (group plan; hide the church tag) |
| 11 | Admin — create / edit plan | Later |
| 12 | Partner pick | v1.5b (book line stays off; see §11) |
| 13 | Activity feed | Later |
| 14 | Insights share card | Later |
| 15 | Settings (account + sync) | v1.5a shipped, inside Settings and Account |
| 16 | Notification preferences | Later for drops via push; the daily ask push is already in Settings |
| 17 / 17b | Restored-from-cloud and sync toasts | Design only. Sync applies the newer snapshot without a conflict step |
| 18 | Sync conflict sheet | Not shipped. Newest `updatedAt` wins |
| 19 | ESV reader (polished) | v1 reader is W; this frame is polish |
| 20 | Leader — plan dashboard | Later |

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
  → Passage: M (default) | Q (yesterday was a detour) | P (gap ≥ 3 days) | W (in-app ESV on)
      ↳ optional: N Adjust · Change book (L) · Something else (S) · Reflect (U)
  → “I read it”
      → track reading: O Where did you stop? → G Done
      → detour: G Done (bookmark unchanged)
  → final chapter of book: O → T Recap → R Book finished → next book

DAILY — Not today
  C Ask → Not today → H Grace → end (no guilt stack)

MISSED ASK (day ended unanswered)
  Next open → C re-ask once; History shows unanswered for that date

HISTORY — mark a past day
  I → day sheet for one of the last 7 days (not today)
    → unanswered, or Yes without read-done → “I read it”
    → counts for streak and Power of Four
    → bookmark advances only when it still sits at that drip’s start
    → otherwise the bookmark stays

SIGN IN (optional; Settings, and again after Sign out)
  v1.5·1 → email
    → installed iPhone PWA: “Email me a code” is the main button
    → browser tab: “Email me a sign-in link” is the main button
    → the other path stays on the screen and on Check your email
  → v1.5·2 Check your email (6–8 digit code and/or the link)
  → v1.5·3 Account
  → “Keep using without an account” returns to the app

PARTNER (signed in, v1.5a — exactly one)
  Settings or Account → Reading partner
    → Create an invite (code + link) | “I have a code” → accept or decline
    → linked: “Read today” or silence; one canned note today; Unlink

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
| Week | Sunday–Saturday. History’s weekday row starts on Sunday. Power of Four counts engaged days in that week, through today |
| Unanswered | Soft re-ask next open; history shows unanswered |
| Past read | Any of the last 7 local days, not today, and not before the reader started, can be marked read when that day is unanswered or Yes without read-done. Marking it sets Yes + read-done, so it counts for streak and Power of Four. The bookmark advances only when reading mode is the book track **and** the bookmark still sits at that drip’s start chapter and verse. Detours never move it. Not today stays a rest day |
| Suggestion | `bookmark` + drip size (or rest of current chapter). Variant: **Q** if last reading was a detour; **P** if last engaged day ≥ 3 days ago; else **M** |
| Detours | “Something else” readings count as read (streak, P4, history) but **never move the bookmark** and skip O |
| Bookmark advance | Only on **O** confirm for track readings, or on a past-read mark when the bookmark still sits at that drip’s start: “read all” → end of range; “stopped partway” → chosen verse |
| Plan follower | If onboarding chose “I already follow a plan”, Today opens on **Something else**; book one tap away |
| Book finished | Confirming the final chapter → T Recap → R next-book choice; track `finishedAt` set |
| Chapter picker | ≤36 chapters: full grid. >36: range tabs + **Go to**. Psalms: five books (1–41, 42–72, 73–89, 90–106, 107–150; sub-label “Book One”…). Others: `ceil(n/30)` even blocks (Gen 1–25/26–50, Ex 1–20/21–40, Job 1–21/22–42, Isa 1–22/23–44/45–66, Jer 1–26/27–52, Ezek 1–24/25–48) |
| Count earlier as read | On by default; **off for Psalms** |
| Bible link | YouVersion: try `youversion://bible?reference=MRK.4.1-20`, fall back to `https://www.bible.com/bible/{versionId}/MRK.4.1-20.{TR}`. Bible Gateway: `https://www.biblegateway.com/passage/?search={ref}&version={tr}`. Custom: template with `{book} {chapter} {verses} {ref} {tr}` |
| In-app ESV | **On by default** (`showInAppEsv`). Today’s passage renders in the app (headings, verse numbers, required copyright line) via the `esv-passage` Edge proxy. The Crossway key stays in the Edge secret. **No API key UI and no key on the device.** If the toggle is off, the device is offline, or the fetch fails, Open passage uses the chosen external source. A passage already fetched may show from the session cache |
| Reflect | Autosaves; one reflection per day/passage; Huh? is a flag on the reflection |
| Ask time | Default **06:30** local. Reminders fire at the saved ask time |
| Notifications | Payload/body = QBE question; tap → Ask screen. **Signed in:** Web Push. A minute cron calls `send-ask-push`, which reads ask time, timezone, reminders-on, and whether today is already answered from the synced snapshot. iPhone delivers Web Push only to the Home Screen app. **Otherwise** (guest, or a browser that cannot take Web Push): a local notification. Signing out or turning reminders off drops this device’s push row |
| Appearance | System follows OS `prefers-color-scheme`; Light/Dark override via `data-theme` |
| Offline | Can answer QBE, see suggestion, write notes, mark done. Link-out needs network; in-app ESV needs network unless today’s passage was pre-cached. Sync waits for a connection |
| Accounts | Optional. The code verifies in this window and stores the session here, including after sign-out. A new account and a returning account both use it |
| Sync | While Sync is on, sign-in keeps whichever snapshot has the newer `updatedAt`. A device that has never saved adopts the account row. Later edits push this device. Equal timestamps keep the local copy. A device that last synced as someone else adopts that account’s row when one exists, and does not upload the previous account’s reading. Turning Sync off stops reads and writes and leaves the account row as it was |
| Partner | Up to **5** active partners (v1.5a was exactly one; existing single partnerships stay valid). Invite code or `?partner=` link; the other person accepts or declines; either person can unlink one partnership. Shared presence is read-done days plus display name. The screen shows **Read today** or nothing. Never the QBE answer, Not today, Huh?, or the book. A note appears only when that person shared it with this partner. A drop may carry one canned line |
| Group | Up to **20** members. Create, join with a 6-character code, invite by code or link, leave. The owner can rename and remove a member. Group home shows who read today and a count of readers. A missing mark is silence. Never answers, Not today, Huh?, or the book. Members never see notes unless you choose to share one. No plan means everyone reads their own book |
| Group plan | One active plan per group, set by the owner. Pace is verses, one chapter, or two chapters. Reading days skip off days. Join where the group is, or start at day 1. Today shows the plan drip only for a joined reader on a reading day. Plan reads count for that group’s read-today. Ending or replacing the plan clears follows |
| Shared note | One note per author per day. Recipients are the groups and partners picked for that note. Read access requires current membership or an active partnership. The author can unshare or delete it |
| Drop | One per sender per recipient per local day, to a partner or a group member, including a drop on a shared note. Optional canned line from the three v1.5a notes, or none. Shows on Today, on that person’s group row, and in a small inbox. No push |
| Friends | Someone you share a group or a partnership with. Not a follower graph |
| Reset | Settings can clear local commitments, track, and notes (confirm) |
| Delete account | `delete-account` removes the auth user. The snapshot, partner rows, and push rows go with that user. Reading on this device stays |

---

## 9. Data model sketch

```text
ReadingTrack            (one active in v1)
  id
  type           book | group_plan   (church-wide plan stays later)
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
  askTime                default "06:30"
  notificationsEnabled
  onboardingComplete
  readingMode            book | plan
  groupPlan?             the one group plan Today follows, or empty for personal reading
  bibleProvider          youversion | biblegateway | esvorg | custom
  translation            e.g. "ESV"
  customUrlTemplate?
  showInAppEsv           boolean   default on; false only when the reader turned it off
  appearance             system | light | dark
  timeZone               IANA zone last seen on this device (ask-time push)
  createdAt
```

There is no `esvApiKey` on the device or in the snapshot. A stored key from an older build is dropped on load.

**On-device storage:** IndexedDB (+ localStorage mirror) behind a `StorageAdapter`. One snapshot; if the two copies disagree, the newer `updatedAt` wins. Screens never touch storage themselves.

**Account storage (optional):** the same snapshot document, one row per account.

```text
Profile                      public.profiles
  id                         auth user id
  displayName                ≤ 80 characters; shown to a partner (and, in v1.5b, a group)
  updatedAt

UserSnapshot                 public.user_snapshots
  userId                     one row per account
  payload                    the snapshot (prefs, places, days)
  updatedAt                  snapshot clock from payload.updatedAt — last write wins

Partnership                  public.partnerships
  id
  userLow, userHigh          ordered pair; one active partnership per person in v1.5a
  invitedBy
  status                     active | ended
  createdAt, endedAt?

PartnerInvite                public.partner_invites
  id, inviterId
  code                       8 characters; single-use
  status                     open | accepted | declined | revoked
  expiresAt                  14 days
  acceptedBy?

PartnerNudge                 public.partner_nudges
  id, partnershipId, senderId, recipientId
  body                       one of the three canned lines
  day                        one row per sender per day
  seenAt?

PartnerReadDay               public.partner_read_days
  userId, day                a finished drip. No answer, note, or book column

PushSubscription             public.push_subscriptions
  id, userId, endpoint, p256dh, auth
  timeZone                   device zone used to match ask time
  lastSentOn                 local date this endpoint already received the ask
```

**Supabase summary.** RLS on every table above. Guests never write them. Partner writes go through private security-definer functions (`create_partner_invite`, `lookup_partner_invite`, `accept_partner_invite`, `decline_partner_invite`, `revoke_partner_invite`, `unlink_partner`, `send_partner_nudge`, `see_partner_nudge`, `set_partner_read_day`); signed-in clients select only. A partner can read the other person’s display name and a narrow window of read-done days, not the snapshot. Edge Functions: `esv-passage` (Crossway key in `ESV_API_KEY`), `send-ask-push` (cron, once a minute), `vapid-public-key`, `delete-account` (service role stays on the server). Deleting the auth user cascades the snapshot, profile, partnerships, invites, nudges, read days, and push rows.

**Content:** Book metadata (66 books, chapter + verse counts) bundled. No bundled Bible text. **No proprietary sermon manuscripts.**

**v1.5b:** `groups`, `group_members`, `group_invites`, and `drops`. A drop points at a partner or a group member, carries an optional canned line, and is unique per sender, recipient, and local day. Caps: 20 members, 5 partners. Friends are not a table. They are the people in your partnerships and groups. `partner_read_days` is the read-today signal for both.

---

## 10. Success criteria

1. First-time user completes onboarding (incl. book choice) and answers Day 1 QBE in under ~2 minutes.  
2. Returning user: open → ask → Yes → suggested passage → done without dead ends.  
3. “Not today” never shows shame/guilt stack; grace line only.  
4. Commitment, readDone, **bookmark**, and **reflections** survive refresh / relaunch.  
5. Bookmark is unchanged by detours and advances correctly from “Where did you stop?”.  
6. Passage link opens the chosen source with the correct ref. In-app ESV renders today’s passage by default, with no API key on the device, and falls back to the external source when the toggle is off or the proxy fails.  
7. Finishing a book’s last chapter shows Recap → Book finished.  
8. History accurately reflects Yes / Not today / read / unanswered + note / Huh? markers. Any of the last 7 days (not today) that is unanswered or Yes-without-read can be marked read; that day counts for streak and Power of Four; the bookmark moves only when it still sits at that drip’s start.  
9. Light and dark themes meet WCAG AA contrast for text; System follows the OS.  
10. Installable PWA. Ask-time reminder works where the browser/OS allows: Web Push when signed in (iPhone only from the Home Screen app), local notification otherwise.  
11. No account wall. Skipping sign-in leaves the v1 loop intact.  
12. Email code (6–8 digits) signs in a new account and signs in again after sign-out, including from Settings. The installed iPhone PWA leads with the code.  
13. Two devices: the snapshot with the newer `updatedAt` is the one that remains. There is no merge screen.  
14. A partner sees display name and read-done (“Read today” or silence) and can exchange one canned note per sender per day. They cannot see answers, Not today, notes, Huh?, or the book.  
15. Power of Four and the History calendar treat the week as Sunday–Saturday. Default ask time is 6:30 AM.  
16. v1.5b is specified in §3 and is not required for the build that is on main.

---

## 11. Open items

**Resolved in r2**

- ~~Exact outbound Bible site / URL pattern~~ → YouVersion default, configurable (§8)  
- ~~Whether “Huh?” is a toggle, note field, or both~~ → flag on the Reflection  
- ~~Real day-by-day passage schedule~~ → a group plan in this slice uses the drip size on a weekday mask. Church-wide custom schedules stay later  

**Resolved in r3**

- ~~Default ask time if the reader skips~~ → **6:30 AM**  
- ~~Where the ESV key lives, and whether in-app text is on~~ → on by default; key on the server; §4 and §8 agree  
- ~~Partner visibility and the canned note~~ → read-done days + display name; one canned note per sender per day (§8). v1.5b keeps those lines and limits a drop to one per recipient per day (§11)  
- ~~Sync conflict UI~~ → newest `updatedAt` wins; no merge screen  

**Chosen for v1.5b** (constants in `src/domain/social.ts` and `private.group_member_cap()` / `private.partner_cap()`)

- ~~Group size cap~~ → **20** members  
- ~~Partner cap~~ → **5** active partners. v1.5a rows stay one partnership and keep working  
- ~~Drop rate limit~~ → **one drop per sender per recipient per local day**  
- ~~Current book visibility~~ → **no.** Partners and group members do not see the book, answers, Not today, or Huh?. Members never see notes unless you choose to share one  

**Chosen for group plans and shared notes**

- ~~Plan pace~~ → the existing drip size: a few verses, 1 chapter, or 2 chapters  
- ~~Plan and personal reading~~ → Today shows the joined plan’s drip on a reading day. Off days, and readers who have not joined, stay on the personal book. The bookmark does not move for plan days  
- ~~Note sharing~~ → off until that note is shared with chosen groups or partners. Answers, Not today, and Huh? are never shared. A drop on a note uses the existing one-per-pair-per-day drop  

**Still open**

- Final grace one-liner for Not today (tone locked; wording flexible)  
- ESV API terms review (personal, non-commercial; display limits, attribution)  
- Recap: keep “two sittings” chapter distinction or simplify  
- Natural-section labels for long books (e.g. Isaiah 1–39 / 40–66) as tab sub-labels later?  
- **Drops via Web Push.** In-app first. The preferences screen (v1.5·16) already has a switch; sending those pushes is not committed  

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
