import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { readData } from './db.js';

const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');

dotenv.config();

function getClassButtons() {
  const classes = [
    '5A', '5B',
    '6A', '6B',
    '7A', '7B', '7D',
    '8A', '8B', '8D',
    '9A', '9B', '9D', '9A(U)',
    '10A', '10B', '10D', '10A(U)', '10B(U)',
    '11A', '11B', '11D', '11A(U)'
  ];

  const keyboard = [];
  for (let i = 0; i < classes.length; i += 3) {
    keyboard.push(
      classes.slice(i, i + 3).map(cls => ({
        text: `${cls} sinf`,
        callback_data: `class_${cls}`
      }))
    );
  }

  return keyboard;
}

export function initBot() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.log("⚠️ BOT_TOKEN topilmadi. Telegram bot o'chirilgan.");
    return;
  }

  try {
    const bot = new TelegramBot(token, {
      polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 }
      }
    });

    bot.on('polling_error', (error) => {
      console.error("⚠️ Telegram Bot Polling Xatosi:", error.code || error.message);
    });

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, "👋 **Maktab Dars Jadvali botiga xush kelibsiz!**\n\nQaysi sinf dars jadvali kerak? Quyidagilardan tanlang:", {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: getClassButtons()
        }
      });
    });

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
  } catch (err) {
    console.error("Botni ishga tushirishda xato:", err);
  }
}
const TelegramBot = require('node-telegram-bot-api');

// Bot tokeningizni kiriting
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Footer textini qaytaruvchi funksiya
const getFooterText = () => {
  return "\n\n───────────────────\n" +
         "👨‍💻 *Dasturchi:* Kozimov Xushnudbek\n" +
         "🤖 *Rasmiy bot:* @maktab1son_bot";
};

// /start buyrug'i uchun ishlovchi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const text = 
    "👋 *Maktab dars jadvali botiga xush kelibsiz!*\n\n" +
    "Ushbu bot orqali siz sinflarning kunlik dars jadvalini osongina topishingiz mumkin." +
    getFooterText();

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 Dars jadvalini ko\'rish', callback_data: 'view_schedule' }
        ],
        [
          { text: '👨‍💻 Dasturchi bilan bog\'lanish', url: 'https://t.me/maktab1son_bot' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, text, options);
});

// /about yoki /help buyrug'i uchun
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;

  const text = 
    "ℹ️ *Tizim haqida*\n\n" +
    "Maktab o'quvchilari va o'qituvchilari uchun mo'ljallangan dars jadvali platformasi." +
    getFooterText();

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});