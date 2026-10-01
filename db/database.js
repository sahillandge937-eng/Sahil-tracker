// db/database.js
// Creates (if needed) and opens the SQLite database, defines the schema,
// adds user ownership to personal data, and initializes base data.

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
    type TEXT NOT NULL,
    target_value REAL NOT NULL,
    unit TEXT,
    status TEXT DEFAULT 'active',
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
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    date INTEGER NOT NULL
  );
`);

// ---------------------------------------------------------------------
// User Data Migration
// ---------------------------------------------------------------------

function addUserIdColumn(tableName) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  const hasUserId = columns.some(
    column => column.name === 'user_id'
  );

  if (!hasUserId) {
    db.prepare(
      `ALTER TABLE ${tableName} ADD COLUMN user_id INTEGER`
    ).run();
  }
}

[
  'workouts',
  'weight_logs',
  'goals',
  'nutrition',
  'activity_logs'
].forEach(addUserIdColumn);

// Existing records belong to the original/default user.
db.prepare(`
  UPDATE workouts
  SET user_id = 1
  WHERE user_id IS NULL
`).run();

db.prepare(`
  UPDATE weight_logs
  SET user_id = 1
  WHERE user_id IS NULL
`).run();

db.prepare(`
  UPDATE goals
  SET user_id = 1
  WHERE user_id IS NULL
`).run();

db.prepare(`
  UPDATE nutrition
  SET user_id = 1
  WHERE user_id IS NULL
`).run();

db.prepare(`
  UPDATE activity_logs
  SET user_id = 1
  WHERE user_id IS NULL
`).run();

// ---------------------------------------------------------------------
// Essential Base Seeding
// ---------------------------------------------------------------------

function seed() {
  const userCount = db
    .prepare('SELECT COUNT(*) c FROM users')
    .get().c;

  if (userCount === 0) {
    db.prepare(`
      INSERT INTO users (
        id,
        name,
        age,
        height_cm,
        weight_kg,
        gender,
        fitness_goal,
        activity_level,
        weekly_workout_target,
        calorie_target,
        protein_target,
        carb_target,
        fat_target,
        goal_weight_kg,
        weight_unit,
        theme,
        notifications_enabled
      )
      VALUES (
        1,
        'Athlete',
        22,
        172,
        70,
        'unspecified',
        'Build strength & endurance',
        'moderately active',
        4,
        2200,
        150,
        250,
        70,
        66,
        'kg',
        'dark',
        1
      )
    `).run();
  }

  const exerciseCount = db
    .prepare('SELECT COUNT(*) c FROM exercises')
    .get().c;

  if (exerciseCount === 0) {
    const exercises = [
      [
        'Bench Press',
        'Chest',
        'Strength',
        'Intermediate',
        'Barbell press performed lying on a flat bench, targeting the chest, shoulders and triceps.'
      ],
      [
        'Squats',
        'Legs',
        'Strength',
        'Intermediate',
        'Compound lower-body movement targeting quads, glutes and hamstrings.'
      ],
      [
        'Deadlift',
        'Back',
        'Strength',
        'Advanced',
        'Full posterior-chain lift from the floor, key for total-body strength.'
      ],
      [
        'Pull Ups',
        'Back',
        'Bodyweight',
        'Intermediate',
        'Vertical pulling movement targeting the lats and biceps.'
      ],
      [
        'Push Ups',
        'Chest',
        'Bodyweight',
        'Beginner',
        'Classic bodyweight press for chest, shoulders and triceps.'
      ],
      [
        'Shoulder Press',
        'Shoulders',
        'Strength',
        'Intermediate',
        'Overhead press targeting the deltoids and triceps.'
      ],
      [
        'Bicep Curl',
        'Arms',
        'Strength',
        'Beginner',
        'Isolation movement for the biceps using dumbbells or a barbell.'
      ],
      [
        'Tricep Extension',
        'Arms',
        'Strength',
        'Beginner',
        'Isolation movement targeting the triceps.'
      ],
      [
        'Lunges',
        'Legs',
        'Bodyweight',
        'Beginner',
        'Single-leg movement building quad, glute and balance strength.'
      ],
      [
        'Running',
        'Cardio',
        'Cardio',
        'Beginner',
        'Steady-state or interval cardio for endurance and calorie burn.'
      ],
      [
        'Cycling',
        'Cardio',
        'Cardio',
        'Beginner',
        'Low-impact cardio for endurance and leg conditioning.'
      ],
      [
        'Plank',
        'Core',
        'Bodyweight',
        'Beginner',
        'Isometric core hold that builds trunk stability.'
      ],
      [
        'Lat Pulldown',
        'Back',
        'Strength',
        'Beginner',
        'Machine pulldown targeting the lats, a pull-up alternative.'
      ],
      [
        'Leg Press',
        'Legs',
        'Strength',
        'Beginner',
        'Machine-based compound push for the quads, glutes and hamstrings.'
      ]
    ];

    const insert = db.prepare(`
      INSERT INTO exercises
      (
        name,
        muscle_group,
        category,
        difficulty,
        description
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      rows.forEach(row => insert.run(...row));
    });

    insertMany(exercises);
  }
}

