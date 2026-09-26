// routes/nutrition.js
const express = require('express');
const router = express.Router();
const { db, daysAgo, startOfDay, logActivity, getUser } = require('../utils');

// GET /api/nutrition?date=<ms>   (defaults to today) -> entries + daily totals + target
// GET /api/nutrition?range=week  -> last 7 days of daily calorie totals, for the chart
router.get('/', (req, res) => {
  if (req.query.range === 'week') {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const day = daysAgo(i);
      const total = db.prepare(`
        SELECT COALESCE(SUM(calories),0) c FROM nutrition WHERE date >= ? AND date < ?
      `).get(day, day + 86400000).c;
      days.push({ date: day, calories: total });
    }
    return res.json(days);
  }

  const day = startOfDay(req.query.date ? Number(req.query.date) : Date.now());
  const entries = db.prepare('SELECT * FROM nutrition WHERE date >= ? AND date < ? ORDER BY id DESC')
    .all(day, day + 86400000);

  const totals = entries.reduce((acc, e) => {
    acc.calories += e.calories;
    acc.protein += e.protein_g;
    acc.carbs += e.carbs_g;
    acc.fat += e.fat_g;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const user = getUser() || {};
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
  const { food_name, calories, protein, carbs, fat, meal_type, date } = req.body || {};
  if (!food_name || !String(food_name).trim()) return res.status(400).json({ error: 'Food name is required' });
  const cal = Number(calories);
  if (!Number.isFinite(cal) || cal < 0) return res.status(400).json({ error: 'Calories must be a non-negative number' });

  const ts = Number(date) || Date.now();
  const info = db.prepare(`
    INSERT INTO nutrition (food_name, calories, protein_g, carbs_g, fat_g, meal_type, date, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(food_name.trim(), Math.round(cal), Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0, meal_type || 'Snack', ts);

  logActivity('nutrition', `Logged ${food_name.trim()} (${Math.round(cal)} kcal)`, ts);
  res.status(201).json(db.prepare('SELECT * FROM nutrition WHERE id = ?').get(info.lastInsertRowid));
});

// DELETE /api/nutrition/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM nutrition WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(204).end();
});

module.exports = router;
