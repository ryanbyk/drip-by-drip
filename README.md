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

Answers, bookmarks, and notes stay on this device. Today’s passage is read in the app as the ESV. Open passage still uses the Bible source you choose (YouVersion by default, with Bible Gateway, ESV.org, or a custom link). ESV text is loaded through a server proxy, so the Crossway API key is not stored on this device. If in-app ESV is turned off, you are offline, or the request fails, Open passage uses your external source. The app does not bundle a Bible edition. Daily reminders use the browser Notification API when it is available, and otherwise the question is waiting in the app.

`npm run build` works without extra env. The public Supabase URL and legacy anon key have defaults in `src/lib/supabaseConfig.ts`. GitHub Pages can override them with repository **Variables** (not secrets) named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use the legacy anon JWT (`role` `anon`), not an `sb_publishable_…` key. Do not set `VITE_ESV_API_KEY` or put the Crossway key in the client, the repo, or Actions secrets — that key stays in the Edge Function secret `ESV_API_KEY`.

To try that notification without waiting for ask time, open Settings and tap **Send test reminder**. The control stays on that screen during `npm run dev`, on the hosted app, and in the installed home-screen app. The test asks for notification permission if needed, then uses the same title, question, icon, and service-worker path as the daily reminder. It does not turn the daily reminder on, and it does not mark today as already notified.

## Persistence

Screens and the app store never call `localStorage` or IndexedDB themselves. They talk to a `StorageAdapter` (`src/lib/storage`):

- `prefs` — ask time, notifications, appearance, reading mode, Bible source, translation, and whether today’s passage is read in the app
- `commitments` — each day’s yes / not today
- `progress` — book place
- `notes` — a day’s reflection and “Huh?”
- `load` / `save` — the whole snapshot the store keeps in memory

v1 uses `createLocalStorageAdapter()`. It writes one snapshot to IndexedDB and keeps a localStorage copy; if the two disagree, the newer `updatedAt` wins. An account is optional. Skipping sign-in leaves reading, notes, and reminders on this device, same as before.

Signed in, with Sync on, the app also stores that same snapshot in `public.user_snapshots` (one row per account). On sign-in it keeps whichever copy has the newer `updatedAt`. Guests never call that table. `SupabaseStorageAdapter` (`src/lib/storage/supabase.ts`) is the cloud `StorageAdapter` for that row. The running app still passes the local adapter to `AppProvider` and syncs beside it, so the two implementations stay swappable.

## Optional sign-in

Open Settings and tap **Sign in**. You can continue with Apple, Google, or an email magic link, or tap **Keep using without an account**. After a magic link or OAuth return, the app reads the session from the URL and opens Account. Sign out is a real Supabase session. Export downloads the snapshot on this device as JSON.

Sync defaults to on. The Account switch stores that choice on this device (`drip-by-drip.sync-enabled`). While it is on, sign-in pulls the account snapshot when it is newer than this device (or this device has never saved), and later edits push this device’s snapshot. Turning Sync off stops those reads and writes; the account row is left as it was. The app assumes one primary device, so the newer `updatedAt` wins and there is no merge screen. This device also remembers which account last synced (`drip-by-drip.snapshot-owner`) so a different sign-in does not upload the previous account’s reading.

Delete account calls the `delete-account` Edge Function, which deletes that auth user with the service role on the server. The service role is not in the app. Deleting the auth user also deletes that user’s snapshot row. Reading on this device stays here.

### Supabase dashboard

Project `gfacmaaehvlhbskrajyj` (`https://gfacmaaehvlhbskrajyj.supabase.co`).

**Authentication → URL configuration**

- Site URL: `https://ryanbyk.github.io/drip-by-drip/`
- Redirect URLs:
  - `https://ryanbyk.github.io/drip-by-drip/`
  - `http://localhost:5173/drip-by-drip/`
  - `http://localhost:5173/`

The app sends people back to the current origin plus the Vite base (`/drip-by-drip/`). Magic link uses Supabase’s built-in email. No template change is required once those URLs are allowed.

**Authentication → Providers**

- Email: leave magic link enabled.
- Google: enable the provider and paste the Google OAuth client ID and secret. In Google Cloud, the authorized redirect URI is `https://gfacmaaehvlhbskrajyj.supabase.co/auth/v1/callback`.
- Apple: enable the provider and paste the Services ID, Team ID, Key ID, and private key. Apple’s return URL is that same Supabase callback.

Display names live in `public.profiles` (one row per auth user, RLS so a person can read and update only their own row). A private trigger creates the row when someone signs up.

Reading sync lives in `public.user_snapshots` (`user_id` primary key, `payload` jsonb, `updated_at` timestamptz). RLS lets the signed-in user select, insert, and update only their own row. `anon` has no grants. The client uses the public anon key already in `src/lib/supabaseConfig.ts`. No new Auth URL or provider settings are required for sync.

## Docs

- [Product / app plan](docs/bible-reading-app-plan.md) — purpose, QBE mechanic, MVP scope, UX, tech
- [PRD for pen.dev](docs/prd-pen-dev.md) — v1 goals, screens, behavior rules, success criteria
