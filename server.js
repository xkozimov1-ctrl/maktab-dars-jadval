import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { initBot } from './bot.js';
import { readData, writeData } from './db.js';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'maktab_dars_jadvali_secret_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// JWT Middleware
function authenticateToken(req, res, next) {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Autentifikatsiya xatosi!" });
  }
}

// ================= API ENDPOINTS =================

// 1. Admin login
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body || {};
    const envPassword = process.env.ADMIN_PASSWORD;

    const validPassword = envPassword ? String(envPassword).trim() : 'admin123';
    const inputPassword = password ? String(password).trim() : '';

    if (inputPassword === validPassword) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ success: true, token });
    }

    res.status(401).json({ error: "Parol noto'g'ri!" });
  } catch (err) {
    res.status(500).json({ error: "Login jarayonida server xatosi." });
  }
});

// 2a. Barcha sinflar uchun to'liq ma'lumotni olish
app.get('/api/timetable', async (req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (err) {
    console.error("Error reading data:", err);
    // Agar Supabase ishlamasa, local fayldan o'qishga harakat qilamiz
    try {
      const localData = JSON.parse(fs.readFileSync('./timetable.json', 'utf8'));
      res.json(localData);
    } catch (e) {
      res.status(500).json({ error: "Ma'lumotlarni yuklashda xatolik!", details: err.message });
    }
  }
});

// 2b. Bitta sinf uchun jadvalni olish
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
    // Local faylga ham yozamiz (zaxira)
    fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Dars jadvali muvaffaqiyatli saqlandi!" });
  } catch (err) {
    res.status(500).json({ error: "Saqlashda xatolik yuz berdi!" });
  }
});

// 3b. Bitta kunning soatlar sonini o'zgartirish
app.post('/api/timetable/count', authenticateToken, async (req, res) => {
  try {
    const { className, day, count } = req.body || {};
    if (!className || !day || typeof count !== 'number') {
      return res.status(400).json({ error: "Noto'g'ri so'rov ma'lumotlari!" });
    }

    const data = await readData();
    if (!data.lessonCounts) data.lessonCounts = {};
    if (!data.lessonCounts[className]) data.lessonCounts[className] = {};
    data.lessonCounts[className][day] = Math.max(1, count);

    await writeData(data);
    fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Soatlar sonini yangilashda xatolik!" });
  }
});

// 3c. Bitta darsni qo'shish/tahrirlash
app.post('/api/timetable/lesson', authenticateToken, async (req, res) => {
  try {
    const { className, day, lessonIndex, lessonData } = req.body || {};
    if (!className || !day || lessonIndex === undefined || lessonIndex === null) {
      return res.status(400).json({ error: "Noto'g'ri so'rov ma'lumotlari!" });
    }

    const data = await readData();
    if (!data.timetable) data.timetable = {};
    if (!data.timetable[className]) data.timetable[className] = {};
    if (!Array.isArray(data.timetable[className][day])) data.timetable[className][day] = [];

    while (data.timetable[className][day].length <= lessonIndex) {
      data.timetable[className][day].push(null);
    }
    data.timetable[className][day][lessonIndex] = lessonData;

    await writeData(data);
    fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
    res.json({ success: true, message: "Dars saqlandi!" });
  } catch (err) {
    res.status(500).json({ error: "Darsni saqlashda xatolik!" });
  }
});

// 3d. Bitta darsni o'chirish
app.delete('/api/timetable/lesson', authenticateToken, async (req, res) => {
  try {
    const { className, day, lessonIndex } = req.body || {};
    if (!className || !day || lessonIndex === undefined || lessonIndex === null) {
      return res.status(400).json({ error: "Noto'g'ri so'rov ma'lumotlari!" });
    }

    const data = await readData();
    if (data.timetable?.[className]?.[day]?.[lessonIndex] !== undefined) {
      data.timetable[className][day][lessonIndex] = null;
      await writeData(data);
      fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
    }

    res.json({ success: true, message: "Dars o'chirildi!" });
  } catch (err) {
    res.status(500).json({ error: "Darsni o'chirishda xatolik!" });
  }
});

// 4. Gemini AI orqali faylni tahlil qilish
app.post('/api/timetable/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi!" });
    }

    const { className } = req.body;
    if (!className) {
      return res.status(400).json({ error: "Sinf tanlanmagan!" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY sozlanmagan!" });
    }

    // Gemini uchun Google GenAI kutubxonasini import qilamiz
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Ushbu rasmdagi/hujjatdagi "${className}" sinfining dars jadvalini aniq o'qib oling.
Javobni FAQAT QUYIDAGI SOF JSON FORMATIDA qaytaring (hech qanday markdown belgilari va ortiqcha tushuntirishlarsiz):
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
      model: 'gemini-2.0-flash-exp',
      contents: [prompt, imagePart]
    });

    let text = response.text.trim();
    text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();

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
    fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
    res.json({ success: true, message: `${className} sinfi uchun jadval AI orqali to'ldirildi!` });

  } catch (error) {
    console.error("AI Upload xatosi:", error);
    res.status(500).json({ 
      error: error.message || "Faylni AI orqali tahlil qilishda xatolik yuz berdi." 
    });
  }
});

// SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda muvaffaqiyatli ishga tushdi.`);
  initBot();
});