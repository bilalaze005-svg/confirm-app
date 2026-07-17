import { useState, useEffect, useCallback } from 'react'
import { T, cardStyle } from '../lib/theme.js'
import { fetchNotifications, markAsRead, markAllAsRead } from '../lib/notifications.js'

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  return `منذ ${Math.floor(hrs / 24)} يوم`
}

export default function NotificationsScreen({ employee, onClose, showToast, onReadStateChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErrored(false)
    try {
      const data = await fetchNotifications(employee.id)
      setItems(data)
      onReadStateChanged?.(data.filter(n => !n.isRead).length)
    } catch (e) {
      console.error('❌ خطأ جلب الإشعارات:', e)
      setErrored(true)
    } finally {
      setLoading(false)
    }
  }, [employee.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleTap = (n) => {
    if (!n.isRead) {
      markAsRead(employee.id, n.id)
      setItems(prev => {
        const next = prev.map(x => x.id === n.id ? { ...x, isRead: true } : x)
        onReadStateChanged?.(next.filter(x => !x.isRead).length)
        return next
      })
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead(employee.id, items.map(n => n.id))
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    onReadStateChanged?.(0)
    showToast('✅ تم تعليم الكل كمقروء')
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ background: T.primaryGradient, padding: '20px 18px 22px', color: 'white', borderRadius: '0 0 28px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>🔔 الإشعارات</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: T.radiusPill, padding: '8px 16px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          إغلاق
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {items.some(n => !n.isRead) && (
          <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: T.info, fontSize: 12.5, fontWeight: 700, marginBottom: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            ✔️ تعليم الكل كمقروء
          </button>
        )}

        {loading && <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>⏳ جارِ التحميل...</div>}

        {!loading && errored && (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <p style={{ color: T.danger, fontSize: 13, marginBottom: 10 }}>❌ تعذّر تحميل الإشعارات</p>
            <button onClick={load} style={{ background: 'none', border: 'none', color: T.info, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>إعادة المحاولة</button>
          </div>
        )}

        {!loading && !errored && items.length === 0 && (
          <div style={{ textAlign: 'center', color: T.textFaint, padding: 40, fontSize: 13 }}>لا توجد إشعارات حالياً</div>
        )}

        {!loading && items.map(n => (
          <button key={n.id} onClick={() => handleTap(n)}
            style={{ width: '100%', textAlign: 'right', ...cardStyle, padding: 14, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 10, border: n.isRead ? '2px solid transparent' : `2px solid ${T.primary}` }}>
            {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.primary, marginTop: 6, flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: n.isRead ? 700 : 900, fontSize: 13.5 }}>{n.title}</span>
                <span style={{ fontSize: 10.5, color: T.textFaint, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
              </div>
              {n.body && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4, lineHeight: 1.6 }}>{n.body}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
