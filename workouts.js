// routes/workouts.js
// workouts.js
const express = require('express');
const router = express.Router();
const { db, estimateCalories, logActivity, getUser } = require('./utils');


const VALID_TYPES = ['Run', 'Strength', 'Cycle', 'HIIT', 'Yoga', 'Swim'];

function attachExercises(workout) {
  const rows = db.prepare(`
    SELECT we.id, we.sets, we.reps, we.weight_kg, we.rest_seconds,
           e.id as exercise_id, e.name, e.muscle_group, e.category
    FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id
    WHERE we.workout_id = ?
  `).all(workout.id);

  workout.exercises = rows;
  return workout;
}

// GET /api/workouts
router.get('/', (req, res) => {
  const { search, type, from, to } = req.query;

  let sql = 'SELECT * FROM workouts WHERE 1=1';
  const params = [];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  if (from) {
    sql += ' AND date >= ?';
    params.push(Number(from));
  }

  if (to) {
    sql += ' AND date <= ?';
    params.push(Number(to));
  }

  if (search) {
    sql += ' AND (notes LIKE ? OR type LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY date DESC';

  const workouts = db
    .prepare(sql)
    .all(...params)
    .map(attachExercises);

  res.json(workouts);
});

// GET /api/workouts/:id
router.get('/:id', (req, res) => {
  const workout = db
    .prepare('SELECT * FROM workouts WHERE id = ?')
    .get(req.params.id);

  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  res.json(attachExercises(workout));
});

// POST /api/workouts
router.post('/', (req, res) => {
  const {
    type,
    date,
    duration,
    distance,
    difficulty,
    calories,
    notes,
    exercises
  } = req.body || {};

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Invalid or missing workout type'
    });
  }

  const dur = Number(duration);

  if (!Number.isFinite(dur) || dur <= 0 || dur > 600) {
    return res.status(400).json({
      error: 'Duration must be between 1 and 600 minutes'
    });
  }

  const diff = Number(difficulty) || 3;
  const ts = Number(date) || Date.now();

  const user = getUser();

  const finalCalories =
    Number.isFinite(Number(calories)) && Number(calories) > 0
      ? Math.round(Number(calories))
      : estimateCalories(
          type,
          dur,
          diff,
          user ? user.weight_kg : 70
        );

  // IMPORTANT:
  // Save the workout with user_id = 1
  const insertWorkout = db.prepare(`
    INSERT INTO workouts
    (
      type,
      date,
      duration_min,
      distance_km,
      difficulty,
      calories,
      notes,
      is_demo,
      user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const insertWE = db.prepare(`
    INSERT INTO workout_exercises
    (
      workout_id,
      exercise_id,
      sets,
      reps,
      weight_kg,
      rest_seconds
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const maxWeightBefore = db.prepare(`
    SELECT MAX(weight_kg) m
    FROM workout_exercises
    WHERE exercise_id = ?
  `);

  const tx = db.transaction(() => {
    const info = insertWorkout.run(
      type,
      ts,
      dur,
      distance ? Number(distance) : null,
      diff,
      finalCalories,
      notes || '',
      user ? user.id : 1
    );

    const workoutId = info.lastInsertRowid;
    const prMessages = [];

    (exercises || []).forEach(ex => {
      if (!ex.exercise_id) return;

      const priorMax =
        maxWeightBefore.get(ex.exercise_id).m;

      insertWE.run(
        workoutId,
        ex.exercise_id,
        ex.sets || null,
        ex.reps || null,
        ex.weight || null,
        ex.rest || null
      );

      if (
        ex.weight &&
        (priorMax === null || ex.weight > priorMax)
      ) {
        const exRow = db
          .prepare('SELECT name FROM exercises WHERE id = ?')
          .get(ex.exercise_id);

        if (exRow) {
          prMessages.push(
            `New personal record on ${exRow.name}: ${ex.weight} kg`
          );
        }
      }
    });

    logActivity(
      'workout',
      `Logged a ${type} workout (${dur} min, ${finalCalories} kcal)`,
      ts
    );

    prMessages.forEach(msg =>
      logActivity('pr', msg, ts)
    );

    return workoutId;
  });

  const workoutId = tx();

  const workout = attachExercises(
    db
      .prepare('SELECT * FROM workouts WHERE id = ?')
      .get(workoutId)
  );

  res.status(201).json(workout);
});

// PUT /api/workouts/:id
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM workouts WHERE id = ?')
    .get(req.params.id);

  if (!existing) {
    return res.status(404).json({
      error: 'Workout not found'
    });
  }

  const {
    type,
    date,
    duration,
    distance,
    difficulty,
    calories,
    notes,
    exercises
  } = req.body || {};

  const finalType = VALID_TYPES.includes(type)
    ? type
    : existing.type;

  const dur = Number(duration) || existing.duration_min;
  const diff = Number(difficulty) || existing.difficulty;
  const ts = Number(date) || existing.date;

  const finalCalories =
    Number.isFinite(Number(calories)) &&
    Number(calories) > 0
      ? Math.round(Number(calories))
      : existing.calories;

  db.prepare(`
    UPDATE workouts
    SET
      type=?,
      date=?,
      duration_min=?,
      distance_km=?,
      difficulty=?,
      calories=?,
      notes=?
    WHERE id = ?
  `).run(
    finalType,
    ts,
    dur,
    distance !== undefined
      ? (distance ? Number(distance) : null)
      : existing.distance_km,
    diff,
    finalCalories,
    notes !== undefined
      ? notes
      : existing.notes,
    req.params.id
  );

  if (Array.isArray(exercises)) {
    db
      .prepare(
        'DELETE FROM workout_exercises WHERE workout_id = ?'
      )
      .run(req.params.id);

    const insertWE = db.prepare(`
      INSERT INTO workout_exercises
      (
        workout_id,
        exercise_id,
        sets,
        reps,
        weight_kg,
        rest_seconds
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    exercises.forEach(ex => {
      if (!ex.exercise_id) return;

      insertWE.run(
        req.params.id,
        ex.exercise_id,
        ex.sets || null,
        ex.reps || null,
        ex.weight || null,
        ex.rest || null
      );
    });
  }

  const updated = attachExercises(
    db
      .prepare('SELECT * FROM workouts WHERE id = ?')
      .get(req.params.id)
  );

  res.json(updated);
});

// DELETE /api/workouts/:id
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM workouts WHERE id = ?')
    .run(req.params.id);

  if (info.changes === 0) {
    return res.status(404).json({
      error: 'Workout not found'
    });
  }

  res.status(204).end();
});

module.exports = router;
