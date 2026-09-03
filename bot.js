import TelegramBot from 'node-telegram-bot-api';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN .env faylida topilmadi!");
  process.exit(1);
}

// Botni polling rejimida ishga tushirish
const bot = new TelegramBot(token, { polling: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'timetable.json');

// JSON ma'lumotlarni o'qish
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { timetable: {}, lessonCounts: {} };
  }
}

// Sinf tugmalarini shakllantirish
function getClassButtons() {
  const classes = [];
  for (let i = 5; i <= 11; i++) {
    classes.push(`${i}-A`, `${i}-B`);
  }

  // Tugmalarni 3 tadan qatorma-qator joylashtirish
  const keyboard = [];
  for (let i = 0; i < classes.length; i += 3) {
    keyboard.push(classes.slice(i, i + 3).map(cls => ({ text: `${cls} sinf`, callback_data: `class_${cls}` })));
  }

  return keyboard;
}

// /start komandasi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "👋 **Maktab Dars Jadvali botiga xush kelibsiz!**\n\nQaysi sinf dars jadvali kerak? Quyidagilardan tanlang:", {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: getClassButtons()
    }
  });
});

// Tugma bosilganda ishlaydigan qism (Callback query)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('class_')) {
    const selectedClass = data.replace('class_', '');
    const serverData = await readData();
    const timetable = serverData.timetable?.[selectedClass];

    if (!timetable || Object.keys(timetable).length === 0) {
      bot.answerCallbackQuery(query.id, { text: "Ushbu sinf uchun dars jadvali hali kiritilmagan.", show_alert: true });
      return;
    }

    const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma'];
    let message = `📚 **${selectedClass} sinf Dars Jadvali**\n\n`;

    days.forEach(day => {
      const lessons = timetable[day];
      if (lessons && lessons.length > 0) {
        message += `🗓 **${day}:**\n`;
        let hasLesson = false;
        lessons.forEach((lesson, idx) => {
          if (lesson && lesson.subject) {
            hasLesson = true;
            const room = lesson.room ? `(${lesson.room}-xona)` : '';
            const teacher = lesson.teacher ? `- ${lesson.teacher}` : '';
            message += `  ${idx + 1}. **${lesson.subject}** ${room} ${teacher}\n`;
          }
        });
        if (!hasLesson) message += `  _Darslar yo'q_\n`;
        message += `\n`;
      }
    });

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Boshqa sinfni tanlash", callback_data: "select_other" }]
        ]
      }
    });
  } else if (data === 'select_other') {
    bot.sendMessage(chatId, "Sinfni tanlang:", {
      reply_markup: {
        inline_keyboard: getClassButtons()
      }
    });
  }

  bot.answerCallbackQuery(query.id);
});

console.log("🤖 Telegram Bot ishga tushdi...");