# Life Tracker

Offline personal tracker for meds, prayer, to-dos, fitness and finance: a PWA, also packaged as an Android app. The full spec is in [life-tracker-spec.md](life-tracker-spec.md).

## What's in it

- **Home**: read-only overview of the day (next prayer with countdown, doses, to-dos, next lecture, next exam/deadline, training, nutrition rings), backup reminder, More button.
- **Meds**: scheduled meds (daily / every other day / picked days / repeating cycles like "1 week daily, 2 weeks every other day, 3 weeks break", several doses a day) as dose checkboxes, as-needed meds with timed logs, missed-day calendar. Edits apply from today on; removing archives.
- **Prayer** (Prayers | Quran | Fasting):
  - *Prayers*: offline times (adhan), Fajr-based prayer day, On time / Late / Qada + Jama'ah, Jumu'ah on Fridays, sunnah/witr and adhkar, automatic qada counter, streak calendar, Qibla compass.
  - *Quran*: built-in Arabic reader (Tanzil Uthmani text, 604 Madani pages, Amiri Quran font, RTL), go to surah / juz / page, resumes where you left off, bookmarks, pages logged automatically after 15 s plus manual entry, daily page goal, khatma progress and counter.
  - *Fasting*: mark fasts (Ramadan / sunnah / qada / other), Ramadan grid, qada fast counter fed by missed Ramadan days, sunnah fast hints (Mon/Thu, white days, Ashura, Arafah) from an offline Umm al-Qura Hijri calendar.
- **To-Do**: lists with color and icon, quick add, subtasks, due date and time, priority, repeats, All / Today / Upcoming views, focus card that pops a list out over a blurred page. **Uni** view: semester dates, timetable (today / week), exams and deadlines with days left, each linkable to a prep list.
- **Fitness**: split days in weekday or cycle mode, Trained button and streak, "Change today", nutrition quick-add vs. targets, bodyweight trend chart, Lyfta CSV stats (weekly volume, PRs), Open Lyfta button.
- **More**: Habits, Finance (below), Journal (mood + text, search), Important Dates (yearly, days left), Shopping List (frequent items, clear ticked), Settings, Backup.

- **Finance** (Android app only for syncing; read-only): Commerzbank Girokonto over FinTS 3.0 with photoTAN.
  - *Overview*: balance, last sync and Sync button, a bar per category for this month against your monthly limit (orange near, red over; Subscriptions and Gym show "Paid" when full), uncategorised count, recent transactions.
  - *Insights*: spending per month for each category and the month-end balance, for 3 / 6 / 12 months or everything.
  - *Subscriptions*: recurring payments found automatically (same payee, similar amount, regular interval) with the monthly total; remove wrong ones.
  - *Activity*: search, filter by month and category, tap to change the category (offers "apply to all similar", which makes a rule) or add a note.
  - *Import*: the Import button reads statement files: the CSV export from Commerzbank online banking (Umsätze → Export → CSV), most other German banks' CSVs, and MT940 (.sta). It shows how many rows are new before adding them. Works on the website too. PDF statements can't be read.
  - Categories are fixed: Groceries, Food, Subscriptions, Gym, Other, plus Income and Transfer, which never count as spending. Rules (payee/purpose contains …) can be viewed, edited, reordered and deleted.

## Develop

```sh
npm install
npm run dev       # dev server, also reachable on your LAN
npm test          # logic tests (run in Europe/Berlin to cover DST)
npm run build     # production build in dist/
npm run preview   # serve the build locally, service worker included
```

## Install on the phone

Chrome only installs a PWA from **HTTPS**, so the build has to be hosted.

1. Push this folder to a GitHub repo on the `main` branch.
2. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. Every push to `main` then tests, builds and deploys the app (`.github/workflows/deploy.yml`).
3. On the S25, open `https://<user>.github.io/<repo>/` in **Chrome**, then tap **⋮ → Add to home screen → Install**.
4. Open it from the app drawer. In **More → Settings → App status**, "Works offline" should say *Ready*, "Installed app" should say *Yes*, and "Persistent storage" should say *Granted*.
5. To check offline mode: turn on airplane mode, swipe the app away, and open it again.

