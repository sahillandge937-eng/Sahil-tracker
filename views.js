// js/views.js
const Modal = (() => {
  function open(title, bodyHtml, { onMount, wide } = {}) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal" style="${wide ? 'max-width:640px' : ''}">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="icon-btn" id="modalClose" aria-label="Close">✕</button>
          </div>
          <div id="modalBody">${bodyHtml}</div>
        </div>
      </div>
    `;
    document.getElementById('modalClose').addEventListener('click', close);
    document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') close(); });
    if (onMount) onMount(document.getElementById('modalBody'));
  }
  function close() {
    const root = document.getElementById('modalRoot');
    if (root) root.innerHTML = '';
  }
  return { open, close };
})();

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts, opts) {
  return new Date(ts).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
}
function fmtDayLabel(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
}
function toneClass(tone) { return tone === 'default' ? '' : (tone || ''); }
function demoBadge(row) { return row.is_demo ? '<span class="badge demo">Demo</span>' : ''; }

const WORKOUT_TYPES = ['Run', 'Strength', 'Cycle', 'HIIT', 'Yoga', 'Swim'];

const Views = {};

// ============================================================
// DASHBOARD
// ============================================================
Views.dashboard = async (el) => {
  el.innerHTML = '<div class="empty">Loading dashboard…</div>';
  const d = await Api.dashboard().catch(() => null);
  if (!d) { el.innerHTML = '<div class="empty">Could not load dashboard data.</div>'; return; }

  el.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Workouts this week</div><div class="value lime">${d.weeklyCount}</div></div>
      <div class="card stat-card"><div class="label">Calories this week</div><div class="value coral">${d.weeklyCalories}</div></div>
      <div class="card stat-card"><div class="label">Day streak</div><div class="value">${d.streak}</div></div>
      <div class="card stat-card"><div class="label">Minutes this week</div><div class="value sky">${d.weeklyMinutes}</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <h2>Today</h2>
        ${d.todaysWorkout
          ? `<div class="list-item"><div><div class="title">${escapeHtml(d.todaysWorkout.type)}</div><div class="meta">${d.todaysWorkout.duration_min} min · ${d.todaysWorkout.calories} kcal</div></div></div>`
          : `<div class="empty">No workout logged today yet.</div>`}
        <div style="margin-top:16px">
          <label>Weekly goal progress (${d.weeklyGoal.current}/${d.weeklyGoal.target})</label>
          <div class="progress-track"><div class="progress-fill" style="width:${d.weeklyGoal.pct}%"></div></div>
        </div>
      </div>
      <div class="card">
        <h2>PULSE AI Coach</h2>
        <div id="dashCoach">${d.coachRecommendations.map(m => `<div class="coach-msg ${toneClass(m.tone)}"><span class="dot">●</span><span>${escapeHtml(m.text)}</span></div>`).join('') || '<div class="empty">Log a workout to get coaching cues.</div>'}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card"><h2>Calories, last 7 days</h2><div class="chart-box"><canvas id="chartCaloriesDash"></canvas></div></div>
      <div class="card"><h2>Workout frequency, last 7 days</h2><div class="chart-box"><canvas id="chartFreqDash"></canvas></div></div>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Total workouts logged</div><div class="value">${d.stats.totalWorkouts}</div></div>
      <div class="card stat-card"><div class="label">Total calories burned</div><div class="value">${d.stats.totalCalories}</div></div>
      <div class="card stat-card"><div class="label">Average duration</div><div class="value">${d.stats.avgDuration}<span style="font-size:14px"> min</span></div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-title-row"><h2>Recent workouts</h2></div>
        <div class="list">
          ${d.recentWorkouts.length ? d.recentWorkouts.map(w => `
            <div class="list-item">
              <div><div class="title">${escapeHtml(w.type)}${demoBadge(w)}</div><div class="meta">${w.duration_min} min · ${w.calories} kcal · ${fmtDate(w.date)}</div></div>
            </div>
          `).join('') : '<div class="empty">No workouts yet.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-title-row"><h2>Current goals</h2></div>
        <div class="list">
          ${d.currentGoals.length ? d.currentGoals.map(g => `
            <div class="list-item" style="flex-direction:column;align-items:stretch;gap:8px">
              <div style="display:flex;justify-content:space-between"><span class="title">${escapeHtml(g.title)}${demoBadge(g)}</span><span class="meta">${g.progress_pct}%</span></div>
              <div class="progress-track"><div class="progress-fill" style="width:${g.progress_pct}%"></div></div>
            </div>
          `).join('') : '<div class="empty">No active goals. Create one on the Goals page.</div>'}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Quick actions</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" id="qaLog">+ Log Workout</button>
        <button class="btn" id="qaExercise">+ Add Exercise</button>
        <button class="btn" id="qaWeight">+ Update Weight</button>
        <button class="btn" id="qaGoal">+ Create Goal</button>
      </div>
    </div>
  `;

  Charts.line('chartCaloriesDash', d.caloriesChart.map(x => fmtDayLabel(x.date)),
    [{ label: 'Calories', data: d.caloriesChart.map(x => x.calories), borderColor: Charts.palette.coral, backgroundColor: 'rgba(255,106,85,0.12)' }]);
  Charts.bar('chartFreqDash', d.frequencyChart.map(x => fmtDayLabel(x.date)),
    [{ label: 'Workouts', data: d.frequencyChart.map(x => x.count), backgroundColor: Charts.palette.lime }]);

  document.getElementById('qaLog').addEventListener('click', () => Forms.workout(() => Views.dashboard(el)));
  document.getElementById('qaExercise').addEventListener('click', () => Forms.exercise(() => Views.dashboard(el)));
  document.getElementById('qaWeight').addEventListener('click', () => Forms.weight(() => Views.dashboard(el)));
  document.getElementById('qaGoal').addEventListener('click', () => Forms.goal(() => Views.dashboard(el)));
};

// ============================================================
// WORKOUTS
// ============================================================
Views.workouts = async (el, state = {}) => {
  el.innerHTML = '<div class="empty">Loading workouts…</div>';
  const filters = { search: state.search || '', type: state.type || '' };
  const workouts = await Api.workouts.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).catch(() => []);

  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="field-row">
        <div class="field"><label>Search notes/type</label><input id="wSearch" value="${escapeHtml(filters.search)}" placeholder="e.g. leg day"></div>
        <div class="field">
          <label>Filter by type</label>
          <select id="wType">
            <option value="">All types</option>
            ${WORKOUT_TYPES.map(t => `<option value="${t}" ${filters.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="wAdd">+ Log workout</button>
    </div>

    <div class="list" id="workoutList">
      ${workouts.length ? workouts.map(w => `
        <div class="list-item">
          <div>
            <div class="title">${escapeHtml(w.type)} <span class="badge type">${w.difficulty}/5 effort</span>${demoBadge(w)}</div>
            <div class="meta">${w.duration_min} min · ${w.calories} kcal${w.distance_km ? ` · ${w.distance_km} km` : ''} · ${fmtDate(w.date)}${w.notes ? ` · ${escapeHtml(w.notes)}` : ''}</div>
            ${w.exercises.length ? `<div class="meta">${w.exercises.map(e => `${escapeHtml(e.name)} (${e.sets || '-'}x${e.reps \vert{}\vert{} '-'}${e.weight_kg ? ` @ ${e.weight_kg}kg` : ''})`).join(', ')}</div>` : ''}
          </div>
          <div class="actions">
            <button class="icon-btn" data-edit="${w.id}" aria-label="Edit">✎</button>
            <button class="icon-btn danger" data-del="${w.id}" aria-label="Delete">✕</button>
          </div>
        </div>
      `).join('') : '<div class="empty">No workouts match. Log your first one.</div>'}
    </div>
  `;

  document.getElementById('wAdd').addEventListener('click', () => Forms.workout(() => Views.workouts(el, filters)));
  document.getElementById('wSearch').addEventListener('change', (e) => Views.workouts(el, { ...filters, search: e.target.value }));
  document.getElementById('wType').addEventListener('change', (e) => Views.workouts(el, { ...filters, type: e.target.value }));
  el.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const w = await Api.workouts.get(btn.dataset.edit);
    Forms.workout(() => Views.workouts(el, filters), w);
  }));
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this workout?')) return;
    await Api.workouts.remove(btn.dataset.del).catch(() => {});
    Views.workouts(el, filters);
  }));
};

