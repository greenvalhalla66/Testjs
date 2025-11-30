const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Загрузка переменных окружения
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Путь к файлу с данными пользователей
const DATA_FILE = path.join(__dirname, 'users.json');

// Загрузка данных пользователей
let users = [];
if (fs.existsSync(DATA_FILE)) {
  users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Сохранение данных пользователей
function saveUsers() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

// Проверка, является ли пользователь админом
function isAdmin(ctx) {
  return ctx.from.id.toString() === process.env.ADMIN_ID;
}

// Старт
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    users.push({
      id: userId,
      balance: 0,
      referrals: [],
      referredBy: null
    });
    saveUsers();
    ctx.reply('Добро пожаловать! Вы зарегистрированы.');
  } else {
    ctx.reply('Вы уже зарегистрированы.');
  }
});

// Реферальная ссылка
bot.command('referral', (ctx) => {
  ctx.reply(`Ваша реферальная ссылка:\nhttps://t.me/yourbot?start=${ctx.from.id}`);
});

// Баланс
bot.command('balance', (ctx) => {
  const user = users.find(u => u.id === ctx.from.id.toString());
  ctx.reply(`Ваш баланс: $${user.balance}`);
});

// Админ-команды
bot.command('admin', (ctx) => {
  if (!isAdmin(ctx)) {
    ctx.reply('Доступ запрещен.');
    return;
  }

  ctx.reply(
    'Админ-панель:\n' +
    '/stats — Статистика\n' +
    '/pay <id> <сумма> — Начислить средства\n' +
    '/broadcast <текст> — Рассылка'
  );
});

bot.command('stats', (ctx) => {
  if (!isAdmin(ctx)) return;

  ctx.reply(
    `Всего пользователей: ${users.length}\n` +
    `Общий баланс: $${users.reduce((sum, u) => sum + u.balance, 0)}`
  );
});

bot.command('pay', (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    ctx.reply('Используйте: /pay <id> <сумма>');
    return;
  }

  const [, userId, amount] = args;
  const user = users.find(u => u.id === userId);
  if (!user) {
    ctx.reply('Пользователь не найден.');
    return;
  }

  user.balance += parseFloat(amount);
  saveUsers();
  ctx.reply(`Начислено $${amount} пользователю ${userId}`);
});

bot.command('broadcast', (ctx) => {
  if (!isAdmin(ctx)) return;

  const message = ctx.message.text.split(' ').slice(1).join(' ');
  if (!message) {
    ctx.reply('Введите текст рассылки.');
    return;
  }

  users.forEach(user => {
    bot.telegram.sendMessage(user.id, `📢 Администрация: ${message}`);
  });

  ctx.reply('Рассылка отправлена.');
});

// Обработка реферальных ссылок
bot.on('text', (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/start ') && text.length > 7) {
    const referrerId = text.split(' ')[1];
    const userId = ctx.from.id.toString();

    const existingUser = users.find(u => u.id === userId);
    if (existingUser && !existingUser.referredBy) {
      existingUser.referredBy = referrerId;
      const referrer = users.find(u => u.id === referrerId);
      if (referrer) {
        referrer.referrals.push(userId);
        referrer.balance += 10; // Бонус за привлечение
        saveUsers();
        ctx.reply('Вы зарегистрированы по реферальной ссылке! Реферер получил бонус.');
      }
    }
  }
});

module.exports = bot;
