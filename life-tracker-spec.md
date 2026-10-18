# Life Tracker PWA: Full Spec

An all-in-one personal life tracker that runs fully offline on a Samsung Galaxy S25 (Android), built as a Progressive Web App.

---

## 1. General / Technical

### Platform
- **Mobile-first PWA**, installed on Android via **Chrome** ("Add to Home screen" / Install), so it runs as a WebAPK in **standalone display mode** (no browser UI, own icon, splash screen, shows in app drawer).
- Must work **100% offline** after first load. No backend, no accounts, no network calls at runtime.
- Request **persistent storage** (`navigator.storage.persist()`) so the browser doesn't evict data.

### Suggested stack (open to Claude Code's judgement)
- Vite + React + TypeScript
- Tailwind CSS (custom, clean, native-feeling design)
- `vite-plugin-pwa` (Workbox) for the service worker + manifest, precache everything
- IndexedDB via **Dexie** for all data
- **adhan-js** for offline prayer time calculation
- Lightweight chart lib for graphs (e.g. a small SVG chart, avoid heavy deps)

### Design
- Designed for phone width from the start, nothing desktop-first
- Respect **safe-area insets** (status bar, gesture bar)
- Large touch targets, no hover-dependent UI, no pinch zoom
- Light / dark / follow system theme
- Smooth, native-like transitions and animations
- Bottom sheets / modals for add and edit forms

### Navigation
- **Bottom tab bar with 5 tabs:** Home, Meds, Prayer, To-Do, Fitness
- **More** is not a tab. It opens from a button in the top corner of the Home screen.

### Day logic (important)
- **Default "day" runs from 05:00 to 05:00.** Between 00:00 and 05:00 the app still treats it as the previous day. Applies to Home, Meds, To-Do, Fitness, Habits, Journal, Money default date.
- **Prayer tab exception:** the prayer day switches at **Fajr** time (see Prayer section).
- A day only counts as "missed" once it has ended under these rules.

