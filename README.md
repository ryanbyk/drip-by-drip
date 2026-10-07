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

Answers, bookmarks, and notes stay on this device. Today’s passage is read in the app as the ESV. Open passage still uses the Bible source you choose (YouVersion by default, with Bible Gateway, ESV.org, or a custom link). ESV text is loaded through a server proxy, so the Crossway API key is not stored on this device. If in-app ESV is turned off, you are offline, or the request fails, Open passage uses your external source. The app does not bundle a Bible edition. Daily reminders use the browser Notification API when it is available, and otherwise the question is waiting in the app. A signed-in reader can also receive that reminder as a Web Push when the app is closed, where the browser supports it. Guests stay on the local schedule. iPhone delivers Web Push only to the Home Screen app, and iOS may still hold the notification.

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

Open Settings and tap **Sign in**. The same screen is what you get after **Sign out**. In the Home Screen app, the main button emails a code. Type the 6- to 8-digit code from the email in that app. The session is stored there and is still there the next time the app opens, including sync. A sign-in link stays available, with a note that on iPhone the link may open Safari, which does not share the Home Screen app’s storage. In a browser tab, the link stays the main button and **Email me a code** is on that screen and on the check-your-email sheet. The code works for a new account and again after sign-out. After a code is checked, or after a magic link or an OAuth return, the app opens Account. Or tap **Keep using without an account**. Sign out is a real Supabase session. Export downloads the snapshot on this device as JSON.

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

The app sends people back to the current origin plus the Vite base (`/drip-by-drip/`).

**Authentication → Email Templates → Magic link**

The code and the link are the same email. The template has to include `{{ .Token }}` or the message only contains a link and the code field has nothing to accept. Subject: `Your Drip by drip code`. Body:

```html
<h2>Your sign-in code</h2>
<p>Enter this code in Drip by drip:</p>
<p><strong>{{ .Token }}</strong></p>
<p>The code works once. On iPhone, stay in the Home Screen app and type it there.</p>
<p>Or follow this link. On iPhone it may open Safari, which does not share that app’s sign-in.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in with a link</a></p>
```

Email OTP expiration is the same timer the screen calls 15 minutes. Set that under **Authentication → Providers → Email** if it is still the one-hour default and you want the sentence to match. `{{ .Token }}` follows that provider’s email OTP length. The code field accepts 6 to 8 digits, so an 8-digit token can be entered as sent.

**Authentication → Providers**

- Email: leave it enabled. The installed app prefers the code. A browser tab still offers the link.
- Google: enable the provider and paste the Google OAuth client ID and secret. In Google Cloud, the authorized redirect URI is `https://gfacmaaehvlhbskrajyj.supabase.co/auth/v1/callback`.
- Apple: enable the provider and paste the Services ID, Team ID, Key ID, and private key. Apple’s return URL is that same Supabase callback.

The initial release hides the Apple and Google buttons (`socialSignInVisible` in `src/screens/SignIn.tsx`). Leave both providers enabled so those buttons can be shown again without new dashboard setup.

Display names live in `public.profiles` (one row per auth user, RLS so a person can read and update only their own row). A private trigger creates the row when someone signs up.

Reading sync lives in `public.user_snapshots` (`user_id` primary key, `payload` jsonb, `updated_at` timestamptz). RLS lets the signed-in user select, insert, and update only their own row. `anon` has no grants. The client uses the public anon key already in `src/lib/supabaseConfig.ts`. No new Auth URL or provider settings are required for sync.

### Web Push

Ask-time Web Push needs a signed-in account. The browser stores one row in `public.push_subscriptions` (endpoint, `p256dh`, `auth`, user agent, IANA time zone). RLS lets that person select, insert, update, and delete only their own rows, so sign-out and turning reminders off can remove this device. Other devices keep their rows. Deleting the account cascades the rows. Guests are not written here; their reminder stays on the device.

The server reads ask time, reminders, and today’s answer from `user_snapshots` when Sync has saved them. It matches “now” in the device time zone on the subscription (or `prefs.timeZone` when the row has none). Sync should stay on so a changed ask time reaches the server. With Sync off, the last saved snapshot is what the server uses.

`npm run dev` does not register a service worker, so subscribing happens in a production build (`npm run build` and `npm run preview`, or the hosted app).

**Secrets — do not commit the values.** Generate a VAPID key pair and a long random cron secret:

```bash
npx web-push generate-vapid-keys --json
```

Store them as Edge Function secrets on project `gfacmaaehvlhbskrajyj`:

```bash
supabase secrets set --project-ref gfacmaaehvlhbskrajyj \
  VAPID_PUBLIC_KEY="<publicKey>" \
  VAPID_PRIVATE_KEY="<privateKey>" \
  VAPID_SUBJECT="mailto:you@example.com" \
  PUSH_CRON_SECRET="<long random string>"
```

`VAPID_SUBJECT` is optional. It defaults to `mailto:drip@ryanbyk.github.io`. The private key and cron secret never go in the client or the repo. The public key is not a secret. The signed-in app reads it from the `vapid-public-key` function. A build can override that with the GitHub Pages variable `VITE_VAPID_PUBLIC_KEY`.

The minute job `send-ask-push` calls `private.invoke_send_ask_push()`. That function does nothing until Vault has three secrets (names only — create them in the SQL editor, not in a migration):

```sql
select vault.create_secret('https://gfacmaaehvlhbskrajyj.supabase.co', 'project_url');
select vault.create_secret('<legacy anon JWT, role anon>', 'publishable_key');
select vault.create_secret('<same value as PUSH_CRON_SECRET>', 'push_cron_secret');
```

`publishable_key` must be the legacy anon JWT so the function gateway accepts the cron request. The function still requires header `x-cron-secret` before it sends to anyone. A signed-in reader can POST `{ "mode": "test" }` to `send-ask-push` (Settings → Send test Web Push) to deliver the daily question to their own subscriptions without waiting for ask time. `{ "mode": "schedule" }` is the cron path. Expired endpoints (HTTP 404 or 410) are deleted.

Partner nudges are not sent as Web Push in this change.

## Docs

- [Product / app plan](docs/bible-reading-app-plan.md) — purpose, QBE mechanic, MVP scope, UX, tech
- [PRD for pen.dev](docs/prd-pen-dev.md) — v1 goals, screens, behavior rules, success criteria
