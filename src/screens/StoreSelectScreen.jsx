import { useState } from 'react'
import QrScanner from '../components/QrScanner.jsx'
import { T, cardStyle, buttonPrimary, inputStyle } from '../lib/theme.js'
import { distanceKm, formatDistance, geoErrorMessage } from '../lib/geo.js'
import useStoreSearch from '../hooks/useStoreSearch.js'

export default function StoreSelectScreen({ onStoreSelected, onNewStore, showToast, isOnline }) {
  const [showScanner, setShowScanner] = useState(false)
  const [search, setSearch] = useState('')
  const [myLocation, setMyLocation] = useState(null)
  const [locating, setLocating] = useState(false)

  const { results, searching, recent, handleSelect, handleScan } =
    useStoreSearch({ search, showToast, isOnline, onStoreSelected })

  const handleScanAndClose = async (text) => {
    setShowScanner(false)
    await handleScan(text)
  }

  const locateMe = () => {
    if (!navigator.geolocation) { showToast('⚠️ الجهاز لا يدعم تحديد الموقع', true); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      (err) => { console.error('❌ خطأ تحديد الموقع:', err); showToast(geoErrorMessage(err), true); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ترتيب نتائج البحث حسب الأقرب لو حدّدنا موقع الموظف الحالي
  const sortedResults = myLocation
    ? [...results].sort((a, b) => {
        const dA = distanceKm(myLocation.lat, myLocation.lng, a.lat, a.lng)
        const dB = distanceKm(myLocation.lat, myLocation.lng, b.lat, b.lng)
        if (dA === null) return 1
        if (dB === null) return -1
        return dA - dB
      })
    : results

  return (
    <div style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 12px' }}>🏬</div>
        <h2 style={{ fontSize: 16.5, fontWeight: 900, color: T.text }}>حدّد المحل لتسجيل طلبيته</h2>
      </div>

      <button onClick={() => setShowScanner(true)}
        style={{ ...buttonPrimary, width: '100%', padding: 20, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        📷 مسح QR المحل
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ color: T.textFaint, fontSize: 11.5, fontWeight: 700 }}>أو</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.textFaint }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن محل بالاسم..."
          style={{ ...inputStyle, paddingRight: 40 }} />
      </div>

      {search.trim() !== '' && (
        <button onClick={locateMe} disabled={locating}
          style={{ background: 'none', border: 'none', color: myLocation ? T.success : T.info, fontSize: 12, fontWeight: 700, padding: '4px 2px', marginBottom: 8, cursor: locating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {locating ? '⏳ جارِ تحديد موقعك...' : myLocation ? '📍 مرتّب حسب الأقرب لموقعك ✓' : '📍 ترتيب حسب الأقرب لي'}
        </button>
      )}

      {searching && <div style={{ textAlign: 'center', color: T.textFaint, padding: 10, fontSize: 13 }}>⏳ جارِ البحث...</div>}

      {sortedResults.map(s => {
        const km = myLocation ? distanceKm(myLocation.lat, myLocation.lng, s.lat, s.lng) : null
        return (
          <button key={s.id} onClick={() => handleSelect(s)}
            style={{ width: '100%', textAlign: 'right', ...cardStyle, padding: 14, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{s.name}</div>
              {s.address && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>{s.address}</div>}
            </div>
            {km !== null && <div style={{ fontSize: 11, color: T.info, fontWeight: 700, flexShrink: 0 }}>{formatDistance(km)}</div>}
          </button>
        )
      })}

      {!searching && search.trim() && results.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: 10, fontSize: 13, marginBottom: 10 }}>لا توجد نتائج مطابقة</div>
      )}

      {!search.trim() && recent.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: T.textFaint, fontWeight: 700, marginBottom: 10 }}>🕘 محلات استخدمتها مؤخراً</div>
          {recent.map(s => (
            <button key={s.id} onClick={() => handleSelect(s)}
              style={{ width: '100%', textAlign: 'right', ...cardStyle, padding: 14, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏬</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{s.name}</div>
                {s.address && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>{s.address}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      <button onClick={onNewStore}
        style={{ width: '100%', padding: 15, borderRadius: T.radiusMd, border: `2px dashed #C4B5FD`, background: T.primaryLight, color: T.primaryDark, fontWeight: 800, fontSize: 13.5, marginTop: 18, cursor: 'pointer', fontFamily: 'inherit' }}>
        🆕 تسجيل محل جديد
      </button>

      {showScanner && <QrScanner onScan={handleScanAndClose} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
