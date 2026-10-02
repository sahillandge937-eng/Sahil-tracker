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

  // Current month workouts for streak
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

  // Charts
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

  // Recent workouts
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

  // Current month statistics
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
