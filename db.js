import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ SUPABASE_URL yoki SUPABASE_SERVICE_KEY topilmadi. Local fayl ishlatiladi.");
}

// Local fayldan o'qish
function readLocalData() {
  try {
    const data = JSON.parse(fs.readFileSync('./timetable.json', 'utf8'));
    return data;
  } catch (e) {
    return { timetable: {}, lessonCounts: {} };
  }
}

// Local faylga yozish
function writeLocalData(data) {
  fs.writeFileSync('./timetable.json', JSON.stringify(data, null, 2));
}

// Barcha sinflar uchun to'liq ma'lumotni o'qish
export async function readData() {
  // Agar Supabase mavjud bo'lsa, undan o'qiymiz
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('timetable, lesson_counts')
        .eq('id', 1)
        .single();

      if (error) throw error;

      return {
        timetable: data?.timetable || {},
        lessonCounts: data?.lesson_counts || {}
      };
    } catch (err) {
      console.error("Supabase'dan o'qishda xatolik:", err.message || err);
      // Agar Supabase ishlamasa, local fayldan o'qiymiz
      return readLocalData();
    }
  }
  
  // Supabase yo'q bo'lsa, local fayldan o'qiymiz
  return readLocalData();
}

// Ma'lumotni yozish
export async function writeData(data) {
  // Har doim local faylga yozamiz (zaxira)
  writeLocalData(data);
  
  // Agar Supabase mavjud bo'lsa, unga ham yozamiz
  if (supabase) {
    try {
      const { error } = await supabase
        .from('app_data')
        .upsert({
          id: 1,
          timetable: data.timetable || {},
          lesson_counts: data.lessonCounts || {},
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error("Supabase'ga yozishda xatolik:", error.message || error);
        throw error;
      }
    } catch (err) {
      console.error("Supabase'ga yozishda xatolik:", err.message || err);
      // Local faylga yozilgan, shuning uchun xatolikni qaytarmaymiz
    }
  }
}