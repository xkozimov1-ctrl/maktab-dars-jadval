import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'maktabadmin1234';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'timetable.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fayldan ma'lumot o'qish va yozish funksiyalari
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

// Admin Token tekshiruvchi Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(0x191).json({ error: "Token topilmadi!" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(0x193).json({ error: "Yaroqsiz token!" });
    req.user = user;
    next();
  });
}

// --- API ENDPOINTLAR ---

// 1. Admin login (Token olish)
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Parol noto\'g\'ri!' });
});

// 2. Barcha dars jadvalini olish (Public)
app.get('/api/timetable', async (req, res) => {
  const data = await readData();
  res.json(data);
});

// 3. Darsni saqlash yoki yangilash (Faqat Admin)
app.post('/api/timetable/lesson', authenticateToken, async (req, res) => {
  const { className, day, lessonIndex, lessonData } = req.body;

  const data = await readData();
  if (!data.timetable[className]) data.timetable[className] = {};
  if (!data.timetable[className][day]) data.timetable[className][day] = [];

  data.timetable[className][day][lessonIndex] = lessonData;

  await writeData(data);
  res.json({ success: true, message: 'Dars saqlandi!' });
});

// 4. Darsni o'chirish (Faqat Admin)
app.delete('/api/timetable/lesson', authenticateToken, async (req, res) => {
  const { className, day, lessonIndex } = req.body;

  const data = await readData();
  if (data.timetable[className]?.[day]?.[lessonIndex] !== undefined) {
    data.timetable[className][day][lessonIndex] = null;
    await writeData(data);
  }

  res.json({ success: true, message: 'Dars o\'chirildi!' });
});

// 5. Soatlar sonini o'zgartirish (Faqat Admin)
app.post('/api/timetable/count', authenticateToken, async (req, res) => {
  const { className, day, count } = req.body;

  const data = await readData();
  if (!data.lessonCounts[className]) data.lessonCounts[className] = {};

  data.lessonCounts[className][day] = count;

  await writeData(data);
  res.json({ success: true, message: 'Soatlar soni yangilandi!' });
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});