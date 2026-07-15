# تطبيق مندوب المبيعات - نقاء

## 📱 التشغيل السريع (بدون أي إعداد إضافي)

مجلد `android/` جاهز بالكامل — فيه نسخة الواجهة مبنية ومدموجة داخله فعلاً.

1. افتح **Android Studio**
2. `Open` → اختر مجلد `android` (وليس المجلد الرئيسي)
3. انتظر "Gradle Sync" يخلص (يحتاج إنترنت أول مرة لتحميل SDK/Gradle تلقائياً)
4. اضغط ▶ Run على جهازك أو المحاكي (Emulator)

## 🔑 بيانات Supabase المستخدمة
مأخوذة من ملف `.env` اللي بالمشروع (نفس القيم من صورتك):
```
VITE_SUPABASE_URL=https://uehyjvsgflrkcluoquij.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YhnviRd_HZ_m4w-gFvyI_Q_EspSixA2
```
هذا المفتاح "publishable/anon" آمن تماماً وضعه بالتطبيق — هذا الغرض منه أصلاً.
الحماية الحقيقية تكون عبر Row Level Security بقاعدة Supabase.

⚠️ لاحظ: التطبيق يحتاج الجداول التالية موجودة فعلاً بمشروع Supabase (بما فيها
RPC function اسمها `verify_employee_login`): `employees`, `stores`, `products`, `orders`.
لو أي جدول ناقص أو بأسماء أعمدة مختلفة، التطبيق راح يعطي أخطاء عند التشغيل.

## 🔧 لو تحتاج تعدّل الكود (React) وتعيد البناء
يحتاج جهازك: Node.js 18+ مثبّت.

```bash
npm install
npm run build
npx cap sync android
```
بعدها افتح `android/` من جديد بـ Android Studio (أو اضغط Gradle Sync لو كان مفتوح أصلاً).

## 📷 صلاحيات مطلوبة (مضبوطة مسبقاً بـ AndroidManifest.xml)
- الكاميرا (لمسح رمز QR الخاص بالمحلات)
- البلوتوث (BLUETOOTH_SCAN / BLUETOOTH_CONNECT) لطباعة الفواتير على طابعة حرارية BLE

## 🖨️ ملاحظة مهمة عن الطباعة
تم استخدام مكتبة `@capacitor-community/bluetooth-le` (وليس Web Bluetooth) لأنها
الطريقة الوحيدة التي تعمل فعلياً داخل تطبيق Android مبني بـ Capacitor. لم يتم
اختبارها على طابعة فعلية بعد — جرّبها من التطبيق نفسه (شاشة إتمام الطلبية → زر
"اختبار" بجانب زر الطباعة) وأخبرني بالنتيجة بالضبط لأي تعديل مطلوب.

لو طابعتك من نوع Bluetooth Classic (SPP) وليس BLE، هذا الحل لن يتصل بها إطلاقاً —
أخبرني ونبني حل بديل (Native plugin مخصص).

## 🔑 التحقق الثنائي (OTP)
حالياً الكود ثابت `1234` للاختبار. لتفعيل SMS حقيقي، عدّل ملف واحد فقط:
`src/lib/otp.js` (فيه شرح الخيارات المتاحة بالتفصيل).
