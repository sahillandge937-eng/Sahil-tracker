// utils.js
// Small shared helpers used by multiple route modules.

const db = require('./db/database');

const MET = {
  Run: 9.8,
  Strength: 5.0,
  Cycle: 7.5,
  HIIT: 10.0,
  Yoga: 2.5,
  Swim: 8.0
};

function estimateCalories(type, minutes, intensity, weightKg) {
  const met = (MET[type] || 6) * (0.8 + (intensity || 3) * 0.12);
  return Math.round(
    met * (weightKg || 70) * (minutes / 60)
  );
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysAgo(n) {
  return startOfDay(Date.now() - n * 86400000);
}

// ------------------------------------------------------------
// Get logged-in user ID from request
// ------------------------------------------------------------
function getRequestUserId(req) {
  const userId = Number(req?.headers?.['x-user-id']);

  if (!Number.isInteger(userId) || userId <= 0) {
    return 1;
  }

  return userId;
}

// ------------------------------------------------------------
// Check whether user exists
// ------------------------------------------------------------
function userExists(userId) {
  return !!db
    .prepare('SELECT id FROM users WHERE id = ?')
    .get(userId);
}

// ------------------------------------------------------------
// Consecutive-day streak
// ------------------------------------------------------------
function computeStreak(dates) {
  const daySet = new Set(
    dates.map(startOfDay)
  );

  let streak = 0;

  for (let i = 0; i < 365; i++) {
    if (daySet.has(daysAgo(i))) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ------------------------------------------------------------
// Activity logging
// ------------------------------------------------------------
function logActivity(type, description, date, userId = 1) {
  db.prepare(`
    INSERT INTO activity_logs
    (
      type,
      description,
      date,
      user_id
    )
    VALUES (?, ?, ?, ?)
  `).run(
    type,
    description,
    date || Date.now(),
    userId
  );
}

// ------------------------------------------------------------
// Get user
// ------------------------------------------------------------
function getUser(userId = 1) {
  return db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId);
}

// ------------------------------------------------------------
// Compute goal progress for a specific user
// ------------------------------------------------------------
function computeGoalProgress(goal, userId = 1) {
  const weekStart = daysAgo(6);

  let current = 0;

  // Workouts per week
  if (goal.type === 'workouts_per_week') {
    current = db.prepare(`
      SELECT COUNT(*) c
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
    `).get(userId, weekStart).c;
  }

  // Distance per week
  else if (goal.type === 'distance_per_week') {
    current = db.prepare(`
      SELECT COALESCE(SUM(distance_km), 0) c
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND distance_km IS NOT NULL
    `).get(userId, weekStart).c;
  }

  // Calories burned per week
  else if (goal.type === 'calories_per_week') {
    current = db.prepare(`
      SELECT COALESCE(SUM(calories), 0) c
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
    `).get(userId, weekStart).c;
  }

  // Target weight
  else if (goal.type === 'target_weight') {
    const latest = db.prepare(`
      SELECT weight_kg
      FROM weight_logs
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 1
    `).get(userId);

    const user = getUser(userId);

    current = latest
      ? latest.weight_kg
      : (user || {}).weight_kg || 0;
  }

  // Workout streak
  else if (goal.type === 'streak') {
    const dates = db.prepare(`
      SELECT date
      FROM workouts
      WHERE user_id = ?
    `).all(userId).map(row => row.date);

    current = computeStreak(dates);
  }

  // ----------------------------------------------------------
  // Calculate percentage
  // ----------------------------------------------------------

  let pct;

  if (goal.type === 'target_weight') {
    const first = db.prepare(`
      SELECT weight_kg
      FROM weight_logs
      WHERE user_id = ?
      ORDER BY date ASC
      LIMIT 1
    `).get(userId);

    const start = first
      ? first.weight_kg
      : current;

    const span =
      Math.abs(start - goal.target_value) || 1;

    pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (1 -
            Math.abs(
              current - goal.target_value
            ) / span) * 100
        )
      )
    );
  } else {
    pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (current / goal.target_value) * 100
        )
      )
    );
  }

  return {
    ...goal,
    current_value:
      Math.round(current * 10) / 10,
    progress_pct: pct
  };
}

module.exports = {
  MET,
  estimateCalories,
  startOfDay,
  daysAgo,
  computeStreak,
  logActivity,
  getUser,
  getRequestUserId,
  userExists,
  computeGoalProgress,
  db
};
