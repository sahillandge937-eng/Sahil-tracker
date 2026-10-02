// insights.js
const express = require('express');
const router = express.Router();

const {
  db,
  daysAgo,
  startOfDay,
  computeStreak,
  computeGoalProgress,
  getUser,
  getRequestUserId
} = require('./utils');

const { generateCoachMessages } = require('./coachEngine');

// ------------------------------------------------------------
// GET /api/dashboard
// ------------------------------------------------------------
router.get('/dashboard', (req, res) => {
  const userId = getRequestUserId(req);

  const today = startOfDay(Date.now());
  const weekStart = daysAgo(6);

  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getTime();

  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();

  // Current week workouts
  const weekWorkouts = db.prepare(`
    SELECT *
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
  `).all(
    userId,
    weekStart,
    today + 86400000
  );

  const weeklyCount = weekWorkouts.length;

  const weeklyCalories = weekWorkouts.reduce(
    (sum, w) => sum + Number(w.calories || 0),
    0
  );

  const weeklyMinutes = weekWorkouts.reduce(
    (sum, w) => sum + Number(w.duration_min || 0),
    0
  );

  // Current month dates for streak
  const allDates = db.prepare(`
    SELECT date
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
  `).all(
    userId,
    monthStart,
    monthEnd
  ).map(row => row.date);

  const streak = computeStreak(allDates);

  // Today's workout
  const todaysWorkout = db.prepare(`
    SELECT *
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
    ORDER BY date DESC
    LIMIT 1
  `).get(
    userId,
    today,
    today + 86400000
  );

  const user = getUser(userId) || {};

  const weeklyGoalTarget =
    user.weekly_workout_target || 4;

  // ----------------------------------------------------------
  // Charts
  // ----------------------------------------------------------
  const caloriesChart = [];
  const frequencyChart = [];

  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);

    const dayWorkouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
    `).all(
      userId,
      day,
      day + 86400000
    );

    caloriesChart.push({
      date: day,
      calories: dayWorkouts.reduce(
        (sum, w) => sum + Number(w.calories || 0),
        0
      )
    });

    frequencyChart.push({
      date: day,
      count: dayWorkouts.length
    });
  }

  // ----------------------------------------------------------
  // Recent workouts
  // ----------------------------------------------------------
  const recentWorkouts = db.prepare(`
    SELECT *
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
    ORDER BY date DESC
    LIMIT 5
  `).all(
    userId,
    monthStart,
    monthEnd
  );

  // ----------------------------------------------------------
  // Current month statistics
  // ----------------------------------------------------------
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS totalWorkouts,
      COALESCE(SUM(calories), 0) AS totalCalories,
      COALESCE(AVG(duration_min), 0) AS avgDuration
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
  `).get(
    userId,
    monthStart,
    monthEnd
  );

  // ----------------------------------------------------------
  // Current goals
  // ----------------------------------------------------------
  const currentGoals = db.prepare(`
    SELECT *
    FROM goals
    WHERE user_id = ?
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 3
  `)
    .all(userId)
    .map(goal => computeGoalProgress(goal, userId));

  // ----------------------------------------------------------
  // Dashboard response
  // ----------------------------------------------------------
  res.json({
    date: today,

    todaysWorkout,

    weeklyCount,

    weeklyCalories,

    weeklyMinutes,

    streak,

    weeklyGoal: {
      target: weeklyGoalTarget,
      current: weeklyCount,
      pct: Math.min(
        100,
        Math.round(
          (weeklyCount / weeklyGoalTarget) * 100
        )
      )
    },

    caloriesChart,

    frequencyChart,

    recentWorkouts,

    stats: {
      totalWorkouts: stats.totalWorkouts,
      totalCalories: stats.totalCalories,
      avgDuration: Math.round(stats.avgDuration)
    },

    currentGoals,

    coachRecommendations:
      generateCoachMessages(userId).slice(0, 3)
  });
});

// ------------------------------------------------------------
// GET /api/analytics?range=7|30|90|365
// ------------------------------------------------------------
router.get('/analytics', (req, res) => {
  const userId = getRequestUserId(req);

  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getTime();

  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();

  const range = Number(req.query.range) || 30;

  const cutoff = Math.max(
    daysAgo(range - 1),
    monthStart
  );

  const workouts = db.prepare(`
    SELECT *
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
  `).all(
    userId,
    cutoff,
    monthEnd
  );

  const buckets = {};

  const bucketMs =
    range <= 31
      ? 86400000
      : 7 * 86400000;

  workouts.forEach(w => {
    const key =
      Math.floor(
        startOfDay(w.date) / bucketMs
      ) * bucketMs;

    if (!buckets[key]) {
      buckets[key] = {
        date: key,
        count: 0,
        calories: 0,
        minutes: 0
      };
    }

    buckets[key].count += 1;

    buckets[key].calories +=
      Number(w.calories || 0);

    buckets[key].minutes +=
      Number(w.duration_min || 0);
  });

  const timeSeries =
    Object.values(buckets)
      .sort((a, b) => a.date - b.date);

  const typeBreakdown = {};

  workouts.forEach(w => {
    typeBreakdown[w.type] =
      (typeBreakdown[w.type] || 0) + 1;
  });

  const uniqueDays =
    new Set(
      workouts.map(w => startOfDay(w.date))
    ).size;

  const daysInCurrentPeriod =
    Math.max(
      1,
      Math.ceil(
        (Math.min(Date.now(), monthEnd) - cutoff)
        / 86400000
      )
    );

  const consistencyPct =
    Math.round(
      (uniqueDays / daysInCurrentPeriod) * 100
    );

  const muscleRows = db.prepare(`
    SELECT
      e.muscle_group AS muscle_group,
      COUNT(*) AS c
    FROM workout_exercises we
    JOIN exercises e
      ON e.id = we.exercise_id
    JOIN workouts w
      ON w.id = we.workout_id
    WHERE w.user_id = ?
      AND w.date >= ?
      AND w.date < ?
    GROUP BY e.muscle_group
  `).all(
    userId,
    cutoff,
    monthEnd
  );

  const muscleDistribution = {};

  muscleRows.forEach(r => {
    muscleDistribution[r.muscle_group] = r.c;
  });

  const personalRecords = {
    strongestLifts: db.prepare(`
      SELECT
        e.name,
        MAX(we.weight_kg) AS weight
      FROM workout_exercises we
      JOIN exercises e
        ON e.id = we.exercise_id
      JOIN workouts w
        ON w.id = we.workout_id
      WHERE we.weight_kg IS NOT NULL
        AND w.user_id = ?
        AND w.date >= ?
        AND w.date < ?
      GROUP BY e.id
      ORDER BY weight DESC
      LIMIT 5
    `).all(
      userId,
      cutoff,
      monthEnd
    ),

    longestWorkout: db.prepare(`
      SELECT
        type,
        duration_min,
        date
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY duration_min DESC
      LIMIT 1
    `).get(
      userId,
      cutoff,
      monthEnd
    ),

    mostCalories: db.prepare(`
      SELECT
        type,
        calories,
        date
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY calories DESC
      LIMIT 1
    `).get(
      userId,
      cutoff,
      monthEnd
    )
  };

  res.json({
    range,

    timeSeries,

    typeBreakdown,

    consistencyPct,

    muscleDistribution,

    personalRecords,

    totals: {
      workouts: workouts.length,

      calories: workouts.reduce(
        (s, w) =>
          s + Number(w.calories || 0),
        0
      ),

      minutes: workouts.reduce(
        (s, w) =>
          s + Number(w.duration_min || 0),
        0
      )
    }
  });
});

