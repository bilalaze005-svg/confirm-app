import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import PrintButton from '../components/PrintButton.jsx'

const LOW_STOCK_THRESHOLD = 5

export default function OrderScreen({ store, employee, onDone, onChangeStore, showToast, isOnline }) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([]) // [{product_id,name,price,qty,image,unitMode,stock}]
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(true)
  const [completedOrder, setCompletedOrder] = useState(null) // بعد الإرسال بنجاح، نعرض شاشة تأكيد فيها زر طباعة
  const [cartExpanded, setCartExpanded] = useState(false) // السلة تبدأ مطوية كشريط صغير، وتتوسّع فقط عند الضغط عليها
  const requestIdRef = useRef(0)

  const searchProducts = useCallback(async () => {
    const myRequestId = ++requestIdRef.current
    setSearching(true)
    try {
      let q = supabase
        .from('products')
        .select('id,name,price,stock,sku,carton_price,units,image')
        .eq('disabled', false)

      if (search.trim()) {
        const like = `%${search.trim()}%`
        q = q.or(`name.ilike.${like},sku.ilike.${like}`)
      }

      const { data, error } = await q.order(search.trim() ? 'name' : 'created_at', { ascending: !!search.trim() }).limit(30)
      if (error) throw error
      if (myRequestId !== requestIdRef.current) return // نتيجة بحث قديمة وصلت متأخرة — نتجاهلها
      setProducts(data || [])
    } catch (e) {
      console.error('❌ خطأ البحث:', e)
      if (myRequestId === requestIdRef.current) showToast('❌ تعذّر تحميل المنتجات', true)
    } finally {
      if (myRequestId === requestIdRef.current) setSearching(false)
    }
  }, [search, showToast])

  useEffect(() => {
    const t = setTimeout(searchProducts, 350)
    return () => clearTimeout(t)
  }, [searchProducts])

  // تحذير قبل مغادرة الصفحة (تحديث/إغلاق) لو فيه عناصر بالسلة لم تُرسل بعد
  useEffect(() => {
    const handler = (e) => {
      if (cart.length > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [cart.length])

  // الوحدة الفعلية للسعر: بالكرتون لو المنتج يدعم ذلك ووُضعت في السلة كذلك
  const unitPrice = (item) => (item.unitMode === 'carton' && item.cartonPrice ? item.cartonPrice : item.price)

  const addToCart = (p) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === p.id)
      if (existing) {
        if (typeof p.stock === 'number' && existing.qty >= p.stock) {
          showToast(`⚠️ الكمية المتوفرة من "${p.name}" محدودة بـ ${p.stock}`, true)
          return prev
        }
        return prev.map(c => c.product_id === p.id ? { ...c, qty: c.qty + 1 } : c)
      }
      if (typeof p.stock === 'number' && p.stock <= 0) {
        showToast(`⚠️ "${p.name}" غير متوفر بالمخزون حالياً`, true)
        return prev
      }
      return [...prev, {
        product_id: p.id, name: p.name, price: p.price, image: p.image, qty: 1,
        stock: p.stock, cartonPrice: p.carton_price, units: p.units, unitMode: 'unit',
      }]
    })
  }

  const cartQtyFor = (id) => cart.find(c => c.product_id === id)?.qty || 0

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== id) return c
      const next = c.qty + delta
      if (delta > 0 && typeof c.stock === 'number' && c.unitMode === 'unit' && next > c.stock) {
        showToast(`⚠️ الحد الأقصى المتوفر ${c.stock}`, true)
        return c
      }
      return { ...c, qty: Math.max(1, next) }
    }))
  }

  const toggleUnitMode = (id) => {
    setCart(prev => prev.map(c => c.product_id === id ? { ...c, unitMode: c.unitMode === 'carton' ? 'unit' : 'carton', qty: 1 } : c))
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.product_id !== id))

  const total = cart.reduce((s, c) => s + unitPrice(c) * c.qty, 0)
  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  const submitOrder = async () => {
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return }
    if (!isOnline) { showToast('📡 لا يوجد اتصال بالإنترنت — لا يمكن إرسال الطلبية الآن', true); return }
    setSaving(true)
    try {
      const items = cart.map(c => ({
        product_id: c.product_id,
        name: c.name,
        quantity: c.qty,
        unit: c.unitMode === 'carton' ? 'carton' : 'unit',
        price: unitPrice(c),
        total: unitPrice(c) * c.qty,
      }))
      const { error } = await supabase.from('orders').insert({
        customer_name: store.name,
        customer_phone: phone.trim() || null,
        customer_address: store.address || null,
        store_id: store.id,
        items: JSON.stringify(items),
        total,
        status: 'processing',
        notes: note.trim() || null,
        employee_id: employee.id,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      showToast(`✅ تم تسجيل طلبية "${store.name}" بقيمة ${total.toFixed(0)} دج`)
      setCompletedOrder({
        storeName: store.name,
        address: store.address,
        items,
        total,
        employeeName: employee.name,
        dateStr: new Date().toLocaleString('ar'),
      })
      setCart([]); setPhone(''); setNote('')
    } catch (e) {
      console.error('❌ خطأ إرسال الطلبية:', e)
      showToast('❌ ' + (e.message || 'فشل إرسال الطلبية'), true)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeStore = () => {
    if (cart.length > 0 && !window.confirm('السلة فيها منتجات لم تُرسل — تأكيد تغيير المحل سيفقدها. متابعة؟')) return
    onChangeStore()
  }

  if (completedOrder) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>✅</div>
        <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>تم تسجيل طلبية {completedOrder.storeName}</h2>
        <p style={{ fontSize: 13, color: T.textFaint, marginBottom: 20 }}>الإجمالي: {completedOrder.total.toFixed(0)} دج</p>

        <div style={{ marginBottom: 14 }}>
          <PrintButton order={completedOrder} showToast={showToast} />
        </div>

        <button onClick={() => { setCompletedOrder(null); onDone() }}
          style={{ ...buttonPrimary, width: '100%', padding: 15, fontSize: 14 }}>
          متابعة لطلبية جديدة
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, paddingBottom: cart.length > 0 ? (cartExpanded ? 320 : 90) : 20 }}>
      <div style={{ ...cardStyle, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏬</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{store.name}</div>
            {store.address && <div style={{ fontSize: 11.5, color: T.textFaint }}>{store.address}</div>}
          </div>
        </div>
        <button onClick={handleChangeStore} style={{ ...buttonGhost, padding: '7px 12px', fontSize: 11 }}>
          تغيير
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.textFaint }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن منتج لإضافته..."
          style={{ ...inputStyle, paddingRight: 40 }} />
      </div>

      {searching && products.length === 0 && <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>⏳ جارِ التحميل...</div>}

      {!searching && !search.trim() && products.length > 0 && (
        <div style={{ fontSize: 12, color: T.textFaint, fontWeight: 700, marginBottom: 10 }}>📦 أحدث المنتجات (اكتب بالأعلى للبحث في كل الكتالوج)</div>
      )}

      {!searching && !search.trim() && products.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: 30, fontSize: 13 }}>لا توجد منتجات متاحة حالياً</div>
      )}

      {/* شبكة المنتجات — تجربة شبيهة بمتجر نقاء */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {products.map(p => {
          const inCart = cartQtyFor(p.id)
          const outOfStock = typeof p.stock === 'number' && p.stock <= 0
          const lowStock = typeof p.stock === 'number' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
          return (
            <button key={p.id} onClick={() => addToCart(p)} disabled={outOfStock}
              style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: inCart ? `2px solid ${T.primary}` : '2px solid transparent', textAlign: 'right', cursor: outOfStock ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', opacity: outOfStock ? 0.55 : 1 }}>
              <div style={{ position: 'relative', aspectRatio: '1', background: T.bg }}>
                {p.image ? (
                  <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>📦</div>
                )}
                {inCart > 0 && (
                  <span style={{ position: 'absolute', top: 8, right: 8, background: T.primary, color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, boxShadow: '0 2px 6px rgba(124,58,237,.4)' }}>
                    {inCart}
                  </span>
                )}
                {outOfStock && (
                  <span style={{ position: 'absolute', bottom: 8, right: 8, left: 8, background: 'rgba(220,38,38,.9)', color: 'white', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontWeight: 800, textAlign: 'center' }}>
                    غير متوفر
                  </span>
                )}
                {!outOfStock && lowStock && (
                  <span style={{ position: 'absolute', bottom: 8, right: 8, left: 8, background: T.warning, color: 'white', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontWeight: 800, textAlign: 'center' }}>
                    باقي {p.stock} فقط
                  </span>
                )}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.text }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: T.primary }}>{p.price} <span style={{ fontSize: 10, fontWeight: 700 }}>دج</span></span>
                  {!outOfStock && <span style={{ background: T.primaryLight, color: T.primary, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>+</span>}
                </div>
                {p.carton_price ? (
                  <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>🧃 الكرتون: {p.carton_price} دج{p.units ? ` (${p.units} وحدة)` : ''}</div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {!searching && search.trim() && products.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>لا توجد نتائج</div>
      )}

      {cart.length > 0 && !cartExpanded && (
        <button onClick={() => setCartExpanded(true)}
          style={{ position: 'fixed', bottom: 16, right: 16, left: 16, maxWidth: 468, margin: '0 auto', background: T.primaryGradient, color: 'white', border: 'none', borderRadius: T.radiusPill, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(124,58,237,.35)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5 }}>
            <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{totalItems}</span>
            🧾 عرض السلة
          </span>
          <span style={{ fontWeight: 900, fontSize: 15 }}>{total.toFixed(0)} دج</span>
        </button>
      )}

      {cart.length > 0 && cartExpanded && (
        <>
          {/* خلفية شفافة: الضغط خارج اللوحة يطويها بدل حذف أي بيانات */}
          <div onClick={() => setCartExpanded(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 40 }} />

          <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 30px rgba(15,23,42,.12)', padding: 18, maxHeight: '75vh', overflowY: 'auto', zIndex: 41 }}>
            <button onClick={() => setCartExpanded(false)} aria-label="طي السلة"
              style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: '0 auto 14px', display: 'block', border: 'none', padding: 12, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>🧾 طلبية {store.name} ({totalItems} قطعة)</div>
              <button onClick={() => setCartExpanded(false)} style={{ background: T.bg, border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 13, color: T.textFaint }}>✕</button>
            </div>
            {cart.map(c => (
            <div key={c.product_id} style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.image ? (
                  <img src={c.image} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: T.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
                )}
                <div style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <button onClick={() => updateQty(c.product_id, -1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{c.qty}</span>
                <button onClick={() => updateQty(c.product_id, 1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
                <span style={{ fontSize: 12, fontWeight: 800, color: T.primary, minWidth: 55, textAlign: 'left' }}>{(unitPrice(c) * c.qty).toFixed(0)} دج</span>
                <button onClick={() => removeFromCart(c.product_id)} style={{ background: '#FEE2E2', color: T.danger, border: 'none', borderRadius: T.radiusSm, width: 26, height: 26, cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
              {c.cartonPrice ? (
                <button onClick={() => toggleUnitMode(c.product_id)} style={{ background: 'none', border: 'none', color: T.info, fontSize: 10.5, fontWeight: 700, padding: '4px 42px 0 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c.unitMode === 'carton' ? '🧃 بالكرتون — اضغط للتحويل للوحدة' : '🔄 حوّل إلى بيع بالكرتون'}
                </button>
              ) : null}
            </div>
            ))}

            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="📱 هاتف للتواصل (اختياري)"
              style={{ ...inputStyle, padding: 11, marginTop: 12, marginBottom: 8, fontSize: 13 }} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="📝 ملاحظة للتوصيل (اختياري)"
              style={{ ...inputStyle, padding: 11, marginBottom: 10, fontSize: 13 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 17, marginBottom: 12 }}>
              <span style={{ color: T.textSoft, fontSize: 13, alignSelf: 'center' }}>الإجمالي</span>
              <span style={{ color: T.primary }}>{total.toFixed(0)} دج</span>
            </div>

            <button disabled={saving} onClick={submitOrder}
              style={{ ...buttonPrimary, width: '100%', padding: 15, fontSize: 15, background: saving ? T.textFaint : T.primaryGradient }}>
              {saving ? '⏳ جارِ الإرسال...' : '✅ إرسال الطلبية'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
