# Drip by drip

Private repo for a Bible reading consistency app: a grace-motivated, local-first PWA that uses a daily **question-behavior effect (QBE)** ask—“Will you read God’s word today?”—then unlocks today’s drip.

Grounded in CrossWay’s *Drip by drip* series application notes. **Do not invent sermon text**—use passage references and optional short prompts only.

## Run the app

```bash
npm install
npm run dev
```

Then open the URL Vite prints (`http://localhost:5173/drip-by-drip/`) on a phone-sized window. `npm run build` produces the installable PWA in `dist/`, and `npm run preview` serves that build. `npm test` runs the reading, streak, and persistence checks. `npm run audit:spacing` checks that padding, margin, gap, and inset use the `--space-*` steps from `drip-by-drip.pen` (defined in `src/index.css`) instead of raw pixel lengths.

## Review components

```bash
npm run storybook
```

Opens Storybook at `http://localhost:6006`. Stories load the same fonts and design tokens as the app (`src/index.css`), so buttons, sheets, the tab bar, pickers, icons, and shared cards match the product. The toolbar switches the Light and Dark token sets. `npm run build-storybook` writes a static build to `storybook-static/`.

The hosted app is [https://ryanbyk.github.io/drip-by-drip/](https://ryanbyk.github.io/drip-by-drip/). A push to `main` builds `dist` and deploys it with GitHub Pages, once Pages is enabled for this repo.

Answers, bookmarks, and notes stay on this device. Passage text opens in the Bible source you choose (YouVersion by default, with Bible Gateway, ESV.org, or a custom link). The app does not bundle a Bible edition. Daily reminders use the browser Notification API when it is available, and otherwise the question is waiting in the app.

## Persistence

Screens and the app store never call `localStorage` or IndexedDB themselves. They talk to a `StorageAdapter` (`src/lib/storage`):

- `prefs` — ask time, notifications, appearance, reading mode, Bible source and translation
- `commitments` — each day’s yes / not today
- `progress` — book place
- `notes` — a day’s reflection and “Huh?”
- `load` / `save` — the whole snapshot the store keeps in memory

v1 uses `createLocalStorageAdapter()`. It writes one snapshot to IndexedDB and keeps a localStorage copy; if the two disagree, the newer `updatedAt` wins. There is no account and no network sync.

To use a hosted backend later, implement the same `StorageAdapter` and pass it to `AppProvider`. `SupabaseStorageAdapter` (`src/lib/storage/supabase.ts`) is only a stub: it documents the table shape and throws if called. v1 does not depend on Supabase.

## Docs

- [Product / app plan](docs/bible-reading-app-plan.md) — purpose, QBE mechanic, MVP scope, UX, tech
- [PRD for pen.dev](docs/prd-pen-dev.md) — v1 goals, screens, behavior rules, success criteria
