// db/database.js
// Creates (if needed) and opens the SQLite database, defines the schema,
// and seeds a small, clearly-flagged set of demo data on first run so the
// dashboard isn't empty the very first time the app is opened.

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'pulse.db'));
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT 'Athlete',
    age INTEGER,
    height_cm REAL,
    weight_kg REAL,
    gender TEXT,
    fitness_goal TEXT,
    activity_level TEXT,
    weekly_workout_target INTEGER DEFAULT 4,
    calorie_target INTEGER DEFAULT 2200,
    protein_target INTEGER DEFAULT 150,
    carb_target INTEGER DEFAULT 250,
    fat_target INTEGER DEFAULT 70,
    goal_weight_kg REAL,
    weight_unit TEXT DEFAULT 'kg',
    theme TEXT DEFAULT 'dark',
    notifications_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    muscle_group TEXT,
    category TEXT,
    difficulty TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    date INTEGER NOT NULL,
    duration_min INTEGER NOT NULL,
    distance_km REAL,
    difficulty INTEGER DEFAULT 3,
    calories INTEGER NOT NULL,
    notes TEXT,
    is_demo INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    sets INTEGER,
    reps INTEGER,
    weight_kg REAL,
    rest_seconds INTEGER,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
  );

  CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weight_kg REAL NOT NULL,
    date INTEGER NOT NULL,
    is_demo INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,          -- workouts_per_week | distance_per_week | target_weight | calories_per_week | streak
    target_value REAL NOT NULL,
    unit TEXT,
    status TEXT DEFAULT 'active', -- active | completed
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    deadline INTEGER,
    is_demo INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS nutrition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein_g REAL DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    meal_type TEXT DEFAULT 'Snack',
    date INTEGER NOT NULL,
    is_demo INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,          -- workout | weight | goal | nutrition | pr
    description TEXT NOT NULL,
    date INTEGER NOT NULL
  );
