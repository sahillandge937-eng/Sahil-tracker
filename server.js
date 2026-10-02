const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Main root directory se static files serve kar raha hai
app.use(express.static(path.join(__dirname)));

// Sample API Route
app.get('/api/workouts', (req, res) => {
  res.json([
    { id: 1, name: 'Bench Press', duration: 45, calories: 340 },
    { id: 2, name: 'Morning Jog', duration: 30, calories: 290 }
  ]);
});

// Main Root Index File Serve Kar Raha Hai
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
