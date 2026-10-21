# Life Tracker

Offline personal tracker PWA for meds, prayer, to-dos and fitness. The full spec is in [life-tracker-spec.md](life-tracker-spec.md).

## What's in it

- **Home**: read-only overview of the day (next prayer with countdown, doses, to-dos, next lecture, next exam/deadline, training, nutrition rings), backup reminder, More button.
- **Meds**: scheduled meds (daily / every other day / picked days / repeating cycles like "1 week daily, 2 weeks every other day, 3 weeks break", several doses a day) as dose checkboxes, as-needed meds with timed logs, missed-day calendar. Edits apply from today on; removing archives.
- **Prayer** (Prayers | Quran | Fasting):
  - *Prayers*: offline times (adhan), Fajr-based prayer day, On time / Late / Qada + Jama'ah, Jumu'ah on Fridays, sunnah/witr and adhkar, automatic qada counter, streak calendar, Qibla compass.
  - *Quran*: built-in Arabic reader (Tanzil Uthmani text, 604 Madani pages, Amiri Quran font, RTL), go to surah / juz / page, resumes where you left off, bookmarks, pages logged automatically after 15 s plus manual entry, daily page goal, khatma progress and counter.
  - *Fasting*: mark fasts (Ramadan / sunnah / qada / other), Ramadan grid, qada fast counter fed by missed Ramadan days, sunnah fast hints (Mon/Thu, white days, Ashura, Arafah) from an offline Umm al-Qura Hijri calendar.
- **To-Do**: lists with color and icon, quick add, subtasks, due date and time, priority, repeats, All / Today / Upcoming views, focus card that pops a list out over a blurred page. **Uni** view: semester dates, timetable (today / week), exams and deadlines with days left, each linkable to a prep list.
- **Fitness**: split days in weekday or cycle mode, Trained button and streak, "Change today", nutrition quick-add vs. targets, bodyweight trend chart, Lyfta CSV stats (weekly volume, PRs), Open Lyfta button.
- **More**: Habits, Money (monthly totals by category), Journal (mood + text, search), Important Dates (yearly, days left), Shopping List (frequent items, clear ticked), Settings, Backup.

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

## Quran text

The Quran text and page data come from [Tanzil.net](https://tanzil.net). `scripts/fetch-tanzil.mjs` downloads them during the deploy build (into the git-ignored `src/data/tanzil/`), checks them (6236 ayat, 114 surahs, 604 pages, 30 juz) and the app bundles the text file unmodified. A test (`src/lib/features.test.ts`) checks the real data whenever it is present. Without the files (e.g. a local build where tanzil.net is unreachable) the app still builds and the Quran section says the text isn't included.

## Architecture notes

- **Day logic** (`src/lib/day.ts`): dates are `YYYY-MM-DD` *day keys*. The app day runs 05:00 → 05:00 (`todayKey`, `hasDayEnded`); the prayer day switches at Fajr (`prayerDayKeyAt`). `useToday()` re-renders at the rollover and whenever the app returns to the foreground.
- **Data** (`src/lib/db.ts`): one Dexie database. Each build step adds its tables with a new `db.version(n)`. Store only plain JSON values, with dates as day keys or epoch ms, so backups stay lossless.
- **Backup** (`src/lib/backup.ts`): exports every table except `meta` (device-local bookkeeping such as the last backup time). Import is a full replace inside one transaction, so a failed import leaves the current data untouched.
- **Routing** (`src/lib/router.ts`): hash routes, so the app works from any static host path and Android's back gesture moves through pages. Bottom sheets add a history entry, so back closes the sheet first.
- **Feature logic** (`src/lib/meds.ts`, `prayer.ts`, `todo.ts`, `fitness.ts`, `habits.ts`): pure functions with unit tests in `src/lib/*.test.ts`; pages in `src/pages/` only render and write.
- **Overlays** (`src/lib/backstack.ts`): every sheet and the focus card registers with a back-gesture stack, so Android back closes only the topmost one.
- **Shared UI** (`src/components`): `TopBar`, `DayNav`, `Sheet`, `MonthCalendar`, `Charts`, `TabBar`, plus primitives in `ui.tsx`. Each section sets `data-sec`, which switches the accent color. `src/lib/intents.ts` builds the Android intent link for Lyfta.
