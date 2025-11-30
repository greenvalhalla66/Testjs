const express = require('express');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Статические файлы (простая HTML-панель)
app.use(express.static('public'));

// API для статистики
app.get('/api/stats', (req, res) => {
  const DATA_FILE = path.join(__dirname, 'users.json');
  let users = [];

  if (fs.existsSync(DATA_FILE)) {
    users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  res.json({
    totalUsers: users.length,
    totalBalance: users.reduce((sum, u) => sum + u.balance, 0),
    users: users.map(u => ({
      id: u.id,
      balance: u.balance,
      referrals: u.referrals.length
    }))
  });
});

app.listen(PORT, () => {
  console.log(`Админ-панель запущена на http://localhost:${PORT}`);
});
