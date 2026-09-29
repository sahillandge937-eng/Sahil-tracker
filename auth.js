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
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name, email, passwordHash);

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

module.exports = router;
