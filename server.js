import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { initBot } from './bot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'maktabadmin1234';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'timetable.json');

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { timetable: {}, lessonCounts: {} };
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Token topilmadi!" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Yaroqsiz token!" });
    req.user = user;
    next();
  });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Parol noto\'g\'ri!' });
});

app.get('/api/timetable', async (req, res) => {
  const data = await readData();
  res.json(data);
});

app.post('/api/timetable/lesson', authenticateToken, async (req, res) => {
  const { className, day, lessonIndex, lessonData } = req.body;

  const data = await readData();
  if (!data.timetable[className]) data.timetable[className] = {};
  if (!data.timetable[className][day]) data.timetable[className][day] = [];

  data.timetable[className][day][lessonIndex] = lessonData;

  await writeData(data);
  res.json({ success: true, message: 'Dars saqlandi!' });
});

app.delete('/api/timetable/lesson', authenticateToken, async (req, res) => {
  const { className, day, lessonIndex } = req.body;

  const data = await readData();
  if (data.timetable[className]?.[day]?.[lessonIndex] !== undefined) {
    data.timetable[className][day][lessonIndex] = null;
    await writeData(data);
  }

  res.json({ success: true, message: 'Dars o\'chirildi!' });
});

app.post('/api/timetable/count', authenticateToken, async (req, res) => {
  const { className, day, count } = req.body;

  const data = await readData();
  if (!data.lessonCounts[className]) data.lessonCounts[className] = {};

  data.lessonCounts[className][day] = count;

  await writeData(data);
  res.json({ success: true, message: 'Soatlar soni yangilandi!' });
});

// GEMINI AI ORQALI FAYLNI O'QISH
app.post('/api/timetable/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi!" });
    }

    const { className } = req.body;
    if (!className) {
      return res.status(400).json({ error: "Sinf tanlanmagan!" });
    }

    const prompt = `Ushbu fayldagi/rasmdagi "${className}" sinf dars jadvalini o'qib oling.
Natijani FAQAT QUYIDAGI SOF JSON FORMATIDA qaytaring (hech qanday markdown \`\`\`json belgilari va ortiqcha matnlarsiz):
{
  "Dushanba": [{"subject": "Fan nomi", "teacher": "O'qituvchi", "room": "Xona"}],
  "Seshanba": [],
  "Chorshanba": [],
  "Payshanba": [],
  "Juma": []
}
Agar katak bo'sh bo'lsa subject, teacher, room qiymatini bo'sh string "" qiling. Kun nomlari faqat Dushanba, Seshanba, Chorshanba, Payshanba, Juma bo'lsin.`;

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart]
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');

    const parsedTimetable = JSON.parse(text);

    const data = await readData();
    if (!data.timetable) data.timetable = {};
    if (!data.lessonCounts) data.lessonCounts = {};

    data.timetable[className] = parsedTimetable;
    if (!data.lessonCounts[className]) data.lessonCounts[className] = {};

    Object.keys(parsedTimetable).forEach(day => {
      data.lessonCounts[className][day] = parsedTimetable[day].length;
    });

    await writeData(data);
    res.json({ success: true, message: `${className} sinfi uchun dars jadvali AI orqali to'ldirildi!` });

  } catch (error) {
    console.error("AI Upload error:", error);
    res.status(500).json({ error: "Faylni tahlil qilishda xatolik yuz berdi. Gemini API kalitingiz va fayl formatini tekshiring." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
  
  setTimeout(() => {
    initBot();
  }, 2000);
});