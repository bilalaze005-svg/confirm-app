import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export default function OrderScreen({ store, employee, onDone, onChangeStore, showToast }) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([]) // [{product_id,name,price,qty}]
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(true)

  const searchProducts = useCallback(async () => {
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

      // ✅ بدون بحث: تُعرض قائمة افتراضية (الأحدث إضافة) بدل شاشة فارغة تنتظر كتابة
      const { data, error } = await q.order(search.trim() ? 'name' : 'created_at', { ascending: !!search.trim() ? true : false }).limit(30)
      if (error) throw error
      setProducts(data || [])
    } catch (e) {
      console.error('❌ خطأ البحث:', e)
    } finally {
      setSearching(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(searchProducts, 350)
    return () => clearTimeout(t)
  }, [searchProducts])

  const addToCart = (p) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === p.id)
      if (existing) return prev.map(c => c.product_id === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product_id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.product_id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }
  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.product_id !== id))

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)

  const submitOrder = async () => {
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return }
    setSaving(true)
    try {
      const items = cart.map(c => ({ product_id: c.product_id, name: c.name, quantity: c.qty, price: c.price, total: c.price * c.qty }))
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
      setCart([]); setPhone(''); setNote('')
      onDone()
    } catch (e) {
      console.error('❌ خطأ إرسال الطلبية:', e)
      showToast('❌ ' + (e.message || 'فشل إرسال الطلبية'), true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16, paddingBottom: cart.length > 0 ? 320 : 20 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>🏬 {store.name}</div>
          {store.address && <div style={{ fontSize: 12, color: '#94a3b8' }}>{store.address}</div>}
        </div>
        <button onClick={onChangeStore} style={{ background: '#F1F5F9', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
          تغيير المحل
        </button>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ابحث عن منتج لإضافته..."
        style={{ width: '100%', padding: 12, borderRadius: 14, border: '1.5px solid #E2E8F0', marginBottom: 12, fontSize: 14, fontFamily: 'inherit' }}
      />

      {searching && products.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>⏳ جارِ التحميل...</div>}

      {!searching && !search.trim() && products.length > 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>📦 أحدث المنتجات (اكتب بالأعلى للبحث في كل الكتالوج)</div>
      )}

      {products.map(p => (
        <button key={p.id} onClick={() => addToCart(p)}
          style={{ width: '100%', background: 'white', borderRadius: 14, padding: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
          {p.image ? (
            <img src={p.image} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#F8FAFC' }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.price} دج {p.carton_price ? `— كرتون ${p.carton_price} دج` : ''}</div>
          </div>
          <span style={{ background: '#EEF4FF', color: '#1565C0', borderRadius: 10, padding: '6px 12px', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>+</span>
        </button>
      ))}

      {!searching && search.trim() && products.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>لا توجد نتائج</div>
      )}

      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,.12)', padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>🧾 طلبية {store.name}</div>
          {cart.map(c => (
            <div key={c.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{c.name}</div>
              <button onClick={() => updateQty(c.product_id, -1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{c.qty}</span>
              <button onClick={() => updateQty(c.product_id, 1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>+</button>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#1565C0', minWidth: 55, textAlign: 'left' }}>{(c.price * c.qty).toFixed(0)} دج</span>
              <button onClick={() => removeFromCart(c.product_id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
            </div>
          ))}

          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="📱 هاتف للتواصل (اختياري)"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #E2E8F0', marginTop: 10, marginBottom: 8, fontSize: 13, fontFamily: 'inherit' }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="📝 ملاحظة للتوصيل (اختياري)"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #E2E8F0', marginBottom: 10, fontSize: 13, fontFamily: 'inherit' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
            <span>الإجمالي:</span>
            <span style={{ color: '#1565C0' }}>{total.toFixed(0)} دج</span>
          </div>

          <button disabled={saving} onClick={submitOrder}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving ? '#94a3b8' : '#059669', color: 'white', fontWeight: 900, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? '⏳ جارِ الإرسال...' : '✅ إرسال الطلبية'}
          </button>
        </div>
      )}
    </div>
  )
}