### Day navigation (shared component)
- Top of a page shows weekday + date with ◀ ▶ arrows to move one day back/forward
- Tapping the date jumps back to today
- Future days are visible but locked (can't check things off)
- Past days can be edited / checked off retroactively

### Overview button (shared pattern)
- Small button in a corner of the top bar that opens an overview calendar for that tab (Meds, Prayer)
- Calendar highlights days with missed items in **red**, nothing else colored
- Tapping a day jumps to that day in the main view

### Launching other apps (Android intent links)
- Buttons that open other installed apps use Android **intent URLs** with the package name and a Play Store fallback, e.g.:
  `intent://#Intent;package=com.lyfta;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.lyfta;end`
- Package names:
  - **Tarteel:** `com.mmmoussa.iqra`
  - **Lyfta:** `com.lyfta`
- Verify on the actual device that the intent launches correctly from the installed PWA.

### Notifications
- Out of scope for v1. A fully offline PWA can't reliably fire scheduled notifications. The app shows what's due / missed when opened.

---

## 2. Home

A **read-only overview of the day**, like the Fitbit or Apple Health home screen.

### Top bar
- Greeting + today's date
- **More** button in the corner

### Cards (fixed layout, same every day)
- **Prayer:** next prayer + countdown, today's 5 prayers as status dots
- **Medications:** progress like "3 of 5 doses taken" + what's still left today
- **To-dos:** count of due today + overdue, top few listed
- **Training:** today's split day + whether it's marked trained
- **Nutrition:** minimal, calories and protein as two small numbers or rings vs. targets

### Behavior
- **No checkboxes, no interaction** besides tapping a card to open its tab
- Nothing collapses or reorders
- Uses the 05:00 day rollover

---

## 3. Medications (Meds tab)

### Add medication (+ button)
- **Name**
- **Type:** Scheduled or As needed
- **Days** (scheduled only):
  - Daily
  - Every other day
  - Custom: opens a calendar, tap to select multiple specific days
- **Doses per day:** number, creates that many slots labeled Dose 1, Dose 2, ...
- **Start date**
- **End date** (for everything except Custom): pick a date or "No end date"

### Main view
- Day navigation at the top
- Scheduled meds due that day, each with its dose slots as checkboxes (e.g. `Ibuprofen  ☐ Dose 1  ☐ Dose 2`)
- **As-needed** meds in a separate section with a "Log dose" button, showing how many were taken that day and at what time
- Empty state when nothing is due

### Overview (corner button)
- Calendar of past days, days with any missed scheduled dose in **red**
- A day counts as missed only after it ends (05:00 next morning)
- As-needed meds never count as missed

### Editing / deleting
- Changing a schedule only affects days from now on, past history stays as it was
- Deleting **archives** the med: hidden from new days, kept in history and the overview

---

## 4. Prayer

### Day logic
- The prayer day switches at **Fajr**: Isha stays on the previous day until Fajr comes in
- Day navigation at the top, future days locked

### Prayer times (offline)
- Calculated with adhan-js from the location set in Settings (city or coordinates)
- Settings: calculation method (e.g. Muslim World League, Egyptian), Asr method (Shafi'i / Hanafi), high-latitude rule (needed in German summers)
- Top of the page: **next prayer + countdown**

### Daily list
- Fajr, Dhuhr, Asr, Maghrib, Isha with times
- On Fridays, **Jumu'ah** replaces Dhuhr
- Each prayer has a status: **On time / Late / Qada**
- **Jama'ah / mosque** toggle per prayer
- Optional **sunnah prayers and Witr** as extra checkboxes (never count as missed)
- **Morning and evening adhkar** checkboxes (never count as missed)

### Qada counter
- Running count of owed prayers, starting value set manually
- Any prayer still unlogged when the prayer day ends is marked missed and **adds 1** automatically
- Marking a prayer as made up (Qada) **subtracts 1**

### Overview (corner button)
- Calendar with days that have a missed prayer in **red**
- **Streak:** consecutive days with all 5 prayed (on time or late both count)
- Tap a day to jump to it

### Extras
- **Qibla compass** using the device orientation sensor (works offline, handle permission prompt)
- **Tarteel button** in this tab's top bar (intent link, Play Store fallback)

---

## 5. To-Do

### Day logic
- 05:00 rollover for what counts as "today" / overdue

### Lists (subjects)
- Create any number of lists, each with name + color/icon
- Rename, reorder, archive

### Tasks
- Title, optional note
- Optional due date (+ optional time)
- Optional priority (high / normal)
- **Subtasks:** checklist inside a task
- **Recurring:** daily, specific weekdays, monthly, etc. Completing one creates the next occurrence
- Overdue tasks shown in **red**
- **Quick add bar** at the top: type + enter adds to the current list (or a default list in Today/Upcoming)

### Views (toggle at the top)
- **All (default):** every list as a collapsible section with its open tasks
- **Today:** due today + overdue across all lists
- **Upcoming:** dated tasks grouped by day for the next ~2 weeks

### Focus mode (tap a list's header)
- The list **pops out as a card** in the middle of the screen with a zoom animation, like long-pressing a chat in iMessage/WhatsApp
- Rest of the page **blurred and dimmed** behind it
- Card takes a large part of the screen but not all of it, scrolls independently
- Shows **everything in that list, past and present:** completed tasks greyed out, open tasks normal, overdue in red
- Tasks can be checked off and quick-added inside the card
- **Tap the blurred background or swipe the card down** to close

---

## 6. Fitness

Workout set logging stays in **Lyfta**. This tab covers the split overview, bodyweight and nutrition.

### Top bar
- **Open Lyfta** button (intent link, Play Store fallback)

### Split
- **+ button** to create split days (e.g. Push, Pull, Legs, Upper, Rest), each with a list of exercises (name, optional target sets × reps like 4×8)
- Edit, reorder, delete split days and exercises
- **Two modes** (switch in split settings):
  - **Weekday mode:** each split day assigned to a weekday (Monday = Legs)
  - **Cycle mode:** split days in order + start date, rotating day by day regardless of weekday

### Today card
- Today's split day with its exercise list as a quick overview
- **"Trained ✓"** button marks the session done (feeds a training calendar and streak)
- **"Change today"** button opens a picker of all split days:
  - **Weekday mode:** one-off swap for today only (e.g. Legs → Upper). Weekly plan unchanged, log records what was actually trained
  - **Cycle mode:** resets the position in the cycle, so after a skipped day you pick the step to restart from and the rotation continues from there

### Bodyweight
- Quick daily entry
- Trend graph (week / month / all)

### Nutrition
- Daily **calories and protein**, each vs. a target (set in Settings)
- Quick-add number buttons (no food database), progress bar for each
- Edit / undo the day's entries

### Lyfta import (optional)
- Load a CSV exported from Lyfta
- Show stats like weekly volume and PRs per exercise

---

## 7. More

Opens from the corner button on Home. Grid of tiles: **Habits, Money, Journal, Settings, Backup**.

### Habits
- **+ button** to add a habit with name + icon
- Frequency: daily, specific weekdays, or X times per week
- Today's habits as simple checkboxes
- Day navigation
- No streaks, no overview calendar

### Money
- **+ button** to add an expense: **category, description, amount** (date defaults to today, editable)
- User-defined categories (add / rename)
- Expenses grouped by month, month total at the top
- Tap an entry to edit or delete
- Expenses only, no income

### Journal
- One entry per day, day navigation
- **Mood 1 to 5** per day
- Search through past entries

### Settings
- Prayer: location, calculation method, Asr method, high-latitude rule
- Fitness: calorie and protein targets, split mode
- Theme: light / dark / follow system
- Manage categories and lists (money categories, to-do lists, habits)

### Backup
- **Export** all data to a single JSON file (save to Drive, send to self, etc.)
- **Import** a backup file to restore
- Reminder if no backup in ~2 weeks

---

## 8. Suggested build order
1. Project setup: PWA shell, manifest, service worker, offline check, tab bar, theme, IndexedDB, day-logic helpers, Backup export/import
2. Meds tab
3. Prayer tab
4. To-Do tab
5. Fitness tab
6. More (Habits, Money, Journal, Settings)
7. Home dashboard (reads from all of the above)
8. Polish: animations, focus mode pop-out, testing installed on the S25
