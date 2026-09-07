import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'maktab_dars_jadvali_secret_key_2026';
const DATA_FILE = path.join(__dirname, 'data.json');

// Gemini AI Klientini sozlash
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer (Xotirada fayllarni saqlash)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Ma'lumotlarni o'qish va yozish
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { timetable: {}, lessonCounts: {} };
  }
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// JWT Tokenni tekshirish Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan!" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token yaroqsiz yoki muddati o'tgan!" });
    req.user = user;
    next();
  });
}

// ================= API ENDPOINTS =================

// 1. Admin login (Moslashuvchan parol va turdagi ma'lumotlarni qabul qilish)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const envPassword = process.env.ADMIN_PASSWORD;

  // Agar Render Environment Variable'da ADMIN_PASSWORD o'rnatilmagan bo'lsa, defolt 'admin123' ishlaydi
  const validPassword = envPassword ? String(envPassword).trim() : 'admin123';
  const inputPassword = password ? String(password).trim() : '';

  if (inputPassword === validPassword) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  
  res.status(401).json({ error: "Parol noto'g'ri!" });
});

// 2. Dars jadvalini olish
app.get('/api/timetable/:className', async (req, res) => {
  try {
    const data = await readData();
    const className = req.params.className;
    
    const schedule = data.timetable?.[className] || {};
    const counts = data.lessonCounts?.[className] || {};

    res.json({ timetable: schedule, lessonCounts: counts });
  } catch (err) {
    res.status(500).json({ error: "Ma'lumotlarni yuklashda xatolik!" });
  }
});

// 3. Dars jadvalini saqlash (Admin)
app.post('/api/timetable/save', authenticateToken, async (req, res) => {
  try {
    const { className, timetable, lessonCounts } = req.body;

    if (!className) {
      return res.status(400).json({ error: "Sinf nomi ko'rsatilmadi!" });
    }

    const data = await readData();
    if (!data.timetable) data.timetable = {};
    if (!data.lessonCounts) data.lessonCounts = {};

    data.timetable[className] = timetable;
    data.lessonCounts[className] = lessonCounts;

    await writeData(data);
    res.json({ success: true, message: "Dars jadvali muvaffaqiyatli saqlandi!" });
  } catch (err) {
    res.status(500).json({ error: "Saqlashda xatolik yuz berdi!" });
  }
});

// 4. Gemini AI orqali faylni/rasmni tahlil qilib dars jadvaliga o'tkazish
app.post('/api/timetable/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi!" });
    }

    const { className } = req.body;
    if (!className) {
      return res.status(400).json({ error: "Sinf tanlanmagan!" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Render platformasida GEMINI_API_KEY sozlanmagan!" });
    }

    const prompt = `Ushbu rasmdagi/hujjatdagi "${className}" sinfining dars jadvalini aniq o'qib oling.
Javobni FAQAT QUYIDAGI SOF JSON FORMATIDA qaytaring (hech qanday markdown \`\`\`json belgilari va ortiqcha tushuntirishlarsiz):
{
  "Dushanba": [{"subject": "Fan nomi", "teacher": "O'qituvchi", "room": "Xona"}],
  "Seshanba": [],
  "Chorshanba": [],
  "Payshanba": [],
  "Juma": []
}
Ahamiyat bering:
1. Katak bo'sh bo'lsa subject, teacher va room qiymatlarini bo'sh matn "" qiling.
2. Kun nomlari faqat Dushanba, Seshanba, Chorshanba, Payshanba, Juma ko'rinishida bo'lsin.`;

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [prompt, imagePart]
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^