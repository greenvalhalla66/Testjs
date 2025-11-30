const { Telegraf } = require('telegraf');
const fs = require('fs/promises');
const path = require('path');

require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const DATA_FILE = path.join(__dirname, 'users.json');

// Логирование
const log = (level, message, ctx) => {
  const userId = ctx?.from?.id || 'unknown';
  console[level](`[${level.toUpperCase()}] ${message} (user: ${userId})`);
};

// Загрузка пользователей
async function loadUsers() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    // Валидация структуры
    if (!Array.isArray(parsed)) {
      log('warn', 'users.json содержит некорректные данные, сбрасываем', null);
      return [];
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    log('error', `Ошибка чтения users.json: ${err.message}`, null);
    return [];
  }
}

// Сохранение пользователей
async function saveUsers(users) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    log('error', `Ошибка записи users.json: ${err.message}`, null);
  }
}

// Проверка админа
function isAdmin(ctx) {
  if (!ctx.from || !ctx.from.id) return false;
  return ctx.from.id.toString() === process.env.ADMIN_ID;
}

// Старт
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  let users = await loadUsers();
  
  const user = users.find(u => u.id === userId);
  if (!user) {
    users.push({
      id: userId,
      balance: 0,
      referrals: [],
      referredBy: null
    });
    await saveUsers(users);
    ctx.reply('Добро пожаловать! Вы зарегистрированы.');
  } else {
    ctx.reply('Вы уже зарегистрированы.');
  }
});

// Реферальная ссылка
bot.command('referral', (ctx) => {
  ctx.reply(
    `Ваша реферальная ссылка:\n` +
    `https://t.me/your_bot_username?start=${ctx.from.id}`
  );
});

// Баланс
bot.command('balance', async (ctx) => {
  const users = await loadUsers();
  const user = users.find(u => u.id === ctx.from.id.toString());
  if (user) {
    ctx.reply(`Ваш баланс: $${user.balance.toFixed(2)}`);
  } else {
    ctx.reply('Ошибка: пользователь не найден.');
  }
});

// Админ-меню
bot.command('admin', (ctx) => {
  if (!isAdmin(ctx)) {
    ctx.reply('Доступ запрещен.');
    return;
  }
  ctx.reply(
    'Админ-панель:\n' +
    '/stats — Статистика\n' +
    '/pay <id> <сумма> — Начислить средства\n' +
    '/broadcast <текст> — Рассылка всем'
  );
});

// Статистика
bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const users = await loadUsers();
  ctx.reply(
    `📊 Статистика:\n\n` +
    `Всего пользователей: ${users.length}\n` +
    `Общий баланс: $${users.reduce((sum, u) => sum + u.balance, 0).toFixed(2)}`
  );
});

// Начисление средств
bot.command('pay', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.trim().split(/\s+/);
  if (args.length !== 3) {
    ctx.reply('Используйте: /pay <id> <сумма>');
    return;
  }

  const [, userId, amountStr] = args;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    ctx.reply('Сумма должна быть положительным числом.');
    return;
  }

  let users = await loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    ctx.reply('Пользователь не найден.');
    return;
  }

  user.balance += amount;
  await saveUsers(users);
  ctx.reply(`✅ Начислено $${amount.toFixed(2)} пользователю ${userId}`);
});

// Рассылка
bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const message = ctx.message.text.trim().split(/\s+/).slice(1).join(' ');
  if (!message) {
    ctx.reply('Введите текст рассылки после команды.');
    return;
  }

  const users = await loadUsers();
  let sentCount = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.id, `📢 ${message}`);
      sentCount++;
    } catch (err) {
      log('error', `Не удалось отправить пользователю ${user.id}: ${err.message}`, ctx);
    }
  }

  ctx.reply(`Рассылка отправлена ${sentCount}/${users.length} пользователям.`);
});

// Обработка реферальных ссылок
bot.on('text', async (ctx) => {
  const text = ctx.message?.text?.trim();
  if (text?.startsWith('/start ') && text.length > 8) {
    const referrerId = text.split(' ')[1];
    const userId = ctx.from.id.toString();

    let users = await loadUsers();
    const existingUser = users.find(u => u.id === userId);

    if (existingUser && !existingUser.referredBy) {
      existingUser.referredBy = referrerId;
      const referrer = users.find(u => u.id === referrerId);

      if (referrer) {
        referrer.referrals.push(userId);
        referrer.balance += 10; // Бонус за привлечение
        await saveUsers(users);
        ctx.reply(
          'Вы зарегистрированы по реферальной ссылке!\n' +
          'Ваш реферер получил бонус $10.'
        );
      }
    }
  }
});

// Обработка ошибок бота
bot.catch((err, ctx) => {
  log('error', `Неожиданная ошибка: ${err.message}`, ctx);
  if (ctx) {
    ctx.reply('Произошла ошибка. Попробуйте позже.');