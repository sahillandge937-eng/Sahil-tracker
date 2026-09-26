// coachEngine.js
// "PULSE AI Coach" - a local, rule-based coaching engine. No external AI API
// is used; every message is generated from the user's own SQLite data.

const { db, daysAgo, computeStreak, getUser } = require('./utils');

function generateCoachMessages() {
  const messages = [];
  const weekStart = daysAgo(6);
  const prevWeekStart = daysAgo(13);

  const thisWeek = db.prepare('SELECT * FROM workouts WHERE date >= ?').all(weekStart);
  const prevWeek = db.prepare('SELECT * FROM workouts WHERE date >= ? AND date < ?').all(prevWeekStart, weekStart);
  const allDates = db.prepare('SELECT date FROM workouts').all().map(r => r.date);
  const streak = computeStreak(allDates);
  const user = getUser() || {};
  const goal = user.weekly_workout_target || 4;

  const lastWorkout = db.prepare('SELECT date FROM workouts ORDER BY date DESC LIMIT 1').get();
  const daysSinceLast = lastWorkout ? Math.floor((Date.now() - lastWorkout.date) / 86400000) : null;

  // --- Frequency vs previous week ---
  if (thisWeek.length === 0) {
    messages.push({ text: 'No workouts logged this week yet. Even a short session helps keep the habit alive.', tone: 'warn' });
  } else if (prevWeek.length > 0 && thisWeek.length < prevWeek.length) {
    messages.push({ text: 'Your training frequency has decreased this week. Try scheduling another workout.', tone: 'warn' });
  } else if (prevWeek.length > 0 && thisWeek.length > prevWeek.length) {
    messages.push({ text: 'Training frequency is up compared to last week. Solid progress.', tone: 'good' });
  }

  // --- Consistency / streak ---
  if (streak >= 5) {
    messages.push({ text: `${streak}-day streak. Great consistency this week — you're maintaining a strong training pattern. Consider a light recovery day soon.`, tone: 'good' });
  } else if (streak >= 2) {
    messages.push({ text: `${streak}-day streak going. Keep the momentum with a short session today.`, tone: 'default' });
  }

  // --- Inactivity ---
  if (daysSinceLast !== null && daysSinceLast >= 3) {
    messages.push({ text: `You haven't logged a workout in ${daysSinceLast} days. Consider starting with a short, easy session to get back into rhythm.`, tone: 'warn' });
  }

  // --- Duration trend ---
  if (thisWeek.length > 0 && prevWeek.length > 0) {
    const avgThis = thisWeek.reduce((s, w) => s + w.duration_min, 0) / thisWeek.length;
    const avgPrev = prevWeek.reduce((s, w) => s + w.duration_min, 0) / prevWeek.length;
    if (avgThis > avgPrev * 1.15) {
      messages.push({ text: 'Your average workout duration has increased compared with last week. Make sure recovery and sleep keep pace.', tone: 'default' });
    } else if (avgThis < avgPrev * 0.7) {
      messages.push({ text: 'Average session length has dropped compared to last week. That is fine for recovery, but watch it doesn\u2019t become a trend.', tone: 'default' });
    }
  }

  // --- Type balance ---
  const cardioTypes = ['Run', 'Cycle', 'Swim', 'HIIT'];
  const strengthCount = thisWeek.filter(w => w.type === 'Strength').length;
  const cardioCount = thisWeek.filter(w => cardioTypes.includes(w.type)).length;
  if (cardioCount >= 3 && strengthCount === 0) {
    messages.push({ text: 'This week is cardio-heavy with no strength work. Adding one resistance session helps balance recovery load.', tone: 'default' });
  }
  if (strengthCount >= 3 && cardioCount === 0) {
    messages.push({ text: 'Good strength volume this week. A moderate cardio session would round things out.', tone: 'default' });
  }

  // --- Intensity overload ---
  if (thisWeek.filter(w => w.difficulty >= 4).length >= 3) {
    messages.push({ text: 'Several high-effort sessions logged back to back. Consider an easier day to reduce injury risk.', tone: 'warn' });
  }

  // --- Weekly goal pacing ---
  if (thisWeek.length >= goal) {
    messages.push({ text: `Weekly workout goal reached (${thisWeek.length}/${goal}). Nice work.`, tone: 'good' });
  }

  if (messages.length === 0) {
    messages.push({ text: 'Balanced week so far. Keep logging workouts to unlock more tailored coaching.', tone: 'default' });
  }

  return messages.slice(0, 5);
}

module.exports = { generateCoachMessages };
