const express = require('express');
const crypto = require('crypto');

const router = express.Router();
const { db } = require('./utils');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// September 2026 demo workout history
function seedSeptemberData(userId) {
  const workoutData = [
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

  const insert = db.prepare(`
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

  workoutData.forEach(w => {
    insert.run(
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

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Please fill all fields.'
    });
  }

  try {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);

    if (existing) {
      return res.status(400).json({
        error: 'Email already registered.'
      });
    }

    const passwordHash = hashPassword(password);

    const result = db.prepare(`
      INSERT INTO users
      (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(
      name,
      email,
      passwordHash
    );

    // Add September historical data for this new user
    seedSeptemberData(result.lastInsertRowid);

    res.json({
      success: true,
      message: 'Account created successfully.'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Registration failed.'
    });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Please enter email and password.'
    });
  }

  try {
    const user = db
      .prepare(`
        SELECT id, name, email, password_hash
        FROM users
        WHERE email = ?
      `)
      .get(email);

    if (
      !user ||
      user.password_hash !== hashPassword(password)
    ) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    res.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Login failed.'
    });
  }
});

module.exports = router;
