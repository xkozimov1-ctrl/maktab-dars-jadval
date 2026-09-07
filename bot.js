import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { readData } from './db.js';

const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');

dotenv.config();

// Barcha sinflar ro'yxati
function getClassList() {
  return [
    '5A', '5B',
    '6A', '6B',
    '7A', '7B', '7D',
    '8A', '8B', '8D',
    '9A', '9B', '9D', '9A(U)',
    '10A', '10B', '10D', '10A(U)', '10B(U)',
    '11A', '11B', '11D', '11A(U)'
  ];
}

// Sinf tugmalarini yaratish (3 ta ustun)
function getClassButtons() {
  const classes = getClassList();
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

// Asosiy menyu tugmalari
function getMainMenuButtons() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "📚 Dars jadvali" }],
        [{ text: "ℹ️ Bot haqida" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Dars jadvalini formatlash
function formatTimetable(selectedClass, timetable) {
  const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma'];
  let message = `📚 *${selectedClass} sinf Dars Jadvali*\n\n`;

  days.forEach(day => {
    const lessons = timetable[day];
    if (lessons && lessons.length > 0) {
      message += `🗓 *${day}:*\n`;
      let hasLesson = false;
      
      lessons.forEach((lesson, idx) => {
        if (lesson && lesson.subject && lesson.subject.trim() !== '') {
          hasLesson = true;
          const room = lesson.room ? ` (${lesson.room}-xona)` : '';
          const teacher = lesson.teacher ? ` - ${lesson.teacher}` : '';
          message += `  ${idx + 1}. *${lesson.subject}*${room}${teacher}\n`;
        }
      });
      
      if (!hasLesson) {
        message += `  _📭 Darslar yo'q_\n`;
      }
      message += `\n`;
    } else {
      message += `🗓 *${day}:*\n  _📭 Darslar yo'q_\n\n`;
    }
  });

  return message;
}

// Xatoliklarni log qilish
function logError(context, error) {
  console.error(`❌ Bot xatosi (${context}):`, error.message || error);
}

export function initBot() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    console.log("⚠️ BOT_TOKEN topilmadi. Telegram bot o'chirilgan.");
    return null;
  }

  try {
    const bot = new TelegramBot(token, {
      polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 }
      }
    });

    // Polling xatoliklarini boshqarish
    bot.on('polling_error', (error) => {
      logError('Polling', error);
    });

    bot.on('webhook_error', (error) => {
      logError('Webhook', error);
    });

    // ============ /start komandasi ============
    bot.onText(/\/start/, (msg) => {
      try {
        const chatId = msg.chat.id;
        const firstName = msg.from?.first_name || 'Foydalanuvchi';
        
        bot.sendMessage(
          chatId,
          `👋 *Assalomu alaykum, ${firstName}!*\n\n` +
          `📚 *Maktab Dars Jadvali botiga xush kelibsiz!*\n\n` +
          `🤖 Bu bot orqali maktab dars jadvallarini tez va qulay tarzda ko'rishingiz mumkin.\n\n` +
          `👨‍💻 *Yaratuvchi:* Kozimov Xushnudbek\n` +
          `🔗 *Telegram:* @thekzmv\n\n` +
          `📌 Quyidagi tugmalardan birini tanlang:`,
          {
            parse_mode: 'Markdown',
            ...getMainMenuButtons()
          }
        );
      } catch (error) {
        logError('/start', error);
      }
    });

    // ============ /help komandasi ============
    bot.onText(/\/help/, (msg) => {
      try {
        const chatId = msg.chat.id;
        bot.sendMessage(
          chatId,
          `🆘 *Yordam menyusi*\n\n` +
          `📌 *Qanday foydalaniladi?*\n` +
          `1️⃣ "📚 Dars jadvali" tugmasini bosing\n` +
          `2️⃣ Kerakli sinfni tanlang\n` +
          `3️⃣ Dars jadvalini ko'ring\n\n` +
          `📌 *Buyruqlar:*\n` +
          `/start - Botni qayta ishga tushirish\n` +
          `/help - Yordam olish\n` +
          `/about - Bot haqida ma'lumot\n\n` +
          `👨‍💻 *Muallif:* Kozimov Xushnudbek\n` +
          `📱 *Telegram:* @thekzmv`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        logError('/help', error);
      }
    });

    // ============ /about komandasi ============
    bot.onText(/\/about/, (msg) => {
      try {
        const chatId = msg.chat.id;
        bot.sendMessage(
          chatId,
          `ℹ️ *Bot haqida ma'lumot*\n\n` +
          `📚 *Nomi:* Maktab Dars Jadvali Bot\n` +
          `🤖 *Versiya:* 1.0.0\n` +
          `📅 *Yaratilgan sana:* 2025-yil\n\n` +
          `👨‍💻 *Yaratuvchi:* Kozimov Xushnudbek\n` +
          `📱 *Telegram:* @thekzmv\n` +
          `💻 *Tillar:* JavaScript, Node.js\n\n` +
          `📌 *Funksiyalar:*\n` +
          `✅ Barcha sinflar jadvali\n` +
          `✅ Tezkor qidiruv\n` +
          `✅ Qulay interfeys`,
          {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
      } catch (error) {
        logError('/about', error);
      }
    });

    // ============ Matnli xabarlarni qayta ishlash ============
    bot.on('message', async (msg) => {
      try {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return;
        if (text.startsWith('/')) return; // Komandalarni o'tkazib yuboramiz

        // "📚 Dars jadvali" tugmasi bosilganda
        if (text === '📚 Dars jadvali') {
          bot.sendMessage(
            chatId,
            "📚 *Sinfni tanlang:*\n\nQuyidagi sinflardan birini tanlang:",
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: getClassButtons()
              }
            }
          );
          return;
        }

        // "ℹ️ Bot haqida" tugmasi bosilganda
        if (text === 'ℹ️ Bot haqida') {
          bot.sendMessage(
            chatId,
            `ℹ️ *Bot haqida ma'lumot*\n\n` +
            `📚 *Nomi:* Maktab Dars Jadvali Bot\n` +
            `🤖 *Versiya:* 1.0.0\n\n` +
            `👨‍💻 *Yaratuvchi:* Kozimov Xushnudbek\n` +
            `📱 *Telegram:* @thekzmv\n\n` +
            `📌 *Funksiyalar:*\n` +
            `✅ Barcha sinflar jadvali\n` +
            `✅ Tezkor qidiruv\n` +
            `✅ Qulay interfeys`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [
                  [{ text: "📚 Dars jadvali" }],
                  [{ text: "ℹ️ Bot haqida" }]
                ],
                resize_keyboard: true
              }
            }
          );
          return;
        }

        // Sinf nomi yozilsa (masalan: "5A" deb yozsa)
        const classes = getClassList();
        if (classes.includes(text.trim())) {
          const selectedClass = text.trim();
          const serverData = await readData();
          const timetable = serverData.timetable?.[selectedClass];

          if (!timetable || Object.keys(timetable).length === 0) {
            bot.sendMessage(
              chatId,
              `❌ *${selectedClass} sinf* uchun dars jadvali hali kiritilmagan.\n\n` +
              `📌 Iltimos, boshqa sinfni tanlang yoki administrator bilan bog'laning.`,
              { parse_mode: 'Markdown' }
            );
            return;
          }

          const message = formatTimetable(selectedClass, timetable);
          
          bot.sendMessage(
            chatId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 Boshqa sinfni tanlash", callback_data: "select_other" }],
                  [{ text: "📋 Asosiy menyu", callback_data: "main_menu" }]
                ]
              }
            }
          );
          return;
        }

      } catch (error) {
        logError('Message handler', error);
      }
    });

    // ============ Callback query ============
    bot.on('callback_query', async (query) => {
      try {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('class_')) {
          const selectedClass = data.replace('class_', '');
          const serverData = await readData();
          const timetable = serverData.timetable?.[selectedClass];

          if (!timetable || Object.keys(timetable).length === 0) {
            bot.answerCallbackQuery(query.id, {
              text: `❌ ${selectedClass} sinf uchun dars jadvali mavjud emas!`,
              show_alert: true
            });
            return;
          }

          const message = formatTimetable(selectedClass, timetable);
          
          await bot.editMessageText(
            message,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 Boshqa sinfni tanlash", callback_data: "select_other" }],
                  [{ text: "📋 Asosiy menyu", callback_data: "main_menu" }]
                ]
              }
            }
          );

          bot.answerCallbackQuery(query.id, {
            text: `✅ ${selectedClass} sinf jadvali yuklandi`,
            show_alert: false
          });
          return;
        }

        if (data === 'select_other') {
          await bot.editMessageText(
            "📚 *Sinfni tanlang:*\n\nQuyidagi sinflardan birini tanlang:",
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: getClassButtons()
              }
            }
          );
          bot.answerCallbackQuery(query.id);
          return;
        }

        if (data === 'main_menu') {
          await bot.deleteMessage(chatId, query.message.message_id);
          
          bot.sendMessage(
            chatId,
            `📚 *Asosiy menyu*\n\nQuyidagi tugmalardan birini tanlang:`,
            {
              parse_mode: 'Markdown',
              ...getMainMenuButtons()
            }
          );
          bot.answerCallbackQuery(query.id);
          return;
        }

        bot.answerCallbackQuery(query.id);

      } catch (error) {
        logError('Callback query', error);
        try {
          bot.answerCallbackQuery(query.id, {
            text: "❌ Xatolik yuz berdi! Iltimos, qaytadan urinib ko'ring.",
            show_alert: true
          });
        } catch (e) {
          // Ignore
        }
      }
    });

    console.log("🤖 Telegram Bot muvaffaqiyatli ishga tushdi!");
    
    bot.getMe().then((botInfo) => {
      console.log(`✅ Bot: @${botInfo.username}`);
    }).catch((error) => {
      logError('getMe', error);
    });

    return bot;

  } catch (error) {
    console.error("❌ Botni ishga tushirishda xato:", error);
    return null;
  }
}

export function getBotInfo() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    return { status: 'disabled', message: 'BOT_TOKEN topilmadi' };
  }
  
  return {
    status: 'active',
    token: token.substring(0, 10) + '...',
    botUrl: 'https://t.me/maktab1son_bot'
  };
}