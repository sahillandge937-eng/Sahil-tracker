// routes/goals.js
const express = require('express');
const router = express.Router();

const {
  db,
  logActivity,
  computeGoalProgress,
  getRequestUserId
} = require('./utils');

// GET /api/goals
router.get('/', (req, res) => {
  const userId = getRequestUserId(req);

  const goals = db.prepare(`
    SELECT *
    FROM goals
    WHERE user_id = ?
    ORDER BY status ASC, created_at DESC
  `)
    .all(userId)
    .map(goal => computeGoalProgress(goal, userId));

  res.json(goals);
});

// POST /api/goals
router.post('/', (req, res) => {
  const userId = getRequestUserId(req);

  const {
    title,
    type,
    target_value,
    unit,
    deadline
  } = req.body || {};

  const validTypes = [
    'workouts_per_week',
    'distance_per_week',
    'target_weight',
    'calories_per_week',
    'streak'
  ];

  if (!title || !String(title).trim()) {
    return res.status(400).json({
      error: 'Goal title is required'
    });
  }

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid goal type'
    });
  }

  const target = Number(target_value);

  if (!Number.isFinite(target) || target <= 0) {
    return res.status(400).json({
      error: 'Target value must be a positive number'
    });
  }

  const info = db.prepare(`
    INSERT INTO goals
    (
      title,
      type,
      target_value,
      unit,
      status,
      created_at,
      deadline,
      is_demo,
      user_id
    )
    VALUES (?, ?, ?, ?, 'active', ?, ?, 0, ?)
  `).run(
    title.trim(),
    type,
    target,
    unit || '',
    Date.now(),
    deadline ? Number(deadline) : null,
    userId
  );

  logActivity(
    'goal',
    `Created a new goal: ${title.trim()}`,
    Date.now(),
    userId
  );

  const goal = db.prepare(`
    SELECT *
    FROM goals
    WHERE id = ?
      AND user_id = ?
  `).get(
    info.lastInsertRowid,
    userId
  );

  res.status(201).json(
    computeGoalProgress(goal, userId)
  );
});

// PUT /api/goals/:id
router.put('/:id', (req, res) => {
  const userId = getRequestUserId(req);

  const existing = db.prepare(`
    SELECT *
    FROM goals
    WHERE id = ?
      AND user_id = ?
  `).get(
    req.params.id,
    userId
  );

  if (!existing) {
    return res.status(404).json({
      error: 'Goal not found'
    });
  }

  const {
    title,
    target_value,
    unit,
    status,
    deadline
  } = req.body || {};

  const finalTitle =
    title !== undefined
      ? title
      : existing.title;

  const finalTarget =
    target_value !== undefined
      ? Number(target_value)
      : existing.target_value;

  const finalUnit =
    unit !== undefined
      ? unit
      : existing.unit;

  const finalStatus =
    status !== undefined
      ? status
      : existing.status;

  const finalDeadline =
    deadline !== undefined
      ? Number(deadline)
      : existing.deadline;

  if (
    !Number.isFinite(finalTarget) ||
    finalTarget <= 0
  ) {
    return res.status(400).json({
      error: 'Target value must be a positive number'
    });
  }

  db.prepare(`
    UPDATE goals
    SET
      title = ?,
      target_value = ?,
      unit = ?,
      status = ?,
      deadline = ?
    WHERE id = ?
      AND user_id = ?
  `).run(
    finalTitle,
    finalTarget,
    finalUnit,
    finalStatus,
    finalDeadline,
    req.params.id,
    userId
  );

  if (
    status === 'completed' &&
    existing.status !== 'completed'
  ) {
    logActivity(
      'goal',
      `Completed goal: ${finalTitle}`,
      Date.now(),
      userId
    );
  }

  const updated = db.prepare(`
    SELECT *
    FROM goals
    WHERE id = ?
      AND user_id = ?
  `).get(
    req.params.id,
    userId
  );

  res.json(
    computeGoalProgress(updated, userId)
  );
});

// DELETE /api/goals/:id
router.delete('/:id', (req, res) => {
  const userId = getRequestUserId(req);

  const info = db.prepare(`
    DELETE FROM goals
    WHERE id = ?
      AND user_id = ?
  `).run(
    req.params.id,
    userId
  );

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'Goal not found'
    });
  }

  res.status(204).end();
});

module.exports = router;
