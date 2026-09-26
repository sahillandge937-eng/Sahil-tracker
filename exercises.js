// routes/exercises.js
const express = require('express');
const router = express.Router();
const { db } = require('../utils');

// GET /api/exercises?search=&muscle_group=&category=&difficulty=
router.get('/', (req, res) => {
  const { search, muscle_group, category, difficulty } = req.query;
  let sql = 'SELECT * FROM exercises WHERE 1=1';
  const params = [];

  if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
  if (muscle_group) { sql += ' AND muscle_group = ?'; params.push(muscle_group); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (difficulty) { sql += ' AND difficulty = ?'; params.push(difficulty); }

  sql += ' ORDER BY name ASC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/exercises  (add a custom exercise to the library)
router.post('/', (req, res) => {
  const { name, muscle_group, category, difficulty, description } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Exercise name is required' });

  const info = db.prepare(`
    INSERT INTO exercises (name, muscle_group, category, difficulty, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), muscle_group || 'General', category || 'Strength', difficulty || 'Beginner', description || '');

  res.status(201).json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