// ============================================================
// EXERCISES
// ============================================================
Views.exercises = async (el, state = {}) => {
  el.innerHTML = '<div class="empty">Loading exercises…</div>';
  const filters = { search: state.search || '', muscle_group: state.muscle_group || '' };
  const exercises = await Api.exercises.list(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).catch(() => []);
  const groups = [...new Set(exercises.map(e => e.muscle_group))].sort();

  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="field-row">
        <div class="field"><label>Search</label><input id="eSearch" value="${escapeHtml(filters.search)}" placeholder="e.g. press"></div>
        <div class="field">
          <label>Muscle group</label>
          <select id="eGroup"><option value="">All</option>${groups.map(g => `<option ${filters.muscle_group === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </div>
      </div>
      <button class="btn btn-primary" id="eAdd">+ Add exercise</button>
    </div>
    <div class="grid grid-3">
      ${exercises.length ? exercises.map(ex => `
        <div class="card">
          <div class="card-title-row"><h3>${escapeHtml(ex.name)}</h3><span class="badge type">${escapeHtml(ex.difficulty || '')}</span></div>
          <div class="meta" style="color:var(--text-dim);font-size:12px;margin-bottom:8px">${escapeHtml(ex.muscle_group)} ·${escapeHtml(ex.category)}</div>
          <p style="font-size:12.5px;color:var(--text-dim)">${escapeHtml(ex.description || '')}</p>
        </div>
      `).join('') : '<div class="empty">No exercises match your filters.</div>'}
    </div>
  `;

  document.getElementById('eAdd').addEventListener('click', () => Forms.exercise(() => Views.exercises(el, filters)));
  document.getElementById('eSearch').addEventListener('change', (e) => Views.exercises(el, { ...filters, search: e.target.value }));
  document.getElementById('eGroup').addEventListener('change', (e) => Views.exercises(el, { ...filters, muscle_group: e.target.value }));
};

// ============================================================
// PROGRESS
// ============================================================
Views.progress = async (el) => {
  el.innerHTML = '<div class="empty">Loading progress…</div>';
  const p = await Api.progress.get().catch(() => null);
  if (!p) { el.innerHTML = '<div class="empty">Could not load progress data.</div>'; return; }

  el.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Starting weight</div><div class="value">${p.startWeight ?? '—'}<span style="font-size:13px"> kg</span></div></div>
      <div class="card stat-card"><div class="label">Current weight</div><div class="value lime">${p.currentWeight ?? '—'}<span style="font-size:13px"> kg</span></div></div>
      <div class="card stat-card"><div class="label">Goal weight</div><div class="value">${p.goalWeight ?? '—'}<span style="font-size:13px"> kg</span></div></div>
      <div class="card stat-card"><div class="label">Change</div><div class="value ${p.change < 0 ? 'lime' : 'coral'}">${p.change > 0 ? '+' : ''}${p.change ?? '—'}<span style="font-size:13px"> kg</span></div></div>
    </div>

    ${p.progressPct !== null ? `<div class="card" style="margin-bottom:18px"><label>Progress toward goal weight (${p.progressPct}%)</label><div class="progress-track"><div class="progress-fill" style="width:${p.progressPct}%"></div></div></div>` : ''}

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card"><h2>Weight history</h2><div class="chart-box"><canvas id="chartWeight"></canvas></div></div>
      <div class="card"><h2>Workout duration, last 7 days</h2><div class="chart-box"><canvas id="chartDuration"></canvas></div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title-row"><h2>Log new weight</h2></div>
        <div class="field"><label>Weight (kg)</label><input id="quickWeight" type="number" step="0.1" placeholder="e.g. 69.5"></div>
        <button class="btn btn-primary" id="quickWeightBtn">Save weight</button>
        <div style="margin-top:14px"><label>30-day workout consistency</label>
          <div class="progress-track"><div class="progress-fill" style="width:${p.consistencyPct}%"></div></div>
          <div class="meta" style="margin-top:4px">${p.consistencyPct}% of the last 30 days included a workout</div>
        </div>
      </div>
      <div class="card">
        <h2>Strength progression (best lift per exercise)</h2>
        <div class="list">
          ${p.strength.length ? p.strength.map(s => `<div class="list-item"><span class="title">${escapeHtml(s.name)}</span><span class="meta">${s.max_weight} kg · ${fmtDate(s.last_date)}</span></div>`).join('') : '<div class="empty">Log a strength workout with weights to see progression.</div>'}
        </div>
      </div>
    </div>
  `;

  Charts.line('chartWeight', p.history.map(h => fmtDate(h.date)), [{ label: 'Weight (kg)', data: p.history.map(h => h.weight_kg), borderColor: Charts.palette.lime, backgroundColor: 'rgba(198,255,61,0.12)' }]);
  Charts.bar('chartDuration', p.durationTrend.map(d => fmtDayLabel(d.date)), [{ label: 'Minutes', data: p.durationTrend.map(d => d.minutes), backgroundColor: Charts.palette.sky }]);

  document.getElementById('quickWeightBtn').addEventListener('click', async () => {
    const val = parseFloat(document.getElementById('quickWeight').value);
    if (!val) return;
    await Api.progress.logWeight({ weight: val }).catch(() => {});
    Views.progress(el);
  });
};

// ============================================================
// ANALYTICS
// ============================================================
Views.analytics = async (el, range = 30) => {
  el.innerHTML = '<div class="empty">Loading analytics…</div>';
  const a = await Api.analytics(range).catch(() => null);
  if (!a) { el.innerHTML = '<div class="empty">Could not load analytics.</div>'; return; }

  const typeLabels = Object.keys(a.typeBreakdown);
  const typeColors = [Charts.palette.lime, Charts.palette.coral, Charts.palette.sky, Charts.palette.amber, '#B084F5', '#F589C1'];
  const muscleLabels = Object.keys(a.muscleDistribution);

  el.innerHTML = `
    <div class="chip-row">
      ${[7, 30, 90, 365].map(r => `<div class="chip ${r === range ? 'active' : ''}" data-range="${r}">${r === 365 ? '1 year' : r + ' days'}</div>`).join('')}
    </div>

    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card stat-card"><div class="label">Workouts</div><div class="value lime">${a.totals.workouts}</div></div>
      <div class="card stat-card"><div class="label">Calories burned</div><div class="value coral">${a.totals.calories}</div></div>
      <div class="card stat-card"><div class="label">Training consistency</div><div class="value">${a.consistencyPct}%</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card"><h2>Workouts over time</h2><div class="chart-box"><canvas id="chartTimeSeries"></canvas></div></div>
      <div class="card"><h2>Workout type breakdown</h2><div class="chart-box">${typeLabels.length ? '<canvas id="chartTypes"></canvas>' : '<div class="empty">No workouts in this range.</div>'}</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card"><h2>Muscle group distribution</h2><div class="chart-box">${muscleLabels.length ? '<canvas id="chartMuscle"></canvas>' : '<div class="empty">Log exercises within a workout to see this.</div>'}</div></div>
      <div class="card">
        <h2>Personal records</h2>
        <div class="list">
          ${a.personalRecords.strongestLifts.map(r => `<div class="list-item"><span class="title">${escapeHtml(r.name)}</span><span class="meta">${r.weight} kg</span></div>`).join('')}
          ${a.personalRecords.longestWorkout ? `<div class="list-item"><span class="title">Longest workout</span><span class="meta">${a.personalRecords.longestWorkout.duration_min} min (${escapeHtml(a.personalRecords.longestWorkout.type)})</span></div>` : ''}
          ${a.personalRecords.mostCalories ? `<div class="list-item"><span class="title">Most calories in one session</span><span class="meta">${a.personalRecords.mostCalories.calories} kcal (${escapeHtml(a.personalRecords.mostCalories.type)})</span></div>` : ''}
          ${!a.personalRecords.strongestLifts.length && !a.personalRecords.longestWorkout ? '<div class="empty">No data yet.</div>' : ''}
        </div>
      </div>
    </div>
  `;

  Charts.bar('chartTimeSeries', a.timeSeries.map(t => fmtDate(t.date)), [{ label: 'Workouts', data: a.timeSeries.map(t => t.count), backgroundColor: Charts.palette.lime }]);
  if (typeLabels.length) Charts.doughnut('chartTypes', typeLabels, typeLabels.map(t => a.typeBreakdown[t]), typeColors);
  if (muscleLabels.length) Charts.doughnut('chartMuscle', muscleLabels, muscleLabels.map(m => a.muscleDistribution[m]), typeColors);

  el.querySelectorAll('[data-range]').forEach(chip => chip.addEventListener('click', () => Views.analytics(el, Number(chip.dataset.range))));
};

// ============================================================
// GOALS
// ============================================================
Views.goals = async (el) => {
  el.innerHTML = '<div class="empty">Loading goals…</div>';
  const goals = await Api.goals.list().catch(() => []);

  el.innerHTML = `
    <button class="btn btn-primary" id="gAdd" style="margin-bottom:16px">+ Create goal</button>
    <div class="grid grid-2">
      ${goals.length ? goals.map(g => `
        <div class="card">
          <div class="card-title-row">
            <h3>${escapeHtml(g.title)} ${demoBadge(g)}${g.status === 'completed' ? '<span class="badge good">Completed</span>' : ''}</h3>
            <div class="actions"><button class="icon-btn" data-edit="${g.id}">✎</button><button class="icon-btn danger" data-del="${g.id}">✕</button></div>
          </div>
          <div class="meta" style="margin-bottom:8px">${g.current_value} / ${g.target_value}${escapeHtml(g.unit || '')}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${g.progress_pct}%"></div></div>
          ${g.status !== 'completed' ? `<button class="btn btn-sm" style="margin-top:12px" data-complete="${g.id}">Mark complete</button>` : ''}
        </div>
      `).join('') : '<div class="empty">No goals yet. Create your first one.</div>'}
    </div>
  `;

  document.getElementById('gAdd').addEventListener('click', () => Forms.goal(() => Views.goals(el)));
  el.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const g = goals.find(x => String(x.id) === btn.dataset.edit);
    Forms.goal(() => Views.goals(el), g);
  }));
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this goal?')) return;
    await Api.goals.remove(btn.dataset.del).catch(() => {});
    Views.goals(el);
  }));
  el.querySelectorAll('[data-complete]').forEach(btn => btn.addEventListener('click', async () => {
    await Api.goals.update(btn.dataset.complete, { status: 'completed' }).catch(() => {});
    Views.goals(el);
  }));
};

// ============================================================
// NUTRITION
// ============================================================
Views.nutrition = async (el) => {
  el.innerHTML = '<div class="empty">Loading nutrition…</div>';
  const [today, week] = await Promise.all([Api.nutrition.today().catch(() => null), Api.nutrition.week().catch(() => [])]);
  if (!today) { el.innerHTML = '<div class="empty">Could not load nutrition data.</div>'; return; }

  const macro = (label, value, target, color) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>${label}</span><span>${Math.round(value)} / ${target}${label === 'Calories' ? ' kcal' : 'g'}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round((value / target) * 100))}%;background:${color}"></div></div>
    </div>`;

  el.innerHTML = `
    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card">
        <h2>Today's intake</h2>
        ${macro('Calories', today.totals.calories, today.targets.calories, Charts.palette.lime)}
        ${macro('Protein', today.totals.protein, today.targets.protein, Charts.palette.sky)}
        ${macro('Carbs', today.totals.carbs, today.targets.carbs, Charts.palette.amber)}
        ${macro('Fat', today.totals.fat, today.targets.fat, Charts.palette.coral)}
        <button class="btn btn-primary" id="nAdd" style="margin-top:8px">+ Log food</button>
      </div>
      <div class="card"><h2>Calories, last 7 days</h2><div class="chart-box"><canvas id="chartNutritionWeek"></canvas></div></div>
    </div>

    <div class="card">
      <h2>Today's entries</h2>
      <div class="list">
        ${today.entries.length ? today.entries.map(n => `
          <div class="list-item">
            <div><div class="title">${escapeHtml(n.food_name)}${demoBadge(n)}</div><div class="meta">${n.meal_type} · ${n.calories} kcal · P${n.protein_g}g C${n.carbs_g}g F${n.fat_g}g</div></div>
            <button class="icon-btn danger" data-del="${n.id}">✕</button>
          </div>
        `).join('') : '<div class="empty">No food logged today.</div>'}
      </div>
    </div>
  `;

  Charts.bar('chartNutritionWeek', week.map(w => fmtDayLabel(w.date)), [{ label: 'Calories', data: week.map(w => w.calories), backgroundColor: Charts.palette.lime }]);

  document.getElementById('nAdd').addEventListener('click', () => Forms.nutrition(() => Views.nutrition(el)));
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    await Api.nutrition.remove(btn.dataset.del).catch(() => {});
    Views.nutrition(el);
  }));
};

