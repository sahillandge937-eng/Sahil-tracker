// routes/progress.js
const express = require('express');
const router = express.Router();
const { db, daysAgo, logActivity, getUser } = require('../utils');

// GET /api/progress -> weight summary + history + workout consistency + strength progression
router.get('/', (req, res) => {
  const user = getUser() || {};
  const history = db.prepare('SELECT * FROM weight_logs ORDER BY date ASC').all();
  const first = history[0];
  const latest = history[history.length - 1];
  const goalWeight = user.goal_weight_kg;

  const startWeight = first ? first.weight_kg : user.weight_kg;
  const currentWeight = latest ? latest.weight_kg : user.weight_kg;
  const change = currentWeight != null && startWeight != null ? Math.round((currentWeight - startWeight) * 10) / 10 : null;

  let progressPct = null;
  if (goalWeight && startWeight != null && currentWeight != null) {
    const span = Math.abs(startWeight - goalWeight) || 1;
    progressPct = Math.max(0, Math.min(100, Math.round((1 - Math.abs(currentWeight - goalWeight) / span) * 100)));
  }

  // Workout consistency over the last 30 days: % of days with a workout.
  const cutoff30 = daysAgo(29);
  const workouts30 = db.prepare('SELECT date, duration_min FROM workouts WHERE date >= ?').all(cutoff30);
  const uniqueDays = new Set(workouts30.map(w => new Date(w.date).toDateString())).size;
  const consistencyPct = Math.round((uniqueDays / 30) * 100);

  // Strength progression: max weight lifted per exercise, most recent first.
  const strength = db.prepare(`
    SELECT e.name, MAX(we.weight_kg) as max_weight, w.date as last_date
    FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.weight_kg IS NOT NULL
    GROUP BY e.id
    ORDER BY max_weight DESC
    LIMIT 8
  `).all();

  // Duration trend, last 7 days.
  const durationTrend = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const total = db.prepare('SELECT COALESCE(SUM(duration_min),0) m FROM workouts WHERE date >= ? AND date < ?')
      .get(day, day + 86400000).m;
    durationTrend.push({ date: day, minutes: total });
  }

  res.json({
    startWeight, currentWeight, goalWeight, change, progressPct,
    history, consistencyPct, strength, durationTrend
  });
});

// POST /api/weight
router.post('/weight', (req, res) => {
  const { weight, date } = req.body || {};
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0 || w > 500) return res.status(400).json({ error: 'Enter a valid weight' });

  const ts = Number(date) || Date.now();
  const info = db.prepare('INSERT INTO weight_logs (weight_kg, date, is_demo) VALUES (?, ?, 0)').run(w, ts);
  db.prepare('UPDATE users SET weight_kg = ? WHERE id = 1').run(w);
  logActivity('weight', `Updated weight to ${w} kg`, ts);

  res.status(201).json(db.prepare('SELECT * FROM weight_logs WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
