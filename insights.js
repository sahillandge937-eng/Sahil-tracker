const express = require('express');
const router = express.Router();

const {
  db,
  computeStreak,
  computeGoalProgress,
  getUser,
  getRequestUserId
} = require('./utils');

const { generateCoachMessages } = require('./coachEngine');

// India timezone offset = UTC + 5:30
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function istStartOfDay(ts = Date.now()) {
  const shifted = Number(ts) + IST_OFFSET;
  const d = new Date(shifted);

  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  return Date.UTC(y, m, day) - IST_OFFSET;
}

function istDaysAgo(n) {
  return istStartOfDay(Date.now()) - (Number(n) * 86400000);
}

function istMonthStart(year, monthIndex) {
  return Date.UTC(year, monthIndex, 1) - IST_OFFSET;
}

function istMonthEnd(year, monthIndex) {
  return Date.UTC(year, monthIndex + 1, 1) - IST_OFFSET;
}

function getISTDateParts(ts = Date.now()) {
  const shifted = Number(ts) + IST_OFFSET;
  const d = new Date(shifted);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate()
  };
}

/* =========================================================
   DASHBOARD
   ========================================================= */

router.get('/dashboard', (req, res) => {
  try {
    const userId = getRequestUserId(req);

    const today = istStartOfDay(Date.now());
    const weekStart = istDaysAgo(6);
    const tomorrow = today + 86400000;

    const weekWorkouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY date DESC
    `).all(userId, weekStart, tomorrow);

    const weeklyCount = weekWorkouts.length;

    const weeklyCalories = weekWorkouts.reduce(
      (sum, w) => sum + Number(w.calories || 0),
      0
    );

    const weeklyMinutes = weekWorkouts.reduce(
      (sum, w) => sum + Number(w.duration_min || 0),
      0
    );

    /* Current month */
    const nowParts = getISTDateParts(Date.now());

    const monthStart = istMonthStart(
      nowParts.year,
      nowParts.month
    );

    const monthEnd = istMonthEnd(
      nowParts.year,
      nowParts.month
    );

    const monthWorkouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY date DESC
    `).all(userId, monthStart, monthEnd);

    /* Streak */
    const allDates = db.prepare(`
      SELECT date
      FROM workouts
      WHERE user_id = ?
    `).all(userId).map(row => row.date);

    const daySet = new Set(
      allDates.map(date => istStartOfDay(date))
    );

    let streak = 0;

    for (let i = 0; i < 365; i++) {
      if (daySet.has(istDaysAgo(i))) {
        streak++;
      } else {
        break;
      }
    }

    /* Today's workout */
    const todaysWorkout = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY date DESC
      LIMIT 1
    `).get(userId, today, tomorrow);

    /* Recent workouts */
    const recentWorkouts = monthWorkouts.slice(0, 10);

    /* Current month stats */
    const totalWorkouts = monthWorkouts.length;

    const totalCalories = monthWorkouts.reduce(
      (sum, w) => sum + Number(w.calories || 0),
      0
    );

    const avgDuration = totalWorkouts
      ? Math.round(
          monthWorkouts.reduce(
            (sum, w) => sum + Number(w.duration_min || 0),
            0
          ) / totalWorkouts
        )
      : 0;

    /* Weekly goal */
    const goal = db.prepare(`
      SELECT *
      FROM goals
      WHERE user_id = ?
        AND type = 'workouts_per_week'
      ORDER BY id DESC
      LIMIT 1
    `).get(userId);

    const weeklyGoal = goal
      ? computeGoalProgress(goal, userId)
      : {
          target: 4,
          current_value: weeklyCount,
          progress_pct: Math.min(
            100,
            Math.round((weeklyCount / 4) * 100)
          )
        };

    /* Charts */
    const caloriesChart = [];
    const frequencyChart = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = istDaysAgo(i);
      const dayEnd = dayStart + 86400000;

      const row = db.prepare(`
        SELECT
          COALESCE(SUM(calories), 0) AS calories,
          COUNT(*) AS count
        FROM workouts
        WHERE user_id = ?
          AND date >= ?
          AND date < ?
      `).get(userId, dayStart, dayEnd);

      caloriesChart.push({
        date: dayStart,
        calories: Number(row.calories || 0)
      });

      frequencyChart.push({
        date: dayStart,
        count: Number(row.count || 0)
      });
    }

    let coachRecommendations = [];

    try {
      coachRecommendations = generateCoachMessages({
        weeklyCount,
        weeklyCalories,
        weeklyMinutes,
        streak,
        todaysWorkout,
        recentWorkouts,
        user: getUser(userId)
      });
    } catch (e) {
      coachRecommendations = [];
    }

    if (!coachRecommendations.length) {
      coachRecommendations = weeklyCount === 0
        ? [{
            text: 'No workouts logged this week yet. Even a short session helps keep the habit alive.',
            tone: 'warn'
          }]
        : [{
            text: 'Great work! Keep your workout routine consistent.',
            tone: 'good'
          }];
    }

    res.json({
      date: today,
      weeklyCount,
      weeklyCalories,
      weeklyMinutes,
      streak,

      weeklyGoal: {
        target: weeklyGoal.target || weeklyGoal.target_value || 4,
        current:
          weeklyGoal.current_value !== undefined
            ? weeklyGoal.current_value
            : weeklyCount,
        pct:
          weeklyGoal.progress_pct !== undefined
            ? weeklyGoal.progress_pct
            : 0
      },

      caloriesChart,
      frequencyChart,
      recentWorkouts,
      todaysWorkout: todaysWorkout || null,

      stats: {
        totalWorkouts,
        totalCalories,
        avgDuration
      },

      currentGoals: db.prepare(`
        SELECT *
        FROM goals
        WHERE user_id = ?
        ORDER BY id DESC
      `).all(userId),

      coachRecommendations
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Could not load dashboard'
    });
  }
});


/* =========================================================
   ANALYTICS
   ========================================================= */

router.get('/analytics', (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const range = req.query.range || 'week';

    let start;

    if (range === 'month') {
      start = istDaysAgo(29);
    } else if (range === 'year') {
      start = istDaysAgo(364);
    } else {
      start = istDaysAgo(6);
    }

    const workouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
      ORDER BY date ASC
    `).all(userId, start);

    const totalWorkouts = workouts.length;

    const totalCalories = workouts.reduce(
      (sum, w) => sum + Number(w.calories || 0),
      0
    );

    const totalMinutes = workouts.reduce(
      (sum, w) => sum + Number(w.duration_min || 0),
      0
    );

    res.json({
      range,
      totalWorkouts,
      totalCalories,
      totalMinutes,
      workouts
    });

  } catch (error) {
    console.error('Analytics error:', error);

    res.status(500).json({
      error: 'Could not load analytics'
    });
  }
});