When a new version is deployed, the app shows a **Reload** prompt. It never reloads on its own while you're filling in a form.

## Android app

The Android app is the same web build wrapped with [Capacitor](https://capacitorjs.com) (`capacitor.config.ts`, `android/`). It is needed for the bank sync: the Commerzbank server blocks browsers (CORS), so bank requests go through Android's own HTTP stack, and the login and PIN go into Android's secure storage.

### One-time setup (signing password)

Android only installs an update when it is signed with the same key as the installed app. The deploy workflow creates that key on its first run and stores it in the repo **encrypted** (`android/signing/release.jks.enc`). It needs one password from you:

1. On GitHub, open the repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `ANDROID_SIGNING_PASSWORD`. Value: a password of at least 12 characters that you keep somewhere safe. Save.
3. Open **Actions → Build website and Android app → Run workflow** (or push any change).

Never change or delete this secret: a new key can't update the installed app (you'd have to uninstall it, which deletes its data).

### Install or update the app

Every push to `main` builds a signed APK and publishes it as a release.

1. On the S25, open `https://github.com/<user>/<repo>/releases/latest` in Chrome and tap **life-tracker.apk**.
2. Open the download. The first time, Android asks to allow installs from Chrome: **Settings → Allow from this source**, then go back.
3. Tap **Install** (or **Update**). Play Protect may say it doesn't know the app: tap **More details → Install anyway**.

Updating installs over the old app and keeps all data. In the app, **More → Settings → App status → Updates → Check now** compares your build with the newest release.

### Moving your data from the website

The website and the Android app keep separate data (Android keeps them apart). Once: in the website, **More → Backup → Share/Download backup file**; in the Android app, **More → Backup → Restore** and pick the file. Afterwards use the Android app. The app has Android backups turned off, so nothing leaves the phone; use **Backup** to save a copy (Share, or Download to *Documents/Life Tracker*).

### Rebuild locally (optional)

