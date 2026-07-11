import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import QrScanner from '../components/QrScanner.jsx'

export default function StoreSelectScreen({ onStoreSelected, onNewStore, showToast }) {
  const [showScanner, setShowScanner] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const searchStores = useCallback(async () => {
    if (!search.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id,name,address,qr_token')
        .eq('active', true)
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(15)
      if (error) throw error
      setResults(data || [])
    } catch (e) {
      console.error('❌ خطأ البحث عن المحلات:', e)
    } finally {
      setSearching(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(searchStores, 350)
    return () => clearTimeout(t)
  }, [searchStores])

  const handleScan = async (text) => {
    setShowScanner(false)
    try {
      const { data, error } = await supabase.from('stores').select('id,name,address,qr_token').eq('qr_token', text).eq('active', true).maybeSingle()
      if (error) throw error
      if (!data) { showToast('❌ رمز QR غير معروف أو المحل غير نشط', true); return }
      onStoreSelected(data)
    } catch (e) {
      console.error('❌ خطأ فحص QR:', e)
      showToast('❌ تعذّر التحقق من الرمز', true)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>🏬</div>
        <h2 style={{ fontSize: 17, fontWeight: 900 }}>حدّد المحل لتسجيل طلبيته</h2>
      </div>

      <button onClick={() => setShowScanner(true)}
        style={{ width: '100%', padding: 18, borderRadius: 18, border: 'none', background: 'linear-gradient(135deg,#1565C0,#0D47A1)', color: 'white', fontWeight: 900, fontSize: 16, marginBottom: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        📷 مسح QR المحل
      </button>

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '10px 0' }}>— أو —</div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ابحث عن محل بالاسم..."
        style={{ width: '100%', padding: 13, borderRadius: 14, border: '1.5px solid #E2E8F0', marginBottom: 10, fontSize: 14, fontFamily: 'inherit' }}
      />

      {searching && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 10, fontSize: 13 }}>⏳ جارِ البحث...</div>}

      {results.map(s => (
        <button key={s.id} onClick={() => onStoreSelected(s)}
          style={{ width: '100%', textAlign: 'right', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{s.name}</div>
          {s.address && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.address}</div>}
        </button>
      ))}

      {!searching && search.trim() && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 10, fontSize: 13, marginBottom: 10 }}>لا توجد نتائج مطابقة</div>
      )}

      <button onClick={onNewStore}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: '2px dashed #86EFAC', background: '#F0FDF4', color: '#166534', fontWeight: 800, fontSize: 14, marginTop: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
        🆕 تسجيل محل جديد
      </button>

      {showScanner && <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