/* =========================================================
   COACH
   ========================================================= */

router.get('/coach', (req, res) => {
  try {
    const userId = getRequestUserId(req);

    const today = istStartOfDay(Date.now());
    const weekStart = istDaysAgo(6);

    const workouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY date DESC
    `).all(
      userId,
      weekStart,
      today + 86400000
    );

    const user = getUser(userId);

    let messages = [];

    try {
      messages = generateCoachMessages({
        weeklyCount: workouts.length,
        weeklyCalories: workouts.reduce(
          (s, w) => s + Number(w.calories || 0),
          0
        ),
        weeklyMinutes: workouts.reduce(
          (s, w) => s + Number(w.duration_min || 0),
          0
        ),
        recentWorkouts: workouts,
        user
      });
    } catch (e) {
      messages = [];
    }

    res.json({
      recommendations: messages
    });

  } catch (error) {
    console.error('Coach error:', error);

    res.status(500).json({
      error: 'Could not load coach'
    });
  }
});


/* =========================================================
   ACTIVITY
   ========================================================= */

router.get('/activity', (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const limit = Math.min(
      Number(req.query.limit) || 30,
      100
    );

    const activities = db.prepare(`
      SELECT *
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT ?
    `).all(userId, limit);

    res.json(activities);

  } catch (error) {
    console.error('Activity error:', error);

    res.status(500).json({
      error: 'Could not load activity'
    });
  }
});


/* =========================================================
   HISTORY
   ========================================================= */

router.get('/history', (req, res) => {
  try {
    const userId = getRequestUserId(req);

    const monthParam = String(
      req.query.month || ''
    );

    const match = /^(\d{4})-(\d{2})$/.exec(monthParam);

    const now = getISTDateParts(Date.now());

    const year = match
      ? Number(match[1])
      : now.year;

    const monthIndex = match
      ? Number(match[2]) - 1
      : now.month;

    if (
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      return res.status(400).json({
        error: 'Invalid month'
      });
    }

    const monthStart = istMonthStart(
      year,
      monthIndex
    );

    const monthEnd = istMonthEnd(
      year,
      monthIndex
    );

    /* IMPORTANT:
       Filter using IST boundaries, not server timezone.
    */

    const workouts = db.prepare(`
      SELECT *
      FROM workouts
      WHERE user_id = ?
        AND date >= ?
        AND date < ?
      ORDER BY date ASC
    `).all(
      userId,
      monthStart,
      monthEnd
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
      monthStart,
      monthEnd
    );

    const monthlyWorkouts = workouts.length;

    const monthlyWorkoutCalories = workouts.reduce(
      (sum, w) => sum + Number(w.calories || 0),
      0
    );

    const monthlyWorkoutMinutes = workouts.reduce(
      (sum, w) => sum + Number(w.duration_min || 0),
      0
    );

    const nutritionCalories = nutrition.reduce(
      (sum, n) => sum + Number(n.calories || 0),
      0
    );

    const protein = nutrition.reduce(
      (sum, n) => sum + Number(n.protein || 0),
      0
    );

    const carbs = nutrition.reduce(
      (sum, n) => sum + Number(n.carbs || 0),
      0
    );

    const fat = nutrition.reduce(
      (sum, n) => sum + Number(n.fat || 0),
      0
    );

    /* Number of days in selected month */
    const daysInMonth =
      new Date(
        Date.UTC(year, monthIndex + 1, 0)
      ).getUTCDate();

    const daily = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart =
        Date.UTC(year, monthIndex, day) -
        IST_OFFSET;

      const dayEnd =
        dayStart + 86400000;

      const dayWorkouts = workouts.filter(
        w =>
          Number(w.date) >= dayStart &&
          Number(w.date) < dayEnd
      );

      const dayNutrition = nutrition.filter(
        n =>
          Number(n.date) >= dayStart &&
          Number(n.date) < dayEnd
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
              sum + Number(n.protein || 0),
            0
          ),

        carbs:
          dayNutrition.reduce(
            (sum, n) =>
              sum + Number(n.carbs || 0),
            0
          ),

        fat:
          dayNutrition.reduce(
            (sum, n) =>
              sum + Number(n.fat || 0),
            0
          )
      });
    }

    res.json({
      month:
        `${year}-${String(monthIndex + 1).padStart(2, '0')}`,

      monthly: {
        workouts: monthlyWorkouts,
        workout_calories: monthlyWorkoutCalories,
        workout_minutes: monthlyWorkoutMinutes,
        nutrition_calories: nutritionCalories,
        protein,
        carbs,
        fat
      },

      daily
    });

  } catch (error) {
    console.error('History error:', error);

    res.status(500).json({
      error: 'Could not load history'
    });
  }
});


module.exports = router;
