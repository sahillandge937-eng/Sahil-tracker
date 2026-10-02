const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// Public directory absolute path setup
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// API routes handle hone ke baad baaki sabke liye index.html deliver karo
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
