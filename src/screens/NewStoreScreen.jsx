import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { geoErrorMessage } from '../lib/geo.js'

function genToken() {
  return 'STORE-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()
}

const qrUrl = (token) => `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(token)}`

export default function NewStoreScreen({ onCreated, onCancel, showToast, isOnline }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState(null) // { lat, lng }
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createdStore, setCreatedStore] = useState(null) // بعد الحفظ، نعرض QR قبل المتابعة
  const [similarStores, setSimilarStores] = useState([]) // محلات بأسماء مشابهة — لتفادي التكرار
  const [confirmDespiteSimilar, setConfirmDespiteSimilar] = useState(false)

  const captureLocation = () => {
    if (!navigator.geolocation) { showToast('⚠️ الجهاز لا يدعم تحديد الموقع', true); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        showToast('📍 تم تحديد الموقع الحالي')
      },
      (err) => {
        console.error('❌ خطأ تحديد الموقع:', err)
        showToast(geoErrorMessage(err), true)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const checkSimilarStores = async (trimmedName) => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id,name,address')
        .eq('active', true)
        .ilike('name', `%${trimmedName}%`)
        .limit(3)
      if (error) throw error
      return data || []
    } catch (e) {
      console.error('❌ خطأ فحص التكرار:', e)
      return [] // فحص التكرار ثانوي — ما نمنع التسجيل لو فشل هذا الفحص
    }
  }

  const doInsert = async (trimmedName) => {
    setSaving(true)
    try {
      const { data, error } = await supabase.from('stores').insert({
        name: trimmedName,
        address: address.trim() || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        qr_token: genToken(),
        active: true,
      }).select('id,name,address,qr_token').single()
      if (error) throw error
      showToast(`✅ تم تسجيل محل "${data.name}" بنجاح`)
      setCreatedStore(data)
    } catch (e) {
      console.error('❌ خطأ تسجيل المحل:', e)
      showToast('❌ ' + (e.message || 'فشل التسجيل'), true)
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { showToast('⚠️ اسم المحل مطلوب', true); return }
    if (trimmedName.length < 2) { showToast('⚠️ اسم المحل قصير جداً', true); return }
    if (!isOnline) { showToast('📡 لا يوجد اتصال بالإنترنت', true); return }

    // تنبيه بسيط لو فيه محل بنفس الاسم تقريباً، لتفادي التسجيل المكرر بالخطأ
    if (!confirmDespiteSimilar) {
      const similar = await checkSimilarStores(trimmedName)
      if (similar.length > 0) {
        setSimilarStores(similar)
        setConfirmDespiteSimilar(true)
        return
      }
    }

    await doInsert(trimmedName)
    setConfirmDespiteSimilar(false)
    setSimilarStores([])
  }

  // ── شاشة عرض QR بعد التسجيل مباشرة (لطباعتها ولصقها بالمحل) ──
  if (createdStore) {
    const copyToken = async () => {
      try {
        await navigator.clipboard.writeText(createdStore.qr_token)
        showToast('📋 تم نسخ رمز المحل')
      } catch {
        showToast('⚠️ تعذّر النسخ — انسخه يدوياً', true)
      }
    }

    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>✅</div>
        <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>تم تسجيل "{createdStore.name}"</h2>
        <p style={{ fontSize: 12, color: T.textFaint, marginBottom: 20 }}>اطبع رمز QR هذا وألصقه بالمحل — يُستخدم لاحقاً لتحديد المحل بمسحة واحدة</p>

        <div style={{ ...cardStyle, display: 'inline-block', marginBottom: 16 }}>
          <img src={qrUrl(createdStore.qr_token)} alt={`QR ${createdStore.name}`} width={220} height={220} style={{ display: 'block', borderRadius: 12 }} />
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{createdStore.name}</div>
        </div>

        {/* على iOS Safari سمة download تُتجاهل غالباً، فنوفر بديل فتح الصورة بتبويب جديد للحفظ يدوياً */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
          <a href={qrUrl(createdStore.qr_token)} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11.5, color: T.info, fontWeight: 700, textDecoration: 'none' }}>
            🖼️ فتح الصورة (لأجهزة آيفون)
          </a>
          <span style={{ color: T.border }}>|</span>
          <button onClick={copyToken} style={{ background: 'none', border: 'none', color: T.info, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            📋 نسخ رمز المحل
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={qrUrl(createdStore.qr_token)} download={`QR-${createdStore.name}.png`}
            style={{ display: 'block', padding: 15, borderRadius: T.radiusMd, background: T.primaryGradient, color: 'white', fontWeight: 900, fontSize: 14, textDecoration: 'none', fontFamily: 'inherit', boxShadow: buttonPrimary.boxShadow }}>
            ⬇️ تحميل صورة QR للطباعة
          </a>
          <button onClick={() => onCreated(createdStore)}
            style={{ padding: 15, borderRadius: T.radiusMd, border: 'none', background: T.success, color: 'white', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✅ متابعة لبناء الطلبية
          </button>
        </div>
      </div>
    )
  }

  // ── تنبيه وجود محلات بأسماء مشابهة قبل تأكيد التسجيل ──
  if (confirmDespiteSimilar) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: T.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>⚠️</div>
          <h2 style={{ fontSize: 16, fontWeight: 900 }}>فيه محلات بأسماء مشابهة</h2>
          <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 4 }}>تأكد إذا المحل هذا مسجّل مسبقاً قبل ما تسجّله مرّة ثانية</p>
        </div>

        {similarStores.map(s => (
          <div key={s.id} style={{ ...cardStyle, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏬</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{s.name}</div>
              {s.address && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>{s.address}</div>}
            </div>
          </div>
        ))}

        <button disabled={saving} onClick={() => doInsert(name.trim())}
          style={{ ...buttonPrimary, width: '100%', padding: 15, fontSize: 14, marginTop: 14, marginBottom: 10, background: saving ? T.textFaint : T.warning }}>
          {saving ? '⏳ جارِ التسجيل...' : '✅ متأكد، سجّل المحل كمحل جديد'}
        </button>
        <button onClick={() => { setConfirmDespiteSimilar(false); setSimilarStores([]) }} style={{ ...buttonGhost, width: '100%', padding: 13, fontSize: 13 }}>
          الرجوع وتعديل الاسم
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>🆕</div>
        <h2 style={{ fontSize: 17, fontWeight: 900 }}>تسجيل محل جديد</h2>
        <p style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>سيحصل المحل على رمز QR خاص به تلقائياً</p>
      </div>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>اسم المحل *</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)}
        maxLength={100}
        style={{ ...inputStyle, marginTop: 6, marginBottom: 14 }}
        placeholder="مثال: محل بلال للتنظيف"
      />

      <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>العنوان (اختياري)</label>
      <input
        value={address} onChange={(e) => setAddress(e.target.value)}
        maxLength={200}
        style={{ ...inputStyle, marginTop: 6, marginBottom: 14 }}
        placeholder="الحي / المدينة"
      />

      <button onClick={captureLocation} disabled={locating}
        style={{ width: '100%', padding: 13, borderRadius: T.radiusMd, border: `1.5px solid ${location ? T.info : '#BFDBFE'}`, background: location ? '#EFF6FF' : 'white', color: T.info, fontWeight: 800, fontSize: 13, marginBottom: location ? 6 : 22, cursor: locating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {locating ? '⏳ جارِ تحديد الموقع...' : location ? '📍 تم تحديد الموقع الحالي ✓ (اضغط لإعادة التحديد)' : '📍 تحديد الموقع الحالي'}
      </button>
      {location && (
        <a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', fontSize: 11.5, color: T.textFaint, marginBottom: 22, textDecoration: 'underline' }}>
          تحقق من الموقع على الخريطة
        </a>
      )}

      <button disabled={saving} onClick={submit}
        style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15, marginBottom: 10, background: saving ? T.textFaint : T.success, boxShadow: saving ? 'none' : '0 4px 14px rgba(5,150,105,.28)' }}>
        {saving ? '⏳ جارِ التسجيل...' : '✅ تسجيل المحل'}
      </button>
      <button onClick={onCancel} style={{ ...buttonGhost, width: '100%', padding: 13, fontSize: 13 }}>
        إلغاء
      </button>
    </div>
  )
}
