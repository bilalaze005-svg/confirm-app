import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { requestOtp, verifyOtp, maskPhone, isTestMode } from '../lib/otp.js'

const OTP_RESEND_SECONDS = 30

/**
 * @file LoginScreen.jsx
 * @description تسجيل دخول موظف تأكيد الطلبات على خطوتين:
 *   1) بريد/كلمة مرور عبر verify_employee_login (كما كانت)
 *   2) رمز تحقق (OTP) يُرسل لهاتف الموظف — راجع lib/otp.js لتفعيل مزوّد SMS حقيقي.
 * أي حساب موظف يُنشأ من admin → الموظفون يقدر يسجّل دخول هنا مباشرة بدون إعداد إضافي.
 */
export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('credentials') // 'credentials' | 'phone' | 'otp'
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const passRef = useRef(null)

  // بيانات جلسة معلّقة بانتظار إتمام OTP
  const [pendingUser, setPendingUser] = useState(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const otpRef = useRef(null)

  const canSubmit = login.trim() && pass && !loading

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const submit = async () => {
    if (!login.trim() || !pass) { setErr('أدخل البريد/الاسم وكلمة المرور'); return }
    if (!navigator.onLine) { setErr('📡 لا يوجد اتصال بالإنترنت — تحقق من الشبكة وحاول مجدداً'); return }
    setErr('')
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_employee_login', {
        p_login: login.trim(),
        p_password: pass,
      })
      if (error) throw error

      const emp = Array.isArray(data) ? data[0] : data
      if (!emp || !emp.emp_id) {
        setErr('البيانات غير صحيحة')
        setLoading(false)
        return
      }

      // ✅ تحقق من صلاحية الدخول لهذا التطبيق تحديداً (مضبوطة من لوحة الإدارة → الموظفون)
      let perms = {}
      if (emp.emp_permissions) {
        perms = typeof emp.emp_permissions === 'string' ? JSON.parse(emp.emp_permissions) : emp.emp_permissions
      }
      const hasAccess = (perms.storeOrdersApp || []).includes('view')
      if (!hasAccess) {
        setErr('حسابك ما عنده صلاحية الدخول لهذا التطبيق — تواصل مع الإدارة')
        setLoading(false)
        return
      }

      const sessionUser = { id: emp.emp_id, name: emp.emp_name }
      setPendingUser(sessionUser)

      // رقم الهاتف: نجرب رقم الموظف من قاعدة البيانات (لو الحقل موجود)، وإلا نطلبه
      // ونحفظه محلياً للمرات القادمة (كل موظف على جهازه الخاص غالباً)
      const savedPhone = localStorage.getItem(`nq_confirm_phone_${emp.emp_id}`)
      const dbPhone = emp.emp_phone || null
      const knownPhone = dbPhone || savedPhone

      if (knownPhone) {
        setPhone(knownPhone)
        await sendOtpTo(knownPhone)
        setStep('otp')
      } else {
        setStep('phone') // أول مرة، نطلب رقم الهاتف قبل إرسال الرمز
      }
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      const isNetworkError = e?.message?.toLowerCase().includes('fetch') || e?.message?.toLowerCase().includes('network')
      setErr(isNetworkError ? '📡 تعذّر الاتصال بالخادم — تحقق من الشبكة' : 'حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  const sendOtpTo = async (phoneNumber) => {
    try {
      await requestOtp(phoneNumber)
      setResendIn(OTP_RESEND_SECONDS)
    } catch (e) {
      console.error('❌ خطأ إرسال رمز التحقق:', e)
      setErr('تعذّر إرسال رمز التحقق، حاول مجدداً')
    }
  }

  const confirmPhone = async () => {
    const trimmed = phone.trim()
    if (trimmed.length < 8) { setErr('أدخل رقم هاتف صحيح'); return }
    setErr('')
    localStorage.setItem(`nq_confirm_phone_${pendingUser.id}`, trimmed)
    await sendOtpTo(trimmed)
    setStep('otp')
  }

  const submitOtp = () => {
    if (!verifyOtp(otp)) { setErr('❌ رمز التحقق غير صحيح'); return }
    localStorage.setItem('nq_confirm_employee', JSON.stringify(pendingUser))
    onLogin(pendingUser)
  }

  const backToCredentials = () => {
    setStep('credentials'); setErr(''); setOtp(''); setPendingUser(null)
  }

  // ── خطوة 3: إدخال رمز التحقق ──
  if (step === 'otp') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
        <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>📱</div>
            <h1 style={{ fontSize: 17, fontWeight: 900 }}>تحقق برمز الأمان</h1>
            <p style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>أُرسل رمز مكوّن من 4 أرقام إلى {maskPhone(phone)}</p>
            {isTestMode() && (
              <p style={{ fontSize: 11, color: T.warning, background: T.warningBg, borderRadius: 8, padding: '5px 8px', marginTop: 8, display: 'inline-block' }}>
                ⚠️ وضع اختبار: الرمز الحالي دائماً 1234
              </p>
            )}
          </div>

          <input
            ref={otpRef} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && otp.length === 4 && submitOtp()}
            inputMode="numeric" maxLength={4}
            style={{ ...inputStyle, textAlign: 'center', fontSize: 26, letterSpacing: 10, fontWeight: 900, marginBottom: 14 }}
            placeholder="••••"
          />

          {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

          <button onClick={submitOtp} disabled={otp.length !== 4}
            style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, marginBottom: 10, background: otp.length !== 4 ? T.textFaint : T.primaryGradient }}>
            ✅ تأكيد
          </button>

          <button onClick={() => sendOtpTo(phone)} disabled={resendIn > 0}
            style={{ background: 'none', border: 'none', color: resendIn > 0 ? T.textFaint : T.info, fontSize: 12.5, fontWeight: 700, width: '100%', padding: 8, cursor: resendIn > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ثانية` : '🔁 إعادة إرسال الرمز'}
          </button>
          <button onClick={backToCredentials} style={{ ...buttonGhost, width: '100%', padding: 12, fontSize: 12.5, marginTop: 4 }}>
            الرجوع لتسجيل الدخول
          </button>
        </div>
      </div>
    )
  }

  // ── خطوة 2 (أول مرة فقط): طلب رقم الهاتف لإرسال رمز التحقق ──
  if (step === 'phone') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
        <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>📱</div>
            <h1 style={{ fontSize: 17, fontWeight: 900 }}>رقم هاتفك</h1>
            <p style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>أول مرة تسجّل دخول — أدخل رقمك لإرسال رمز التحقق مستقبلاً</p>
          </div>

          <input
            autoFocus value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmPhone()}
            inputMode="tel" type="tel"
            style={{ ...inputStyle, marginBottom: 14, textAlign: 'center' }}
            placeholder="05xxxxxxxx"
          />

          {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

          <button onClick={confirmPhone} style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5 }}>
            📤 إرسال رمز التحقق
          </button>
        </div>
      </div>
    )
  }

  // ── خطوة 1: البريد/اسم المستخدم وكلمة المرور ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
      <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 14px' }}>🏬</div>
          <h1 style={{ fontSize: 19, fontWeight: 900, color: T.text }}>مندوب المبيعات</h1>
          <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 4 }}>سجّل دخولك للمتابعة</p>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>البريد الإلكتروني أو اسم المستخدم</label>
        <input
          value={login} onChange={(e) => setLogin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && passRef.current?.focus()}
          autoFocus
          autoComplete="username"
          inputMode="email"
          style={{ ...inputStyle, marginTop: 6, marginBottom: 14 }}
          placeholder="example@naqaa.com"
        />

        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>كلمة المرور</label>
        <div style={{ position: 'relative', marginTop: 6, marginBottom: 16 }}>
          <input
            ref={passRef}
            type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            autoComplete="current-password"
            style={{ ...inputStyle, paddingLeft: 44 }}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: T.textFaint, padding: 6 }}>
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>

        {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

        <button onClick={submit} disabled={!canSubmit}
          style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, background: !canSubmit ? T.textFaint : T.primaryGradient, boxShadow: !canSubmit ? 'none' : buttonPrimary.boxShadow, opacity: loading ? 0.85 : 1 }}>
          {loading ? '⏳ جارِ الدخول...' : '🔑 دخول'}
        </button>
      </div>
    </div>
  )
}