// ------------------------------------------------------------
// GET /api/coach
// ------------------------------------------------------------
router.get('/coach', (req, res) => {
  const userId = getRequestUserId(req);

  res.json({
    messages: generateCoachMessages(userId)
  });
});

// ------------------------------------------------------------
// GET /api/activity
// ------------------------------------------------------------
router.get('/activity', (req, res) => {
  const userId = getRequestUserId(req);

  const limit =
    Number(req.query.limit) || 30;

  const rows = db.prepare(`
    SELECT *
    FROM activity_logs
    WHERE user_id = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(
    userId,
    limit
  );

  res.json(rows);
});

// ------------------------------------------------------------
// GET /api/history?month=YYYY-MM
// ------------------------------------------------------------
router.get('/history', (req, res) => {
  const userId = getRequestUserId();

  const month =
    String(req.query.month || '');

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({
      error: 'Month must be in YYYY-MM format'
    });
  }

  const [year, monthNumber] =
    month.split('-').map(Number);

  const start =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const end =
    new Date(
      year,
      monthNumber,
      1
    );

  const startTs = start.getTime();
  const endTs = end.getTime();

  const workouts = db.prepare(`
    SELECT *
    FROM workouts
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
    ORDER BY date ASC
  `).all(
    userId,
    startTs,
    endTs
  );

  const nutrition = db.prepare(`
    SELECT *
    FROM nutrition
    WHERE user_id = ?
      AND date >= ?
      AND date < ?
    ORDER BY date ASC
  `).all(
    userId,
    startTs,
    endTs
  );

  const daily = [];

  for (
    let d = new Date(start);
    d < end;
    d.setDate(d.getDate() + 1)
  ) {
    const dayStart =
      new Date(d).getTime();

    const dayEnd =
      dayStart + 86400000;

    const dayWorkouts =
      workouts.filter(
        w =>
          w.date >= dayStart &&
          w.date < dayEnd
      );

    const dayNutrition =
      nutrition.filter(
        n =>
          n.date >= dayStart &&
          n.date < dayEnd
      );

    daily.push({
      date: dayStart,

      workout_count:
        dayWorkouts.length,

      workout_calories:
        dayWorkouts.reduce(
          (sum, w) =>
            sum + Number(w.calories || 0),
          0
        ),

      workout_minutes:
        dayWorkouts.reduce(
          (sum, w) =>
            sum + Number(w.duration_min || 0),
          0
        ),

      nutrition_calories:
        dayNutrition.reduce(
          (sum, n) =>
            sum + Number(n.calories || 0),
          0
        ),

      protein:
        dayNutrition.reduce(
          (sum, n) =>
            sum + Number(n.protein_g || 0),
          0
        ),

      carbs:
        dayNutrition.reduce(
          (sum, n) =>
            sum + Number(n.carbs_g || 0),
          0
        ),

      fat:
        dayNutrition.reduce(
          (sum, n) =>
            sum + Number(n.fat_g || 0),
          0
        )
    });
  }

  const monthly = {
    workouts: workouts.length,

    workout_calories:
      workouts.reduce(
        (sum, w) =>
          sum + Number(w.calories || 0),
        0
      ),

    workout_minutes:
      workouts.reduce(
        (sum, w) =>
          sum + Number(w.duration_min || 0),
        0
      ),

    nutrition_calories:
      nutrition.reduce(
        (sum, n) =>
          sum + Number(n.calories || 0),
        0
      ),

    protein:
      nutrition.reduce(
        (sum, n) =>
          sum + Number(n.protein_g || 0),
        0
      ),

    carbs:
      nutrition.reduce(
        (sum, n) =>
          sum + Number(n.carbs_g || 0),
        0
      ),

    fat:
      nutrition.reduce(
        (sum, n) =>
          sum + Number(n.fat_g || 0),
        0
      )
  };

  res.json({
    month,
    monthly,
    daily
  });
});

module.exports = router;
