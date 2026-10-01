const express = require('express');
const crypto = require('crypto');

const router = express.Router();
const { db } = require('./utils');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
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

    db.prepare(`
      INSERT INTO users
      (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(
      name,
      email,
      passwordHash
    );

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
