import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, inputStyle } from '../lib/theme.js'
import { getOtpAuthUrl } from '../lib/totp.js'
import TotpEnrollScreen from './TotpEnrollScreen.jsx'

/**
 * @file LoginScreen.jsx
 * @description تسجيل دخول موظف تأكيد الطلبات بجلسة Supabase Auth حقيقية (aal2):
 *   1) بريد/كلمة مرور عبر verify_employee_login (كما كانت)
 *   2) جلسة Auth حقيقية (signInWithPassword/signUp تلقائي أول مرة)
 *   3) MFA حقيقي من Supabase (auth.mfa) — نفس واجهة QR القديمة، مربوطة
 *      الآن بعامل TOTP حقيقي يرفع الجلسة فعلياً لـaal2.
 */
export default function LoginScreen({ onLogin }) {
  // step: credentials | resync | enroll | totp
  const [step, setStep] = useState('credentials')
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const passRef = useRef(null)

  const [pendingUser, setPendingUser] = useState(null)
  const [pendingSecret, setPendingSecret] = useState(null)
  const [pendingFactorId, setPendingFactorId] = useState(null)
  const [pendingRealEmail, setPendingRealEmail] = useState(null)
  const [pendingPass, setPendingPass] = useState(null)
  const [code, setCode] = useState('')
  const [totpBusy, setTotpBusy] = useState(false)

  const canSubmit = login.trim() && pass && !loading

  const proceedToMfa = async (sessionUser) => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const verifiedTotp = (data?.totp || []).find(f => f.status === 'verified')

      if (verifiedTotp) {
        setPendingFactorId(verifiedTotp.id)
        setStep('totp')
      } else {
        // ⚠️ نزيل أي عامل TOTP سابق غير مُفعَّل (من محاولة إعداد لم تكتمل) قبل
        // إنشاء عامل جديد — وإلا يرفض Supabase الطلب بخطأ mfa_factor_name_conflict
        // لأن الاسم (friendlyName) محجوز مسبقاً بعامل معلّق.
        const staleTotp = (data?.totp || []).filter(f => f.status !== 'verified')
        for (const stale of staleTotp) {
          try { await supabase.auth.mfa.unenroll({ factorId: stale.id }) }
          catch (unenrollErr) { console.warn('⚠️ تعذّر إزالة عامل معلّق قديم:', unenrollErr) }
        }

        const { data: enroll, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `naqaa-confirm-${sessionUser.id}`,
        })
        if (enrollErr) throw enrollErr
        setPendingFactorId(enroll.id)
        setPendingSecret(enroll.totp.secret)
        setStep('enroll')
      }
    } catch (e) {
      console.error('❌ خطأ تجهيز التحقق الثنائي:', e)
      setErr('تعذّر تجهيز التحقق الثنائي، حاول مجدداً')
    }
    setLoading(false)
  }

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

      const realEmail = emp.emp_email || (login.trim().includes('@') ? login.trim() : null)
      if (!realEmail) {
        setErr('حسابك بلا بريد إلكتروني مسجّل — لازم لتفعيل الدخول الآمن، تواصل مع الإدارة')
        setLoading(false)
        return
      }

      let { error: signInErr } = await supabase.auth.signInWithPassword({ email: realEmail, password: pass })

      if (signInErr) {
        const { error: signUpErr } = await supabase.auth.signUp({ email: realEmail, password: pass })

        if (!signUpErr) {
          const retry = await supabase.auth.signInWithPassword({ email: realEmail, password: pass })
          if (retry.error) throw retry.error
        } else if (signUpErr.message?.toLowerCase().includes('already') || signUpErr.status === 422) {
          setErr('⚠️ حسابك يحتاج إعادة ضبط من الإدارة — تواصل معهم لإعادة تفعيل الدخول')
          setLoading(false)
          return
        } else {
          console.error('❌ خطأ إنشاء حساب Auth حقيقي:', signUpErr)
          setErr('تعذّر إعداد جلسة آمنة — تأكد أن "Confirm email" مُعطَّل بإعدادات Supabase')
          setLoading(false)
          return
        }
      }

      await proceedToMfa(sessionUser)
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      const detail = e?.message || e?.error_description || e?.hint || JSON.stringify(e)
      const isNetworkError = detail?.toLowerCase().includes('fetch') || detail?.toLowerCase().includes('network')
      setErr(isNetworkError ? '📡 تعذّر الاتصال بالخادم — تحقق من الشبكة' : '❌ ' + detail)
      setLoading(false)
    }
  }

  const onEnrollConfirmed = async (enteredCode) => {
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId, challengeId: challenge.id, code: enteredCode,
      })
      if (verifyErr) return false
      onLogin(pendingUser)
      return true
    } catch (e) {
      console.error('❌ خطأ حفظ التحقق الثنائي:', e)
      return false
    }
  }

  const submitTotp = async () => {
    if (code.trim().length !== 6) { setErr('أدخل الكود المكوّن من 6 أرقام'); return }
    setTotpBusy(true)
    setErr('')
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId, challengeId: challenge.id, code: code.trim(),
      })
      if (verifyErr) {
        setErr('❌ الكود غير صحيح — تأكد من الوقت بهاتفك وحاول مجدداً')
        setTotpBusy(false)
        return
      }
      onLogin(pendingUser)
    } catch (e) {
      console.error('❌ خطأ التحقق الثنائي:', e)
      setErr('خطأ في الاتصال، حاول مجدداً')
      setTotpBusy(false)
    }
  }

  const backToCredentials = () => {
    setStep('credentials'); setErr(''); setCode('')
    setPendingUser(null); setPendingSecret(null); setPendingFactorId(null)
    setPendingRealEmail(null); setPendingPass(null)
  }

  // ── خطوة إعداد أول مرة (QR + كود + تأكيد) ──
  if (step === 'enroll') {
    return (
      <TotpEnrollScreen
        secret={pendingSecret}
        otpauthUrl={getOtpAuthUrl(pendingSecret, pendingUser.name)}
        accountName={pendingUser.name}
        onConfirmed={onEnrollConfirmed}
        onBack={backToCredentials}
      />
    )
  }

  // ── خطوة إدخال كود التحقق الثنائي (لديه إعداد سابق) ──
  if (step === 'totp') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
        <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🔐</div>
            <h1 style={{ fontSize: 17, fontWeight: 900 }}>التحقق الثنائي</h1>
            <p style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>افتح تطبيق المصادقة على هاتفك وأدخل الكود الظاهر حالياً</p>
          </div>

          <input
            autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !totpBusy && submitTotp()}
            inputMode="numeric" maxLength={6}
            style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 900, marginBottom: 14 }}
            placeholder="••••••"
          />

          {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

          <button onClick={submitTotp} disabled={code.length !== 6 || totpBusy}
            style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, marginBottom: 10, background: (code.length !== 6 || totpBusy) ? T.textFaint : T.primaryGradient }}>
            {totpBusy ? '⏳ جارِ التحقق...' : '✅ تأكيد الدخول'}
          </button>
          <button onClick={backToCredentials}
            style={{ background: 'none', border: 'none', color: T.textFaint, fontSize: 12.5, fontWeight: 700, width: '100%', padding: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
            الرجوع لتسجيل الدخول
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
