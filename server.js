const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Main root folder se static files serve karne ke liye
app.use(express.static(__dirname));

// Fallback route index.html ke liye
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
