# Life Tracker

Offline personal tracker PWA for meds, prayer, to-dos and fitness. The full spec is in [life-tracker-spec.md](life-tracker-spec.md).

## Status

- [x] **Step 1:** PWA shell, manifest, service worker, offline support, tab bar, theme, IndexedDB, day-logic helpers, Backup export/import
- [ ] Step 2: Meds
- [ ] Step 3: Prayer
- [ ] Step 4: To-Do
- [ ] Step 5: Fitness
- [ ] Step 6: More (Habits, Money, Journal, Settings)
- [ ] Step 7: Home dashboard
- [ ] Step 8: Polish

## Develop

```sh
npm install
npm run dev       # dev server, also reachable on your LAN
npm test          # day-logic tests (run in Europe/Berlin to cover DST)
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

## Architecture notes

- **Day logic** (`src/lib/day.ts`): dates are `YYYY-MM-DD` *day keys*. The app day runs 05:00 → 05:00 (`todayKey`, `hasDayEnded`); the prayer day switches at Fajr (`prayerDayKeyAt`). `useToday()` re-renders at the rollover and whenever the app returns to the foreground.
- **Data** (`src/lib/db.ts`): one Dexie database. Each build step adds its tables with a new `db.version(n)`. Store only plain JSON values, with dates as day keys or epoch ms, so backups stay lossless.
- **Backup** (`src/lib/backup.ts`): exports every table except `meta` (device-local bookkeeping such as the last backup time). Import is a full replace inside one transaction, so a failed import leaves the current data untouched.
- **Routing** (`src/lib/router.ts`): hash routes, so the app works from any static host path and Android's back gesture moves through pages. Bottom sheets add a history entry, so back closes the sheet first.
- **Shared UI** (`src/components`): `TopBar`, `DayNav`, `Sheet`, `TabBar`, plus small primitives in `ui.tsx`. `src/lib/intents.ts` builds the Android intent links for Tarteel and Lyfta.
