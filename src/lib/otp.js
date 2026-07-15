/**
 * @file otp.js
 * @description طبقة التحقق بخطوتين (2FA). حالياً تستخدم كود ثابت "1234" للاختبار
 * ريثما يتم تفعيل مزوّد رسائل حقيقي. كل التعديل المطلوب لاحقاً محصور بدالة
 * requestOtp فقط — بقية الكود (LoginScreen) لن يحتاج أي تعديل.
 *
 * ── كيف تفعّل رسائل SMS حقيقية لاحقاً ──
 * الخيارات الشائعة (كلها مدفوعة لكل رسالة، ما فيه خدمة SMS مجانية بالكامل):
 *   1) Twilio          — الأشهر عالمياً، ~0.01-0.05$/رسالة، فيه رصيد تجريبي مجاني بالبداية
 *   2) WhatsApp Cloud API (Meta) — أرخص من SMS غالباً لو أغلب الموظفين عندهم واتساب
 *   3) Firebase Phone Auth — نفس فكرة Twilio لكن مدمج مع Google، ~0.01-0.06$/رسالة
 * البديل المجاني الحقيقي: إرسال الكود عبر البريد الإلكتروني (مجاني تماماً عبر Supabase Auth
 * أو أي SMTP) بدل SMS — مناسب جداً لعدد موظفين محدود مثل هذا التطبيق.
 *
 * لتفعيل أي منها: علّق/احذف سطر "TEST MODE" أدناه، وضع استدعاء API الحقيقي مكانه،
 * ثم بدّل otpVerify لتتحقق من الكود عبر الخادم (RPC في Supabase) بدل المقارنة المحلية.
 */

const TEST_MODE_CODE = '1234'

// يرسل كود التحقق. حالياً (وضع اختبار) لا يرسل أي رسالة فعلية، فقط يطبع بالكونسول.
export async function requestOtp(phone) {
  console.log(`📤 [وضع اختبار] كود التحقق لـ ${phone} هو: ${TEST_MODE_CODE}`)
  // TODO: عند تفعيل مزوّد حقيقي، استبدل هذا بطلب API فعلي، مثال تقريبي مع Twilio:
  // await fetch('/api/send-otp', { method: 'POST', body: JSON.stringify({ phone }) })
  await new Promise(r => setTimeout(r, 400)) // محاكاة زمن شبكة بسيط
  return { success: true }
}

// يتحقق من الكود المُدخل من الموظف
export function verifyOtp(code) {
  return code.trim() === TEST_MODE_CODE
}

export function isTestMode() {
  return true // بدّلها لـ false يدوياً بمجرد ربط مزوّد رسائل حقيقي، كتذكير مرئي بالواجهة
}

// يخفي كل أرقام الهاتف ما عدا آخر رقمين، لعرضه بأمان بالواجهة
export function maskPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\s+/g, '')
  if (digits.length <= 2) return digits
  return '•'.repeat(Math.max(digits.length - 2, 4)) + digits.slice(-2)
}
