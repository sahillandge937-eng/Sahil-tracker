// utils.js
// Small shared helpers used by multiple route modules.

const db = require('./db/database');

const MET = { Run: 9.8, Strength: 5.0, Cycle: 7.5, HIIT: 10.0, Yoga: 2.5, Swim: 8.0 };

function estimateCalories(type, minutes, intensity, weightKg) {
  const met = (MET[type] || 6) * (0.8 + (intensity || 3) * 0.12);
  return Math.round(met * (weightKg || 70) * (minutes / 60));
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysAgo(n) {
  return startOfDay(Date.now() - n * 86400000);
}

// Consecutive-day streak, counting back from today, based on any table
// that has a `date` column with millisecond timestamps.
function computeStreak(dates) {
  const daySet = new Set(dates.map(startOfDay));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (daySet.has(daysAgo(i))) streak++;
    else break;
  }
  return streak;
}

function logActivity(type, description, date) {
  db.prepare('INSERT INTO activity_logs (type, description, date) VALUES (?, ?, ?)')
    .run(type, description, date || Date.now());
}

function getUser() {
  return db.prepare('SELECT * FROM users WHERE id = 1').get();
}

// Computes a goal's current progress dynamically from real stored data.
// Shared by routes/goals.js and routes/insights.js so both stay in sync.
function computeGoalProgress(goal) {
  const weekStart = daysAgo(6);
  let current = 0;

  if (goal.type === 'workouts_per_week') {
    current = db.prepare('SELECT COUNT(*) c FROM workouts WHERE date >= ?').get(weekStart).c;
  } else if (goal.type === 'distance_per_week') {
    current = db.prepare('SELECT COALESCE(SUM(distance_km),0) c FROM workouts WHERE date >= ? AND distance_km IS NOT NULL').get(weekStart).c;
  } else if (goal.type === 'calories_per_week') {
    current = db.prepare('SELECT COALESCE(SUM(calories),0) c FROM workouts WHERE date >= ?').get(weekStart).c;
  } else if (goal.type === 'target_weight') {
    const latest = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC LIMIT 1').get();
    current = latest ? latest.weight_kg : (getUser() || {}).weight_kg || 0;
  } else if (goal.type === 'streak') {
    const dates = db.prepare('SELECT date FROM workouts').all().map(r => r.date);
    current = computeStreak(dates);
  }

  let pct;
  if (goal.type === 'target_weight') {
    const first = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date ASC LIMIT 1').get();
    const start = first ? first.weight_kg : current;
    const span = Math.abs(start - goal.target_value) || 1;
    pct = Math.max(0, Math.min(100, Math.round((1 - Math.abs(current - goal.target_value) / span) * 100)));
  } else {
    pct = Math.max(0, Math.min(100, Math.round((current / goal.target_value) * 100)));
  }

  return { ...goal, current_value: Math.round(current * 10) / 10, progress_pct: pct };
}

module.exports = { MET, estimateCalories, startOfDay, daysAgo, computeStreak, logActivity, getUser, computeGoalProgress, db };
