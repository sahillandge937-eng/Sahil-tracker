// routes/nutrition.js
const express = require('express');
const router = express.Router();

const {
  db,
  daysAgo,
  startOfDay,
  logActivity,
  getUser,
  getRequestUserId
} = require('./utils');

// GET /api/nutrition?date=<ms>
// GET /api/nutrition?range=week
router.get('/', (req, res) => {
  const userId = getRequestUserId(req);

  // ----------------------------------------------------------
  // Weekly nutrition
  // ----------------------------------------------------------
  if (req.query.range === 'week') {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const day = daysAgo(i);

      const total = db.prepare(`
        SELECT COALESCE(SUM(calories), 0) c
        FROM nutrition
        WHERE user_id = ?
          AND date >= ?
          AND date < ?
      `).get(
        userId,
        day,
        day + 86400000
      ).c;

      days.push({
        date: day,
        calories: total
      });
    }

    return res.json(days);
  }

  // ----------------------------------------------------------
  // Daily nutrition
  // ----------------------------------------------------------
  const day = startOfDay(
    req.query.date
      ? Number(req.query.date)
      : Date.now()
  );

  const entries = db.prepare(`
    SELECT *
    FROM nutrition
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
    ORDER BY id DESC
  `).all(
    userId,
    day,
    day + 86400000
  );

  const totals = entries.reduce(
    (acc, e) => {
      acc.calories += Number(e.calories) || 0;
      acc.protein += Number(e.protein_g) || 0;
      acc.carbs += Number(e.carbs_g) || 0;
      acc.fat += Number(e.fat_g) || 0;

      return acc;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }
  );

  const user = getUser(userId) || {};

  res.json({
    date: day,
    entries,
    totals,
    targets: {
      calories: user.calorie_target || 2200,
      protein: user.protein_target || 150,
      carbs: user.carb_target || 250,
      fat: user.fat_target || 70
    }
  });
});

// POST /api/nutrition
router.post('/', (req, res) => {
  const userId = getRequestUserId(req);

  const {
    food_name,
    calories,
    protein,
    carbs,
    fat,
    meal_type,
    date
  } = req.body || {};

  if (
    !food_name ||
    !String(food_name).trim()
  ) {
    return res.status(400).json({
      error: 'Food name is required'
    });
  }

  const cal = Number(calories);

  if (
    !Number.isFinite(cal) ||
    cal < 0
  ) {
    return res.status(400).json({
      error: 'Calories must be a non-negative number'
    });
  }

  const ts = Number(date) || Date.now();

  const info = db.prepare(`
    INSERT INTO nutrition
    (
      food_name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      meal_type,
      date,
      is_demo,
      user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    food_name.trim(),
    Math.round(cal),
    Number(protein) || 0,
    Number(carbs) || 0,
    Number(fat) || 0,
    meal_type || 'Snack',
    ts,
    userId
  );

  logActivity(
    'nutrition',
    `Logged ${food_name.trim()} (${Math.round(cal)} kcal)`,
    ts,
    userId
  );

  const entry = db.prepare(`
    SELECT *
    FROM nutrition
    WHERE id = ?
      AND user_id = ?
  `).get(
    info.lastInsertRowid,
    userId
  );

  res.status(201).json(entry);
});

// DELETE /api/nutrition/:id
router.delete('/:id', (req, res) => {
  const userId = getRequestUserId(req);

  const info = db.prepare(`
    DELETE FROM nutrition
    WHERE id = ?
      AND user_id = ?
  `).run(
    req.params.id,
    userId
  );

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'Entry not found'
    });
  }

  res.status(204).end();
});

module.exports = router;
