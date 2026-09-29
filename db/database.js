// db/database.js
// Creates (if needed) and opens the SQLite database, defines the schema,
// and initializes essential base user & exercise data.

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'pulse.db'));
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT 'Athlete',
    email TEXT,
    password_hash TEXT,
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
// Essential Base Seeding
// ---------------------------------------------------------------------
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
}

seed();

module.exports = db;
