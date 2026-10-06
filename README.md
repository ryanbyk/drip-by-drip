# Drip by drip

Private repo for a Bible reading consistency app: a grace-motivated, local-first PWA that uses a daily **question-behavior effect (QBE)** ask—“Will you read God’s word today?”—then unlocks today’s drip.

Grounded in CrossWay’s *Drip by drip* series application notes. **Do not invent sermon text**—use passage references and optional short prompts only.

## Run the app

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`) on a phone-sized window. `npm run build` produces the installable PWA in `dist/`, and `npm run preview` serves that build. `npm test` runs the reading, streak, and persistence checks.

Answers, bookmarks, and notes stay on this device (IndexedDB, with a localStorage copy). Passage text opens on Bible Gateway; the app does not bundle a Bible edition. Daily reminders use the browser Notification API when it is available, and otherwise the question is waiting in the app.

## Docs

- [Product / app plan](docs/bible-reading-app-plan.md) — purpose, QBE mechanic, MVP scope, UX, tech
- [PRD for pen.dev](docs/prd-pen-dev.md) — v1 goals, screens, behavior rules, success criteria
