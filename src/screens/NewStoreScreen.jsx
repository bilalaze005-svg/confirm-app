import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

function genToken() {
  return 'STORE-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()
}

const qrUrl = (token) => `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(token)}`

export default function NewStoreScreen({ onCreated, onCancel, showToast }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState(null) // { lat, lng }
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createdStore, setCreatedStore] = useState(null) // بعد الحفظ، نعرض QR قبل المتابعة

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
        showToast('❌ تعذّر تحديد الموقع — تأكد من تفعيل صلاحية الموقع', true)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const submit = async () => {
    if (!name.trim()) { showToast('⚠️ اسم المحل مطلوب', true); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('stores').insert({
        name: name.trim(),
        address: address.trim() || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        qr_token: genToken(),
        active: true,
      }).select('id,name,address,qr_token').single()
      if (error) throw error
      showToast(`✅ تم تسجيل محل "${data.name}" بنجاح`)
      setCreatedStore(data) // نعرض QR أولاً بدل المتابعة المباشرة
    } catch (e) {
      console.error('❌ خطأ تسجيل المحل:', e)
      showToast('❌ ' + (e.message || 'فشل التسجيل'), true)
    } finally {
      setSaving(false)
    }
  }

  // ── شاشة عرض QR بعد التسجيل مباشرة (لطباعتها ولصقها بالمحل) ──
  if (createdStore) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>تم تسجيل "{createdStore.name}"</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>اطبع رمز QR هذا وألصقه بالمحل — يُستخدم لاحقاً لتحديد المحل بمسحة واحدة</p>

        <div style={{ background: 'white', borderRadius: 20, padding: 20, display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,.08)', marginBottom: 20 }}>
          <img src={qrUrl(createdStore.qr_token)} alt={`QR ${createdStore.name}`} width={220} height={220} style={{ display: 'block' }} />
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{createdStore.name}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={qrUrl(createdStore.qr_token)} download={`QR-${createdStore.name}.png`}
            style={{ display: 'block', padding: 14, borderRadius: 14, background: '#1565C0', color: 'white', fontWeight: 900, fontSize: 14, textDecoration: 'none', fontFamily: 'inherit' }}>
            ⬇️ تحميل صورة QR للطباعة
          </a>
          <button onClick={() => onCreated(createdStore)}
            style={{ padding: 14, borderRadius: 14, border: 'none', background: '#059669', color: 'white', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✅ متابعة لبناء الطلبية
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🆕</div>
        <h2 style={{ fontSize: 17, fontWeight: 900 }}>تسجيل محل جديد</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>سيحصل المحل على رمز QR خاص به تلقائياً</p>
      </div>

      <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>اسم المحل *</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', padding: 13, borderRadius: 12, border: '1.5px solid #E2E8F0', marginTop: 6, marginBottom: 14, fontSize: 14, fontFamily: 'inherit' }}
        placeholder="مثال: محل بلال للتنظيف"
      />

      <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>العنوان (اختياري)</label>
      <input
        value={address} onChange={(e) => setAddress(e.target.value)}
        style={{ width: '100%', padding: 13, borderRadius: 12, border: '1.5px solid #E2E8F0', marginTop: 6, marginBottom: 14, fontSize: 14, fontFamily: 'inherit' }}
        placeholder="الحي / المدينة"
      />

      <button onClick={captureLocation} disabled={locating}
        style={{ width: '100%', padding: 13, borderRadius: 12, border: '1.5px solid #93C5FD', background: location ? '#EFF6FF' : 'white', color: '#1565C0', fontWeight: 800, fontSize: 13, marginBottom: 20, cursor: locating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {locating ? '⏳ جارِ تحديد الموقع...' : location ? '📍 تم تحديد الموقع الحالي ✓ (اضغط لإعادة التحديد)' : '📍 تحديد الموقع الحالي'}
      </button>

      <button disabled={saving} onClick={submit}
        style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: saving ? '#94a3b8' : '#059669', color: 'white', fontWeight: 900, fontSize: 15, marginBottom: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {saving ? '⏳ جارِ التسجيل...' : '✅ تسجيل المحل'}
      </button>
      <button onClick={onCancel} style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        إلغاء
      </button>
    </div>
  )
}