`);

// ---------------------------------------------------------------------
// Seeding (only runs the first time, per table)
// ---------------------------------------------------------------------
function daysAgoTs(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount === 0) {
    db.prepare(`
      INSERT INTO users (id, name, age, height_cm, weight_kg, gender, fitness_goal, activity_level,
        weekly_workout_target, calorie_target, protein_target, carb_target, fat_target, goal_weight_kg,
        weight_unit, theme, notifications_enabled)
      VALUES (1, 'Athlete', 22, 172, 70, 'unspecified', 'Build strength & endurance', 'moderately active',
        4, 2200, 150, 250, 70, 66, 'kg', 'dark', 1)
    `).run();
  }

  const exerciseCount = db.prepare('SELECT COUNT(*) c FROM exercises').get().c;
  if (exerciseCount === 0) {
    const exercises = [
      ['Bench Press', 'Chest', 'Strength', 'Intermediate', 'Barbell press performed lying on a flat bench, targeting the chest, shoulders and triceps.'],
      ['Squats', 'Legs', 'Strength', 'Intermediate', 'Compound lower-body movement targeting quads, glutes and hamstrings.'],
      ['Deadlift', 'Back', 'Strength', 'Advanced', 'Full posterior-chain lift from the floor, key for total-body strength.'],
      ['Pull Ups', 'Back', 'Bodyweight', 'Intermediate', 'Vertical pulling movement targeting the lats and biceps.'],
      ['Push Ups', 'Chest', 'Bodyweight', 'Beginner', 'Classic bodyweight press for chest, shoulders and triceps.'],
      ['Shoulder Press', 'Shoulders', 'Strength', 'Intermediate', 'Overhead press targeting the deltoids and triceps.'],
      ['Bicep Curl', 'Arms', 'Strength', 'Beginner', 'Isolation movement for the biceps using dumbbells or a barbell.'],
      ['Tricep Extension', 'Arms', 'Strength', 'Beginner', 'Isolation movement targeting the triceps.'],
      ['Lunges', 'Legs', 'Bodyweight', 'Beginner', 'Single-leg movement building quad, glute and balance strength.'],
      ['Running', 'Cardio', 'Cardio', 'Beginner', 'Steady-state or interval cardio for endurance and calorie burn.'],
      ['Cycling', 'Cardio', 'Cardio', 'Beginner', 'Low-impact cardio for endurance and leg conditioning.'],
      ['Plank', 'Core', 'Bodyweight', 'Beginner', 'Isometric core hold that builds trunk stability.'],
      ['Lat Pulldown', 'Back', 'Strength', 'Beginner', 'Machine pulldown targeting the lats, a pull-up alternative.'],
      ['Leg Press', 'Legs', 'Strength', 'Beginner', 'Machine-based compound push for the quads, glutes and hamstrings.']
    ];
    const insert = db.prepare('INSERT INTO exercises (name, muscle_group, category, difficulty, description) VALUES (?,?,?,?,?)');
    const insertMany = db.transaction((rows) => rows.forEach(r => insert.run(...r)));
    insertMany(exercises);
  }

  const workoutCount = db.prepare('SELECT COUNT(*) c FROM workouts').get().c;
  if (workoutCount === 0) {
    const insertWorkout = db.prepare(`
      INSERT INTO workouts (type, date, duration_min, distance_km, difficulty, calories, notes, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertWE = db.prepare(`
      INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight_kg, rest_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertActivity = db.prepare('INSERT INTO activity_logs (type, description, date) VALUES (?, ?, ?)');
    const benchId = db.prepare("SELECT id FROM exercises WHERE name = 'Bench Press'").get().id;
    const squatId = db.prepare("SELECT id FROM exercises WHERE name = 'Squats'").get().id;
    const runId = db.prepare("SELECT id FROM exercises WHERE name = 'Running'").get().id;

    const demoWorkouts = [
      { type: 'Strength', daysAgo: 5, duration: 50, distance: null, difficulty: 3, calories: 320, notes: 'Upper body day', ex: [[benchId, 4, 8, 60, 90]] },
      { type: 'Run', daysAgo: 4, duration: 30, distance: 5, difficulty: 3, calories: 310, notes: 'Easy morning run', ex: [[runId, 1, 1, null, 0]] },
      { type: 'Strength', daysAgo: 2, duration: 55, distance: null, difficulty: 4, calories: 340, notes: 'Leg day', ex: [[squatId, 4, 6, 80, 120]] },
      { type: 'HIIT', daysAgo: 1, duration: 25, distance: null, difficulty: 5, calories: 300, notes: 'Interval circuit', ex: [] }
    ];

    const seedTx = db.transaction(() => {
      demoWorkouts.forEach(w => {
        const ts = daysAgoTs(w.daysAgo);
        const info = insertWorkout.run(w.type, ts, w.duration, w.distance, w.difficulty, w.calories, w.notes);
        w.ex.forEach(([exerciseId, sets, reps, weight, rest]) => {
          insertWE.run(info.lastInsertRowid, exerciseId, sets, reps, weight, rest);
        });
        insertActivity.run('workout', `Logged a ${w.type} workout (${w.duration} min)`, ts);
      });
    });
    seedTx();
  }

  const weightCount = db.prepare('SELECT COUNT(*) c FROM weight_logs').get().c;
  if (weightCount === 0) {
    const insert = db.prepare('INSERT INTO weight_logs (weight_kg, date, is_demo) VALUES (?, ?, 1)');
    const seedTx = db.transaction(() => {
      insert.run(71.2, daysAgoTs(20));
      insert.run(70.6, daysAgoTs(13));
      insert.run(70.1, daysAgoTs(6));
      insert.run(69.7, daysAgoTs(1));
    });
    seedTx();
  }

  const goalCount = db.prepare('SELECT COUNT(*) c FROM goals').get().c;
  if (goalCount === 0) {
    const insert = db.prepare(`
      INSERT INTO goals (title, type, target_value, unit, status, created_at, is_demo)
      VALUES (?, ?, ?, ?, 'active', ?, 1)
    `);
    const seedTx = db.transaction(() => {
      insert.run('Workout 4 times per week', 'workouts_per_week', 4, 'workouts', daysAgoTs(10));
      insert.run('Run 20 km per week', 'distance_per_week', 20, 'km', daysAgoTs(10));
      insert.run('Reach 66 kg', 'target_weight', 66, 'kg', daysAgoTs(10));
    });
    seedTx();
  }

  const nutritionCount = db.prepare('SELECT COUNT(*) c FROM nutrition').get().c;
  if (nutritionCount === 0) {
    const insert = db.prepare(`
      INSERT INTO nutrition (food_name, calories, protein_g, carbs_g, fat_g, meal_type, date, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const today = daysAgoTs(0);
    const seedTx = db.transaction(() => {
      insert.run('Oats & banana', 420, 14, 68, 9, 'Breakfast', today);
      insert.run('Grilled chicken & rice', 650, 48, 70, 14, 'Lunch', today);
      insert.run('Greek yogurt', 150, 15, 9, 4, 'Snack', today);
    });
    seedTx();
  }
}

seed();

module.exports = db;