Needs Node 22, JDK 21 and the Android SDK:

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
```

`node scripts/android-icons.mjs` regenerates the launcher icons and splash from `public/favicon.svg`.

## Bank sync (Commerzbank, FinTS)

- **Library**: [lib-fints](https://github.com/robocode13/lib-fints) (LGPL-2.1, maintained, TypeScript). It supports decoupled TAN ("approve in the app") and has no payment orders at all; the app only sends dialog setup, account statements (HKKAZ/HKCAZ) and balance (HKSAL). It is not yet listed as tested with Commerzbank, so the first real sync is the test: if it fails, open **Finance settings → Last sync log** (it never contains your PIN or TAN) and send a screenshot.
- **Product registration**: German banks only accept registered FinTS software. Register for free at fints.org (Produktregistrierung) and enter the number in **Finance settings**. It is never in the code. Until you have one the field can stay empty: the app then connects as "UNREGISTERED" (never with another product's number), which Commerzbank will most likely refuse, and says so.
- **Setup** (Finance settings): product registration number, the Girokonto IBAN (gives the bank code), the login number (Teilnehmernummer) and the PIN. Login and PIN live only in Android secure storage. Switch off **Save PIN** to type it on every sync.
- **TAN**: the app picks the two-step method Commerzbank offers for your login (preferring photoTAN with app approval), never the single-step 999. While you approve it shows **Approve in the photoTAN app** and checks the bank every few seconds (up to 5 minutes). The method can be changed in Finance settings after the first sync.
- **What a sync fetches**: everything the bank allows on the first sync (often about 90 days), afterwards from a week before the newest stored transaction. Duplicates are recognised by a hash of date, amount, payee and purpose.
- **Imports and sync together**: a file and the bank describe the same booking with different text, so across the two sources a stored row with the same day and amount counts as the same transaction (one for one, so two equal coffees stay two). Re-importing a file or syncing after an import adds nothing twice.
- **Safety**: nothing is written until the bank has answered completely and every row has been checked; then one database transaction only *adds* rows plus the balance. A wrong PIN, TAN timeout, cancelled approval or an unreachable bank changes nothing. Notes and categories you set are never overwritten.

## Quran text

The Quran text and page data come from [Tanzil.net](https://tanzil.net). `scripts/fetch-tanzil.mjs` downloads them during the deploy build (into the git-ignored `src/data/tanzil/`), checks them (6236 ayat, 114 surahs, 604 pages, 30 juz) and the app bundles the text file unmodified. A test (`src/lib/features.test.ts`) checks the real data whenever it is present. Without the files (e.g. a local build where tanzil.net is unreachable) the app still builds and the Quran section says the text isn't included.

## Tajweed mushaf

The reader shows the KFGQPC V4 (1441H) tajweed mushaf: 604 pages of 15 printed lines with the tajweed colours and ayah rosettes.

- **Layout** (which glyphs are on which line) is QUL's open data (qul.tarteel.ai, mushaf layout 19). `scripts/fetch-mushaf.mjs` downloads the two exports during the deploy build, checks them (604 pages, 9,046 lines, 83,668 words, one marker per ayah, known pages) and writes `src/data/mushaf/qpc-v4.json` (git-ignored).
- **Fonts** are © King Fahd Glorious Qur'an Printing Complex (free for non-commercial, charitable use; not for sale; publishing needs permission). The app does **not** host them: the phone downloads them once from QUL's CDN into Cache Storage (`src/lib/mushaf.ts`) and reads offline afterwards. Until a page's font is available the reader shows that page as Tanzil text.
- Rendering follows tlawat/remotion-mushaf-line (MIT): words at the font's own advances, each full line scaled to the measure, QUL's light/dark palettes via `@font-palette-values`.

## Architecture notes

- **Day logic** (`src/lib/day.ts`): dates are `YYYY-MM-DD` *day keys*. The app day runs 05:00 → 05:00 (`todayKey`, `hasDayEnded`); the prayer day switches at Fajr (`prayerDayKeyAt`). `useToday()` re-renders at the rollover and whenever the app returns to the foreground.
- **Data** (`src/lib/db.ts`): one Dexie database. Each build step adds its tables with a new `db.version(n)`. Store only plain JSON values, with dates as day keys or epoch ms, so backups stay lossless.
- **Backup** (`src/lib/backup.ts`): exports every table except `meta` (device-local bookkeeping such as the last backup time). Import is a full replace inside one transaction, so a failed import leaves the current data untouched.
- **Finance** (`src/lib/finance.ts`, `bankSync.ts`, `fints.ts`, `native.ts`): pure categorisation, totals and subscription detection; the sync orchestration with its add-only transaction; the FinTS connector with the native HTTP transport; secure storage. Tests in `src/lib/finance.test.ts` include a fake Commerzbank (decoupled TAN polling, wrong PIN, timeout, cancel, dedupe, failure leaves data untouched).
- **Routing** (`src/lib/router.ts`): hash routes, so the app works from any static host path and Android's back gesture moves through pages. Bottom sheets add a history entry, so back closes the sheet first.
- **Feature logic** (`src/lib/meds.ts`, `prayer.ts`, `todo.ts`, `fitness.ts`, `habits.ts`): pure functions with unit tests in `src/lib/*.test.ts`; pages in `src/pages/` only render and write.
- **Overlays** (`src/lib/backstack.ts`): every sheet and the focus card registers with a back-gesture stack, so Android back closes only the topmost one.
- **Shared UI** (`src/components`): `TopBar`, `DayNav`, `Sheet`, `MonthCalendar`, `Charts`, `TabBar`, plus primitives in `ui.tsx`. Each section sets `data-sec`, which switches the accent color. `src/lib/intents.ts` builds the Android intent link for Lyfta.
