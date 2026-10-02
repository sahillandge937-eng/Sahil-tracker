const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sample In-Memory Workouts Database
let workouts = [
  { id: 1, type: 'Strength Training', name: 'Bench Press & Arms', duration: 45, calories: 340, date: new Date().toISOString() },
  { id: 2, type: 'Cardio / Running', name: 'Morning Jog', duration: 30, calories: 290, date: new Date().toISOString() }
];

// API Routes
app.get('/api/workouts', (req, res) => {
  res.json(workouts);
});

app.post('/api/workouts', (req, res) => {
  const newWorkout = {
    id: Date.now(),
    type: req.body.type || 'Workout',
    name: req.body.name || 'General Exercise',
    duration: parseInt(req.body.duration) || 30,
    calories: parseInt(req.body.calories) || 200,
    date: new Date().toISOString()
  };
  workouts.unshift(newWorkout);
  res.status(201).json(newWorkout);
});

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
