# PULSE — AI Fitness Tracker (v2)

A full-stack fitness platform: dashboard, workout & exercise tracking, progress
and analytics, goals, a nutrition log, a local rule-based "PULSE AI Coach",
an activity timeline, and a profile/settings area — all backed by a real
SQLite database. No paid API, no Claude Code required. Pure Node.js + Express
+ SQLite + vanilla JS, runnable entirely offline once installed.

## 1. Folder structure

```
pulse-fitness-tracker/
├── package.json
├── server.js
├── utils.js
├── coachEngine.js
├── db/
│   └── database.js
├── routes/
│   ├── workouts.js
│   ├── exercises.js
│   ├── goals.js
│   ├── nutrition.js
│   ├── progress.js
│   ├── user.js
│   └── insights.js
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── api.js
        ├── charts.js
        ├── views.js
        ├── forms.js
        └── app.js
```

`pulse.db` (the SQLite database) and `node_modules/` are created automatically
the first time you run the app — they are not part of the download.

## 2. What each part does

- **`server.js`** — Express app entry point. Mounts every API route and
  serves the frontend from `public/`.
- **`db/database.js`** — creates all 8 tables on first run (`users`,
  `workouts`, `exercises`, `workout_exercises`, `weight_logs`, `goals`,
  `nutrition`, `activity_logs`) and seeds a small amount of demo data,
  clearly flagged `is_demo = 1` so you can tell it apart from data you enter.
- **`routes/*.js`** — one file per resource, implementing the REST API
  (`GET/POST/PUT/DELETE`) described below.
- **`coachEngine.js`** — the "PULSE AI Coach": a local, rule-based engine
  that reads your actual workout history from SQLite (frequency, streaks,
  rest days, duration trend, intensity) and generates coaching messages.
  No external AI API is called.
- **`public/js/api.js`** — fetch wrapper for every endpoint.
- **`public/js/views.js`** — one render function per sidebar section.
- **`public/js/forms.js`** — the modal forms (log workout, add exercise,
  update weight, create goal, log food).
- **`public/js/app.js`** — sidebar + hash-based router (`#dashboard`,
  `#workouts`, etc.) tying it all together as a single-page app.

## 3. API routes

```
GET    /api/dashboard
GET    /api/workouts            (supports ?search=&type=&from=&to=)
GET    /api/workouts/:id
POST   /api/workouts
PUT    /api/workouts/:id
DELETE /api/workouts/:id

GET    /api/exercises           (supports ?search=&muscle_group=&category=&difficulty=)
POST   /api/exercises

GET    /api/progress
POST   /api/progress/weight

GET    /api/analytics?range=7|30|90|365

GET    /api/goals
POST   /api/goals
PUT    /api/goals/:id
DELETE /api/goals/:id

GET    /api/nutrition           (?date=<ms> for one day, ?range=week for the chart)
POST   /api/nutrition
DELETE /api/nutrition/:id

GET    /api/coach

GET    /api/activity

GET    /api/profile
PUT    /api/profile
GET    /api/settings
PUT    /api/settings
POST   /api/settings/reset
```

Every number on the dashboard and analytics pages (workout counts, calories,
streaks, chart data) is computed from real SQLite rows at request time —
nothing is hardcoded.

## 4. Installation instructions

You need [Node.js](https://nodejs.org) v18 or newer (includes `npm`).

1. Extract the ZIP anywhere on your computer.
2. Open a terminal **in the extracted `pulse-fitness-tracker` folder** (the
   one that directly contains `package.json`).
3. Run:
   ```bash
   npm install
   ```
   This downloads three packages — `express`, `cors`, `better-sqlite3` —
   into a new `node_modules` folder. Requires an internet connection; only
   needed once.
4. Run:
   ```bash
   npm start
   ```
   You should see:
   ```
   PULSE server running at http://localhost:3000
   ```
5. Open **http://localhost:3000** in your browser.

## 5. Exact VS Code instructions

1. **File → Open Folder…** → select the `pulse-fitness-tracker` folder.
2. **Terminal → New Terminal**.
3. In that terminal: `npm install`, then `npm start`.
4. Open `http://localhost:3000` in your browser — VS Code doesn't display
   the app itself, it just runs the server in the terminal.
5. Leave that terminal running while you use the app. `Ctrl+C` stops the
   server; run `npm start` again to restart (no need to `npm install` again).

## 6. Troubleshooting

**`npm install` fails / `node-gyp` errors mentioning Python or a C++ compiler**
`better-sqlite3` compiles a small native module on install. On Windows this
usually needs the "Desktop development with C++" workload from Visual Studio
Build Tools; on macOS, run `xcode-select --install` first; on Linux,
`sudo apt install build-essential python3`. Then re-run `npm install`.

**`Error: Cannot find module 'express'` when running `npm start`**
`npm install` wasn't run, or was run in the wrong folder. Make sure you're
in the folder containing `package.json`, then run `npm install` again.

**Browser shows "Could not reach the PULSE server"**
The Node process isn't running. Go back to the VS Code terminal and confirm
you see `PULSE server running at http://localhost:3000`; if the terminal
was closed, run `npm start` again.

**Port 3000 already in use**
Another program is using that port. Run the server on a different port:
```bash
PORT=3001 npm start        # macOS/Linux
set PORT=3001 && npm start # Windows (cmd)
```
Then open `http://localhost:3001` instead.

**Dashboard looks empty / weird numbers**
On first run PULSE seeds a handful of demo rows (marked with a "Demo" badge)
so the dashboard isn't blank. Delete `pulse.db` and restart the server to
reset to a fresh seeded state, or use **Settings → Reset all data** to wipe
everything (including demo data) and start from zero.

**I want a completely empty database**
Stop the server, delete `pulse.db` from the project folder, edit
`db/database.js` and comment out the `seed();` call near the bottom, then
restart. All tables will exist but stay empty until you add your own data.

## 7. Notes for your project writeup

- The "AI" in PULSE AI Coach is a transparent, rule-based engine reading
  real SQLite data — not a trained model — which is worth stating explicitly
  rather than overselling it as machine learning.
- Calorie estimates use standard MET (metabolic equivalent) values, a
  legitimate, widely used approximation method.
- Demo/seed data is clearly separated from user-entered data via an
  `is_demo` flag on the relevant tables, and shown with a "Demo" badge in
  the UI.
