import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

function genToken() {
  return 'STORE-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()
}

export default function NewStoreScreen({ onCreated, onCancel, showToast }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { showToast('⚠️ اسم المحل مطلوب', true); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('stores').insert({
        name: name.trim(),
        address: address.trim() || null,
        qr_token: genToken(),
        active: true,
      }).select('id,name,address,qr_token').single()
      if (error) throw error
      showToast(`✅ تم تسجيل محل "${data.name}" بنجاح`)
      onCreated(data)
    } catch (e) {
      console.error('❌ خطأ تسجيل المحل:', e)
      showToast('❌ ' + (e.message || 'فشل التسجيل'), true)
    } finally {
      setSaving(false)
    }
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
        style={{ width: '100%', padding: 13, borderRadius: 12, border: '1.5px solid #E2E8F0', marginTop: 6, marginBottom: 20, fontSize: 14, fontFamily: 'inherit' }}
        placeholder="الحي / المدينة"
      />

      <button disabled={saving} onClick={submit}
        style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: saving ? '#94a3b8' : '#059669', color: 'white', fontWeight: 900, fontSize: 15, marginBottom: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {saving ? '⏳ جارِ التسجيل...' : '✅ تسجيل المحل ومتابعة الطلبية'}
      </button>
      <button onClick={onCancel} style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        إلغاء
      </button>
    </div>
  )
}
