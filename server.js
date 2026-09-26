// server.js
// PULSE - AI Fitness Tracker. Entry point: wires up Express, the SQLite
// database (created automatically on first run), and every API route.

const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db/database'); // creates pulse.db and seeds demo data on first run

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/workouts', require('./workouts'));
app.use('/api/exercises', require('./exercises'));
app.use('/api/goals', require('./goals'));
app.use('/api/nutrition', require('./nutrition'));
app.use('/api/progress', require('./progress'));
app.use('/api', require('./user'));      // /api/profile, /api/settings
app.use('/api', require('./insights'));  // /api/dashboard, /api/analytics, /api/coach, /api/activity

// Any unmatched /api route -> clean 404 JSON instead of falling through to the SPA.
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route' }));

// Everything else serves the single-page app shell; client-side JS handles routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PULSE server running at http://localhost:${PORT}`);
});