// ---------------------------------------------------------------------
// Previous Month Demo Data - September 2026
// ---------------------------------------------------------------------
// Creates September demo data for every registered user.
// It checks first, so the same demo data is not duplicated.

function seedPreviousMonthData() {
  const start = Date.UTC(2026, 8, 1);
  const end = Date.UTC(2026, 9, 1);

  const users = db.prepare(`
    SELECT id
    FROM users
  `).all();

  const workouts = [
    ['Run', 30, 5, 320, 2],
    ['Strength', 45, null, 280, 5],
    ['Cycle', 50, 12, 420, 7],
    ['HIIT', 35, null, 360, 10],
    ['Yoga', 40, null, 160, 12],
    ['Run', 35, 5.5, 350, 14],
    ['Strength', 50, null, 310, 17],
    ['Cycle', 45, 10, 380, 20],
    ['HIIT', 30, null, 330, 24],
    ['Run', 40, 6, 390, 28]
  ];

  const nutrition = [
    ['Breakfast', 450, 18, 60, 15, 2],
    ['Lunch', 650, 30, 75, 20, 2],
    ['Dinner', 550, 25, 55, 18, 2],
    ['Snack', 250, 8, 30, 10, 2],

    ['Breakfast', 420, 17, 55, 14, 5],
    ['Lunch', 620, 29, 72, 19, 5],
    ['Dinner', 570, 26, 58, 18, 5],

    ['Breakfast', 460, 19, 62, 15, 9],
    ['Lunch', 640, 31, 74, 20, 9],
    ['Dinner', 560, 25, 57, 18, 9],

    ['Breakfast', 440, 18, 58, 14, 14],
    ['Lunch', 630, 30, 73, 19, 14],
    ['Dinner', 580, 27, 59, 19, 14],

    ['Breakfast', 455, 18, 60, 15, 20],
    ['Lunch', 660, 31, 76, 21, 20],
    ['Dinner', 540, 24, 54, 17, 20],

    ['Breakfast', 430, 17, 57, 14, 24],
    ['Lunch', 645, 30, 74, 20, 24],
    ['Dinner', 565, 26, 56, 18, 24],

    ['Breakfast', 470, 19, 63, 15, 28],
    ['Lunch', 650, 31, 75, 20, 28],
    ['Dinner', 560, 25, 57, 18, 28]
  ];

  users.forEach(user => {
    const userId = user.id;

    // ---------------------------------------------------------------
    // September Workouts
    // ---------------------------------------------------------------

    const workoutExists = db.prepare(`
      SELECT COUNT(*) c
      FROM workouts
      WHERE is_demo = 1
        AND user_id = ?
        AND date >= ?
        AND date < ?
    `).get(
      userId,
      start,
      end
    ).c;

    if (workoutExists === 0) {
      const insertWorkout = db.prepare(`
        INSERT INTO workouts
        (
          type,
          date,
          duration_min,
          distance_km,
          difficulty,
          calories,
          notes,
          is_demo,
          user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);

      workouts.forEach(w => {
        insertWorkout.run(
          w[0],
          Date.UTC(2026, 8, w[4], 12),
          w[1],
          w[2],
          3,
          w[3],
          'Sample historical workout',
          userId
        );
      });
    }

    // ---------------------------------------------------------------
    // September Nutrition
    // ---------------------------------------------------------------

    const nutritionExists = db.prepare(`
      SELECT COUNT(*) c
      FROM nutrition
      WHERE is_demo = 1
        AND user_id = ?
        AND date >= ?
        AND date < ?
    `).get(
      userId,
      start,
      end
    ).c;

    if (nutritionExists === 0) {
      const insertNutrition = db.prepare(`
        INSERT INTO nutrition
        (
          food_name,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          meal_type,
          date,
          is_demo,
          user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `);

      nutrition.forEach(n => {
        insertNutrition.run(
          n[0],
          n[1],
          n[2],
          n[3],
          n[4],
          n[0],
          Date.UTC(2026, 8, n[5], 13),
          userId
        );
      });
    }
  });
}

// ---------------------------------------------------------------------
// Run initialization
// ---------------------------------------------------------------------

seed();
seedPreviousMonthData();

module.exports = db;
