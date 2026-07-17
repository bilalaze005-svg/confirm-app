import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, cardStyle } from '../lib/theme.js'

const PERIODS = {
  day:   { label: 'اليوم',        getStart: () => { const d = new Date(); d.setHours(0,0,0,0); return d } },
  week:  { label: 'هذا الأسبوع',  getStart: () => { const d = new Date(); d.setDate(d.getDate() - 7); return d } },
  month: { label: 'هذا الشهر',    getStart: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d } },
}

export default function AccountingScreen({ employee, onClose }) {
  const [period, setPeriod] = useState('day')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const start = PERIODS[period].getStart()
      const { data, error } = await supabase
        .from('orders')
        .select('id,total,pay_mode,items,created_at')
        .eq('employee_id', employee.id)
        .gte('created_at', start.toISOString())
      if (error) throw error
      setOrders(data || [])
    } catch (e) {
      console.error('❌ خطأ جلب المحاسبة:', e)
    } finally {
      setLoading(false)
    }
  }, [employee.id, period])

  useEffect(() => { load() }, [load])

  const modeLabel = { cash: '💵 نقداً', credit: '📝 آجل', cheque: '🧾 شيك', transfer: '🏦 تحويل' }
  const totalMoney = orders.reduce((s, o) => s + Number(o.total || 0), 0)
  const byMode = orders.reduce((acc, o) => {
    const m = o.pay_mode || 'cash'
    acc[m] = (acc[m] || 0) + Number(o.total || 0)
    return acc
  }, {})

  // تجميع المنتجات المباعة من كل الطلبيات (items مخزَّنة كنص JSON بكل طلبية)
  const productTotals = {}
  for (const o of orders) {
    let items = []
    try { items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []) } catch { /* تجاهل */ }
    for (const it of items) {
      const name = it.name || it.product_name || 'منتج'
      const qty = Number(it.quantity || it.qty || 1)
      const lineTotal = Number(it.total ?? (Number(it.price || 0) * qty))
      if (!productTotals[name]) productTotals[name] = { qty: 0, total: 0 }
      productTotals[name].qty += qty
      productTotals[name].total += lineTotal
    }
  }
  const productList = Object.entries(productTotals).sort((a, b) => b[1].total - a[1].total)

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ background: 'white', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.text }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>📊 محاسبة</div>
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
            <div style={{ background: 'linear-gradient(135deg,#10B981,#047857)', borderRadius: T.radiusLg, padding: 22, color: 'white', marginBottom: 18, textAlign: 'center', boxShadow: '0 8px 24px rgba(5,150,105,.28)' }}>
              <div style={{ fontSize: 12.5, opacity: .9, fontWeight: 600 }}>💰 إجمالي مبيعات {PERIODS[period].label}</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{totalMoney.toFixed(0)} <span style={{ fontSize: 16 }}>دج</span></div>
              <div style={{ fontSize: 12, opacity: .9, marginTop: 4 }}>{orders.length} عملية بيع</div>
            </div>

            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>تفصيل حسب طريقة الدفع</div>
              {Object.keys(byMode).length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>لا توجد مبيعات بهذه الفترة</div>}
              {Object.entries(byMode).map(([mode, val]) => (
                <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                  <span>{modeLabel[mode] || mode}</span>
                  <span style={{ fontWeight: 800 }}>{val.toFixed(0)} دج</span>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>المنتجات المباعة ({productList.length})</div>
            {productList.length === 0 && (
              <div style={{ textAlign: 'center', color: T.textFaint, padding: '20px 0', fontSize: 13 }}>لا توجد مبيعات بهذه الفترة</div>
            )}
            {productList.map(([name, d]) => (
              <div key={name} style={{ ...cardStyle, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
                  <div style={{ fontSize: 11, color: T.textFaint }}>الكمية المباعة: {d.qty}</div>
                </div>
                <div style={{ fontWeight: 800, color: T.success }}>{d.total.toFixed(0)} دج</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
