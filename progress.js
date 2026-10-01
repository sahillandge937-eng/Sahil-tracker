// progress.js
const express = require('express');
const router = express.Router();

const {
  db,
  daysAgo,
  logActivity,
  getUser,
  getRequestUserId
} = require('./utils');

// GET /api/progress
router.get('/', (req, res) => {
  const userId = getRequestUserId(req);
  const user = getUser(userId) || {};

  const history = db.prepare(`
    SELECT *
    FROM weight_logs
    WHERE user_id = ?
    ORDER BY date ASC
  `).all(userId);

  const first = history[0];
  const latest = history[history.length - 1];

  const goalWeight = user.goal_weight_kg;

  const startWeight =
    first ? first.weight_kg : user.weight_kg;

  const currentWeight =
    latest ? latest.weight_kg : user.weight_kg;

  const change =
    currentWeight != null && startWeight != null
      ? Math.round((currentWeight - startWeight) * 10) / 10
      : null;

  let progressPct = null;

  if (
    goalWeight &&
    startWeight != null &&
    currentWeight != null
  ) {
    const span =
      Math.abs(startWeight - goalWeight) || 1;

    progressPct = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (1 -
            Math.abs(currentWeight - goalWeight) /
              span) * 100
        )
      )
    );
  }

  // Workout consistency - last 30 days
  const cutoff30 = daysAgo(29);

  const workouts30 = db.prepare(`
    SELECT date
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
  `).all(userId, cutoff30);

  const uniqueDays = new Set(
    workouts30.map(w =>
      new Date(w.date).toDateString()
    )
  ).size;

  const consistencyPct =
    Math.round((uniqueDays / 30) * 100);

  // Strength progression
  const strength = db.prepare(`
    SELECT
      e.name,
      MAX(we.weight_kg) AS max_weight,
      MAX(w.date) AS last_date
    FROM workout_exercises we
    JOIN exercises e
      ON e.id = we.exercise_id
    JOIN workouts w
      ON w.id = we.workout_id
    WHERE we.weight_kg IS NOT NULL
      AND w.user_id = ?
    GROUP BY e.id
    ORDER BY max_weight DESC
    LIMIT 8
  `).all(userId);

  // Duration trend - last 7 days
  const durationTrend = [];

  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);

    const total = db.prepare(`
      SELECT COALESCE(SUM(duration_min), 0) AS m
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
    `).get(
      userId,
      day,
      day + 86400000
    ).m;

    durationTrend.push({
      date: day,
      minutes: total
    });
  }

  res.json({
    startWeight,
    currentWeight,
    goalWeight,
    change,
    progressPct,
    history,
    consistencyPct,
    strength,
    durationTrend
  });
});

// POST /api/progress/weight
router.post('/weight', (req, res) => {
  const userId = getRequestUserId(req);

  const { weight, date } = req.body || {};

  const w = Number(weight);

  if (
    !Number.isFinite(w) ||
    w <= 0 ||
    w > 500
  ) {
    return res.status(400).json({
      error: 'Enter a valid weight'
    });
  }

  const ts = Number(date) || Date.now();

  const info = db.prepare(`
    INSERT INTO weight_logs
    (
      weight_kg,
      date,
      is_demo,
      user_id
    )
    VALUES (?, ?, 0, ?)
  `).run(
    w,
    ts,
    userId
  );

  db.prepare(`
    UPDATE users
    SET weight_kg = ?
    WHERE id = ?
  `).run(
    w,
    userId
  );

  logActivity(
    'weight',
    `Updated weight to ${w} kg`,
    ts,
    userId
  );

  const entry = db.prepare(`
    SELECT *
    FROM weight_logs
    WHERE id = ?
      AND user_id = ?
  `).get(
    info.lastInsertRowid,
    userId
  );

  res.status(201).json(entry);
});

module.exports = router;
