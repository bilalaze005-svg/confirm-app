import { createClient } from '@supabase/supabase-js'

/**
 * @file supabase.js
 * @description عميل Supabase موحّد لكل التطبيق. القيم تُقرأ من ملف .env
 * (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY). مفتاح anon/publishable آمن
 * تماماً لوضعه بكود الواجهة (client-side) — هذا هو الغرض منه أصلاً، الحماية
 * الفعلية تكون عبر Row Level Security (RLS) بجداول Supabase نفسها.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export let configError = null
if (!url || !anonKey) {
  configError = '⚠️ إعدادات Supabase غير مكتملة — تأكد من وجود VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY بملف .env'
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-key'
)
