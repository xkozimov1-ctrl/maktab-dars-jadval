import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ SUPABASE_URL yoki SUPABASE_SERVICE_KEY topilmadi. Supabase ulanmagan bo'lishi mumkin.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Barcha sinflar uchun to'liq ma'lumotni Supabase'dan o'qish
export async function readData() {
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
    return { timetable: {}, lessonCounts: {} };
  }
}

// Ma'lumotni Supabase'ga yozish
export async function writeData(data) {
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
}