// routes/insights.js
const express = require('express');
const router = express.Router();
const { db, daysAgo, startOfDay, computeStreak, computeGoalProgress, getUser } = require('./utils');
const { generateCoachMessages } = require('../coachEngine');

// ------------------------------------------------------------------
// GET /api/dashboard
// ------------------------------------------------------------------
router.get('/dashboard', (req, res) => {
  const weekStart = daysAgo(6);
  const today = startOfDay(Date.now());

  const weekWorkouts = db.prepare('SELECT * FROM workouts WHERE date >= ?').all(weekStart);
  const weeklyCount = weekWorkouts.length;
  const weeklyCalories = weekWorkouts.reduce((s, w) => s + w.calories, 0);
  const weeklyMinutes = weekWorkouts.reduce((s, w) => s + w.duration_min, 0);

  const allDates = db.prepare('SELECT date FROM workouts').all().map(r => r.date);
  const streak = computeStreak(allDates);

  const todaysWorkout = db.prepare('SELECT * FROM workouts WHERE date >= ? AND date < ? ORDER BY date DESC LIMIT 1')
    .get(today, today + 86400000);

  const user = getUser() || {};
  const weeklyGoalTarget = user.weekly_workout_target || 4;

  const caloriesChart = [];
  const frequencyChart = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const dayWorkouts = db.prepare('SELECT * FROM workouts WHERE date >= ? AND date < ?').all(day, day + 86400000);
    caloriesChart.push({ date: day, calories: dayWorkouts.reduce((s, w) => s + w.calories, 0) });
    frequencyChart.push({ date: day, count: dayWorkouts.length });
  }

  const recentWorkouts = db.prepare('SELECT * FROM workouts ORDER BY date DESC LIMIT 5').all();

  const stats = db.prepare(`
    SELECT COUNT(*) as totalWorkouts, COALESCE(SUM(calories),0) as totalCalories,
           COALESCE(AVG(duration_min),0) as avgDuration
    FROM workouts
  `).get();

  const currentGoals = db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 3")
    .all().map(computeGoalProgress);

  res.json({
    date: today,
    todaysWorkout,
    weeklyCount,
    weeklyCalories,
    weeklyMinutes,
    streak,
    weeklyGoal: { target: weeklyGoalTarget, current: weeklyCount, pct: Math.min(100, Math.round((weeklyCount / weeklyGoalTarget) * 100)) },
    caloriesChart,
    frequencyChart,
    recentWorkouts,
    stats: {
      totalWorkouts: stats.totalWorkouts,
      totalCalories: stats.totalCalories,
      avgDuration: Math.round(stats.avgDuration)
    },
    currentGoals,
    coachRecommendations: generateCoachMessages().slice(0, 3)
  });
});

// ------------------------------------------------------------------
// GET /api/analytics?range=7|30|90|365
// ------------------------------------------------------------------
router.get('/analytics', (req, res) => {
  const range = Number(req.query.range) || 30;
  const cutoff = daysAgo(range - 1);
  const workouts = db.prepare('SELECT * FROM workouts WHERE date >= ?').all(cutoff);

  // Daily (<=31 days) or weekly buckets (>31 days) for the workouts-over-time chart.
  const buckets = {};
  const bucketMs = range <= 31 ? 86400000 : 7 * 86400000;
  workouts.forEach(w => {
    const key = Math.floor(startOfDay(w.date) / bucketMs) * bucketMs;
    if (!buckets[key]) buckets[key] = { date: key, count: 0, calories: 0, minutes: 0 };
    buckets[key].count += 1;
    buckets[key].calories += w.calories;
    buckets[key].minutes += w.duration_min;
  });
  const timeSeries = Object.values(buckets).sort((a, b) => a.date - b.date);

  // Workout type breakdown.
  const typeBreakdown = {};
  workouts.forEach(w => { typeBreakdown[w.type] = (typeBreakdown[w.type] || 0) + 1; });

  // Training consistency: % of days in range with at least one workout.
  const uniqueDays = new Set(workouts.map(w => startOfDay(w.date))).size;
  const consistencyPct = Math.round((uniqueDays / range) * 100);

  // Muscle group distribution, from logged exercises in range.
  const muscleRows = db.prepare(`
    SELECT e.muscle_group as muscle_group, COUNT(*) as c
    FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.date >= ?
    GROUP BY e.muscle_group
  `).all(cutoff);
  const muscleDistribution = {};
  muscleRows.forEach(r => { muscleDistribution[r.muscle_group] = r.c; });

  // Personal records: heaviest weight per exercise, longest duration, most calories in one session (all-time).
  const personalRecords = {
    strongestLifts: db.prepare(`
      SELECT e.name, MAX(we.weight_kg) as weight
      FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
      WHERE we.weight_kg IS NOT NULL GROUP BY e.id ORDER BY weight DESC LIMIT 5
    `).all(),
    longestWorkout: db.prepare('SELECT type, duration_min, date FROM workouts ORDER BY duration_min DESC LIMIT 1').get(),
    mostCalories: db.prepare('SELECT type, calories, date FROM workouts ORDER BY calories DESC LIMIT 1').get()
  };

  res.json({
    range, timeSeries, typeBreakdown, consistencyPct, muscleDistribution, personalRecords,
    totals: {
      workouts: workouts.length,
      calories: workouts.reduce((s, w) => s + w.calories, 0),
      minutes: workouts.reduce((s, w) => s + w.duration_min, 0)
    }
  });
});

// ------------------------------------------------------------------
// GET /api/coach
// ------------------------------------------------------------------
router.get('/coach', (req, res) => {
  res.json({ messages: generateCoachMessages() });
});

// ------------------------------------------------------------------
// GET /api/activity
// ------------------------------------------------------------------
router.get('/activity', (req, res) => {
  const limit = Number(req.query.limit) || 30;
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY date DESC LIMIT ?').all(limit);
  res.json(rows);
});

module.exports = router;
