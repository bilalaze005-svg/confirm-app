// ============================================================
// src/hooks/useStoreOrder.js
// منطق شاشة تسجيل طلبية لمحل: بحث المنتجات، العروض النشطة،
// إدارة السلة، وإرسال الطلبية (insert في orders).
// ============================================================
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { getAutoPrint, isConnected, reconnectSavedPrinter, printReceipt } from '../lib/print.js'
import { applyPromotions } from '../lib/promotions.js'

/**
 * @typedef {Object} StoreCartItem
 * @property {string} product_id
 * @property {string} name
 * @property {number} price
 * @property {string=} image
 * @property {number} qty
 * @property {number} stock
 * @property {number=} cartonPrice
 * @property {'unit'|'carton'} unitMode
 * @property {number|null} brand_id
 */

async function fetchProducts(search) {
  let q = supabase
    .from('products')
    .select('id,name,price,stock,sku,carton_price,units,image,brand_id')
    .eq('disabled', false)
    .gt('stock', 0)
  if (search.trim()) {
    const like = `%${search.trim()}%`
    q = q.or(`name.ilike.${like},sku.ilike.${like}`)
  }
  const { data, error } = await q.order(search.trim() ? 'name' : 'created_at', { ascending: !!search.trim() }).limit(30)
  if (error) throw error
  return data || []
}

async function fetchActivePromotions() {
  const { data, error } = await supabase.from('promotions').select('*').eq('active', true)
  if (error) throw error
  return data || []
}

