import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, cardStyle, buttonGhost } from '../lib/theme.js'

const PERIODS = {
  day:   { label: 'اليوم',        getStart: () => { const d = new Date(); d.setHours(0,0,0,0); return d } },
  week:  { label: 'هذا الأسبوع',  getStart: () => { const d = new Date(); d.setDate(d.getDate() - 7); return d } },
  month: { label: 'هذا الشهر',    getStart: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d } },
}

export default function OrdersHistoryScreen({ employee, onClose }) {
  const [period, setPeriod] = useState('day')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const start = PERIODS[period].getStart()
      const { data, error } = await supabase
        .from('orders')
        .select('id,customer_name,customer_address,total,pay_mode,items,created_at')
        .eq('employee_id', employee.id)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (e) {
      console.error('❌ خطأ جلب الطلبيات:', e)
    } finally {
      setLoading(false)
    }
  }, [employee.id, period])

  useEffect(() => { load() }, [load])

  const modeLabel = { cash: '💵 نقداً', credit: '📝 آجل', cheque: '🧾 شيك', transfer: '🏦 تحويل' }
  const totalAll = orders.reduce((s, o) => s + Number(o.total || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ background: 'white', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.text }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>📦 طلبياتي</div>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {Object.entries(PERIODS).map(([key, p]) => (
            <button key={key} onClick={() => setPeriod(key)}
              style={{ flex: 1, padding: 10, borderRadius: T.radiusSm, border: 'none', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                background: period === key ? T.primary : 'white', color: period === key ? 'white' : T.textSoft,
                boxShadow: period === key ? '0 4px 12px rgba(124,58,237,.25)' : '0 1px 3px rgba(0,0,0,.06)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 50, color: T.textFaint }}>⏳ جارِ التحميل...</div>
        ) : (
          <>
            <div style={{ background: T.primaryGradient, borderRadius: T.radiusLg, padding: 20, color: 'white', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, opacity: .9, fontWeight: 600 }}>عدد الطلبيات — {PERIODS[period].label}</div>
              <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>{orders.length}</div>
              <div style={{ fontSize: 12, opacity: .9, marginTop: 4 }}>بقيمة إجمالية {totalAll.toFixed(0)} دج</div>
            </div>

            {orders.length === 0 && (
              <div style={{ textAlign: 'center', color: T.textFaint, padding: '30px 0', fontSize: 13 }}>
                لا توجد طلبيات خلال هذه الفترة
              </div>
            )}

            {orders.map(o => (
              <div key={o.id} style={{ ...cardStyle, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{o.customer_name}</span>
                  <span style={{ fontWeight: 800, color: T.success }}>{Number(o.total).toFixed(0)} دج</span>
                </div>
                <div style={{ fontSize: 11, color: T.textFaint }}>
                  {new Date(o.created_at).toLocaleDateString('ar-DZ')} —{' '}
                  {new Date(o.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                  {' — '}{modeLabel[o.pay_mode] || o.pay_mode}
                </div>
                {o.customer_address && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>📍 {o.customer_address}</div>}
              </div>
            ))}

            <button onClick={load} style={{ ...buttonGhost, width: '100%', padding: 13, fontSize: 13, marginTop: 8 }}>
              🔄 تحديث
            </button>
          </>
        )}
      </div>
    </div>
  )
}