Views.history = async (el) => {
  const now = new Date();
  const defaultMonth = now.toISOString().slice(0, 7);

  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <h2>📅 Fitness History</h2>
      <p style="color:var(--text-dim);font-size:12px">
        View your daily and weekly fitness data for any month.
      </p>
      <input type="month" id="historyMonth" value="${defaultMonth}">
    </div>

    <div id="historyContent">
      <div class="empty">Loading history...</div>
    </div>
  `;

  const loadHistory = async () => {
    const month = document.getElementById('historyMonth').value;
    if (!month) return;

    const box = document.getElementById('historyContent');
    box.innerHTML = '<div class="empty">Loading history...</div>';

    try {
      const data = await Api.history.month(month);

      const m = data.monthly;
      const daily = data.daily;

      const weeks = {};

      daily.forEach(day => {
        const date = new Date(day.date);
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        monday.setHours(0, 0, 0, 0);

        const key = monday.getTime();

        if (!weeks[key]) {
          weeks[key] = {
            start: monday,
            workouts: 0,
            workout_calories: 0,
            workout_minutes: 0,
            nutrition_calories: 0
          };
        }

        weeks[key].workouts += day.workout_count;
        weeks[key].workout_calories += day.workout_calories;
        weeks[key].workout_minutes += day.workout_minutes;
        weeks[key].nutrition_calories += day.nutrition_calories;
      });

      const weekRows = Object.values(weeks)
        .sort((a, b) => a.start - b.start)
        .map((w, i) => {
          const end = new Date(w.start);
          end.setDate(end.getDate() + 6);

          return `
            <div class="list-item">
              <div>
                <strong>Week ${i + 1}</strong>
                <div style="color:var(--text-dim);font-size:12px">
                  ${w.start.toLocaleDateString()} - ${end.toLocaleDateString()}
                </div>
              </div>
              <div style="text-align:right;font-size:12px">
                <div>🏋️ ${w.workouts} workouts</div>
                <div>🔥 ${w.workout_calories} kcal</div>
                <div>🍽️ ${w.nutrition_calories} kcal food</div>
              </div>
            </div>
          `;
        }).join('');

      const dailyRows = daily.map(day => `
        <div class="list-item">
          <div>
            <strong>${new Date(day.date).toLocaleDateString()}</strong>
          </div>
          <div style="text-align:right;font-size:12px">
            🏋️ ${day.workout_count} workouts |
            🔥 ${day.workout_calories} kcal |
            🍽️ ${day.nutrition_calories} kcal
          </div>
        </div>
      `).join('');

      box.innerHTML = `
        <div class="grid grid-2" style="margin-bottom:18px">
          <div class="card">
            <h3>🏋️ Workouts</h3>
            <div class="stat">${m.workouts}</div>
          </div>

          <div class="card">
            <h3>🔥 Workout Calories</h3>
            <div class="stat">${m.workout_calories}</div>
          </div>

          <div class="card">
            <h3>⏱️ Workout Minutes</h3>
            <div class="stat">${m.workout_minutes}</div>
          </div>

          <div class="card">
            <h3>🍽️ Nutrition Calories</h3>
            <div class="stat">${m.nutrition_calories}</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:18px">
          <h2>📆 Weekly Monday–Sunday</h2>
          <div class="list">
            ${weekRows || '<div class="empty">No weekly data recorded.</div>'}
          </div>
        </div>

        <div class="card">
          <h2>📋 Daily History</h2>
          <div class="list">
            ${dailyRows || '<div class="empty">No data recorded for this month.</div>'}
          </div>
        </div>
      `;

    } catch (error) {
      box.innerHTML = `
        <div class="empty">
          Could not load history.
        </div>
      `;
    }
  };

  document.getElementById('historyMonth')
    .addEventListener('change', loadHistory);

  await loadHistory();
};

// ============================================================
// AI COACH
// ============================================================
Views.coach = async (el) => {
  el.innerHTML = '<div class="empty">Analyzing your training data…</div>';
  const c = await Api.coach().catch(() => ({ messages: [] }));
  el.innerHTML = `
    <div class="card">
      <h2>PULSE AI Coach</h2>
      <p style="color:var(--text-dim);font-size:12.5px;margin-bottom:16px">
        A local, rule-based coaching engine — every message below is generated directly from your own logged workouts, with no external AI service involved.
      </p>
      ${c.messages.length ? c.messages.map(m => `<div class="coach-msg ${toneClass(m.tone)}"><span class="dot">●</span><span>${escapeHtml(m.text)}</span></div>`).join('') : '<div class="empty">Log a few workouts to unlock coaching.</div>'}
    </div>
  `;
};

// ============================================================
// ACTIVITY
// ============================================================
Views.activity = async (el) => {
  el.innerHTML = '<div class="empty">Loading activity…</div>';
  const rows = await Api.activity(50).catch(() => []);
  const iconFor = (type) => ({ workout: '🏋️', weight: '⚖️', goal: '🎯', nutrition: '🍽️', pr: '🏆' }[type] || '•');

  el.innerHTML = `
    <div class="card">
      <h2>Activity timeline</h2>
      <div class="list">
        ${rows.length ? rows.map(r => `
          <div class="list-item">
            <div><div class="title">${iconFor(r.type)}${escapeHtml(r.description)}</div><div class="meta">${fmtDate(r.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
          </div>
        `).join('') : '<div class="empty">No activity yet.</div>'}
      </div>
    </div>
  `;
};

// ============================================================
// PROFILE
// ============================================================
Views.profile = async (el) => {
  el.innerHTML = '<div class="empty">Loading profile…</div>';
  const u = await Api.profile.get().catch(() => null);
  if (!u) { el.innerHTML = '<div class="empty">Could not load profile.</div>'; return; }

  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <h2>Your details</h2>
        <div class="field"><label>Name</label><input id="pName" value="${escapeHtml(u.name || '')}"></div>
        <div class="field-row">
          <div class="field"><label>Age</label><input id="pAge" type="number" value="${u.age ?? ''}"></div>
          <div class="field"><label>Gender</label>
            <select id="pGender">
              ${['unspecified', 'female', 'male', 'other'].map(g => `<option value="${g}" ${u.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Height (cm)</label><input id="pHeight" type="number" value="${u.height_cm ?? ''}"></div>
          <div class="field"><label>Weight (kg)</label><input id="pWeight" type="number" step="0.1" value="${u.weight_kg ?? ''}"></div>
        </div>
        <div class="field"><label>Goal weight (kg)</label><input id="pGoalWeight" type="number" step="0.1" value="${u.goal_weight_kg ?? ''}"></div>
      </div>
    </div>
  `;
};
