// user.js
const express = require('express');
const router = express.Router();

const {
  db,
  getUser,
  getRequestUserId
} = require('./utils');

// GET /api/profile
router.get('/profile', (req, res) => {
  const userId = getRequestUserId(req);
  res.json(getUser(userId));
});

// PUT /api/profile
router.put('/profile', (req, res) => {
  const userId = getRequestUserId(req);
  const u = getUser(userId);

  if (!u) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const {
    name,
    age,
    height_cm,
    weight_kg,
    gender,
    fitness_goal,
    activity_level,
    goal_weight_kg
  } = req.body || {};

  db.prepare(`
    UPDATE users
    SET
      name = ?,
      age = ?,
      height_cm = ?,
      weight_kg = ?,
      gender = ?,
      fitness_goal = ?,
      activity_level = ?,
      goal_weight_kg = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : u.name,
    age !== undefined ? Number(age) : u.age,
    height_cm !== undefined ? Number(height_cm) : u.height_cm,
    weight_kg !== undefined ? Number(weight_kg) : u.weight_kg,
    gender !== undefined ? gender : u.gender,
    fitness_goal !== undefined ? fitness_goal : u.fitness_goal,
    activity_level !== undefined ? activity_level : u.activity_level,
    goal_weight_kg !== undefined
      ? Number(goal_weight_kg)
      : u.goal_weight_kg,
    userId
  );

  res.json(getUser(userId));
});

// GET /api/settings
router.get('/settings', (req, res) => {
  const userId = getRequestUserId(req);
  const u = getUser(userId);

  if (!u) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  res.json({
    weekly_workout_target: u.weekly_workout_target,
    calorie_target: u.calorie_target,
    protein_target: u.protein_target,
    carb_target: u.carb_target,
    fat_target: u.fat_target,
    weight_unit: u.weight_unit,
    theme: u.theme,
    notifications_enabled:
      !!u.notifications_enabled
  });
});

// PUT /api/settings
router.put('/settings', (req, res) => {
  const userId = getRequestUserId(req);
  const u = getUser(userId);

  if (!u) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const {
    weekly_workout_target,
    calorie_target,
    protein_target,
    carb_target,
    fat_target,
    weight_unit,
    theme,
    notifications_enabled
  } = req.body || {};

  db.prepare(`
    UPDATE users
    SET
      weekly_workout_target = ?,
      calorie_target = ?,
      protein_target = ?,
      carb_target = ?,
      fat_target = ?,
      weight_unit = ?,
      theme = ?,
      notifications_enabled = ?
    WHERE id = ?
  `).run(
    weekly_workout_target !== undefined
      ? Number(weekly_workout_target)
      : u.weekly_workout_target,

    calorie_target !== undefined
      ? Number(calorie_target)
      : u.calorie_target,

    protein_target !== undefined
      ? Number(protein_target)
      : u.protein_target,

    carb_target !== undefined
      ? Number(carb_target)
      : u.carb_target,

    fat_target !== undefined
      ? Number(fat_target)
      : u.fat_target,

    weight_unit !== undefined
      ? weight_unit
      : u.weight_unit,

    theme !== undefined
      ? theme
      : u.theme,

    notifications_enabled !== undefined
      ? (notifications_enabled ? 1 : 0)
      : u.notifications_enabled,

    userId
  );

  res.json(getUser(userId));
});

// POST /api/settings/reset
router.post('/settings/reset', (req, res) => {
  const userId = getRequestUserId(req);

  const tx = db.transaction(() => {

    db.prepare(`
      DELETE FROM workout_exercises
      WHERE workout_id IN (
        SELECT id
        FROM workouts
        WHERE user_id = ?
      )
    `).run(userId);

    db.prepare(`
      DELETE FROM workouts
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM weight_logs
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM goals
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM nutrition
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM activity_logs
      WHERE user_id = ?
    `).run(userId);
  });

  tx();

  res.json({ ok: true });
});

module.exports = router;