export default function useStoreOrder({ store, employee, showToast, isOnline, search }) {
  const [cart, setCart] = useState([])
  const [saving, setSaving] = useState(false)
  const [completedOrder, setCompletedOrder] = useState(null)

  // ✅ نفس مهلة الـ350ms الأصلية قبل البحث — نحتفظ بها هنا صراحة لأن queryKey
  // في React Query يُطلق طلباً فورياً عند تغيّره، وبدون هذا التأخير سيصير
  // طلب شبكة مع كل ضغطة حرف بدل طلب واحد بعد توقّف الكتابة
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const productsQuery = useQuery({
    queryKey: ['products-search', debouncedSearch.trim()],
    queryFn: () => fetchProducts(debouncedSearch),
    placeholderData: (prev) => prev, // يبقي آخر نتائج ظاهرة أثناء جلب نتائج البحث الجديد (لا وميض فارغ)
  })
  const promosQuery = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: fetchActivePromotions,
    staleTime: 5 * 60_000,
  })

  const products = productsQuery.data || []
  const searching = productsQuery.isLoading
  const promos = promosQuery.data || []

  // الوحدة الفعلية للسعر: بالكرتون لو المنتج يدعم ذلك ووُضعت في السلة كذلك
  const unitPrice = (item) => (item.unitMode === 'carton' && item.cartonPrice ? item.cartonPrice : item.price)

  const maxQtyFor = (item) => {
    if (item.unitMode === 'carton' && item.units) return Math.floor((item.stock ?? Infinity) / item.units) || 0
    return item.stock
  }

  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === p.id)
      if (existing) {
        const max = maxQtyFor(existing)
        if (typeof max === 'number' && existing.qty >= max) {
          showToast(existing.unitMode === 'carton'
            ? `⚠️ أقصى كمية متوفرة من "${p.name}" هي ${max} كرتون`
            : `⚠️ الكمية المتوفرة من "${p.name}" محدودة بـ ${p.stock}`, true)
          return prev
        }
        return prev.map((c) => c.product_id === p.id ? { ...c, qty: c.qty + 1 } : c)
      }
      if (typeof p.stock === 'number' && p.stock <= 0) {
        showToast(`⚠️ "${p.name}" غير متوفر بالمخزون حالياً`, true)
        return prev
      }
      return [...prev, {
        product_id: p.id, name: p.name, price: p.price, image: p.image, qty: 1,
        // ✅ بيع بالكرتون فقط: أي منتج له سعر كرتون يُضاف مباشرة بوضع الكرتون،
        // وما عنده سعر كرتون (استثناء) يبقى بالقطعة لأنه لا يوجد خيار آخر
        stock: p.stock, cartonPrice: p.carton_price, units: p.units,
        unitMode: p.carton_price ? 'carton' : 'unit', brand_id: p.brand_id,
      }]
    })
  }

  const cartQtyFor = (id) => cart.find((c) => c.product_id === id)?.qty || 0

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((c) => {
      if (c.product_id !== id) return c
      const next = c.qty + delta
      const max = maxQtyFor(c)
      if (delta > 0 && typeof max === 'number' && next > max) {
        showToast(c.unitMode === 'carton' ? `⚠️ الحد الأقصى المتوفر ${max} كرتون` : `⚠️ الحد الأقصى المتوفر ${max}`, true)
        return c
      }
      return { ...c, qty: Math.max(1, next) }
    }))
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.product_id !== id))

  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  // ✅ حساب العروض المطبَّقة على السلة الحالية (bogo/percent/fixed/tier_discount)
  const promoInput = cart.map((c) => ({ id: c.product_id, price: unitPrice(c), qty: c.qty, brand_id: c.brand_id }))
  const { lines: promoLines, subtotal, promoDiscount, appliedPromoNames, netTotal } = applyPromotions(promoInput, promos)
  const total = netTotal // ✅ المجموع الفعلي المطلوب من الزبون بعد كل الخصومات

  const submitOrder = async ({ phone, note }) => {
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return }
    if (!isOnline) { showToast('📡 لا يوجد اتصال بالإنترنت — لا يمكن إرسال الطلبية الآن', true); return }
    setSaving(true)
    try {
      // ✅ نبني عناصر الطلبية من نتيجة applyPromotions (تعكس الكميات المجانية
      // والقيمة الفعلية المدفوعة لكل سطر بعد كل الخصومات)
      const items = cart.map((c, i) => {
        const l = promoLines[i]
        return {
          product_id: c.product_id,
          name: c.name,
          quantity: c.qty,
          paid_qty: l.paidQty,
          free_qty: l.freeQty,
          unit: c.unitMode === 'carton' ? 'carton' : 'unit',
          price: unitPrice(c),
          total: l.lineTotal,
        }
      })
      const { error } = await supabase.from('orders').insert({
        customer_name: store.name,
        customer_phone: phone.trim() || null,
        customer_address: store.address || null,
        store_id: store.id,
        items: JSON.stringify(items),
        total,
        discount: promoDiscount || 0,
        status: 'processing',
        notes: note.trim() || null,
        employee_id: employee.id,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      showToast(`✅ تم تسجيل طلبية "${store.name}" بقيمة ${total.toFixed(0)} دج`)
      const newOrder = {
        storeName: store.name,
        address: store.address,
        items,
        total,
        employeeName: employee.name,
        dateStr: new Date().toLocaleString('ar'),
      }
      setCompletedOrder(newOrder)
      // ✅ طباعة تلقائية بعد كل بيع (إعداد اختياري بشاشة إعدادات الطباعة)
      if (getAutoPrint()) {
        try {
          if (!isConnected()) await reconnectSavedPrinter()
          if (isConnected()) { await printReceipt(newOrder); showToast('🖨️ طُبعت الفاتورة تلقائياً') }
        } catch (e) {
          console.error('❌ خطأ الطباعة التلقائية:', e)
        }
      }
      setCart([])
      return true
    } catch (e) {
      console.error('❌ خطأ إرسال الطلبية:', e)
      showToast('❌ ' + (e.message || 'فشل إرسال الطلبية'), true)
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    products, cart, saving, searching, completedOrder, setCompletedOrder,
    subtotal, promoDiscount, appliedPromoNames, total, totalItems,
    unitPrice, addToCart, cartQtyFor, updateQty, removeFromCart, submitOrder,
  }
}
