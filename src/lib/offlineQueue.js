/**
 * @file offlineQueue.js
 * @description طابور طلبيات معلّقة تُخزَّن في localStorage عندما ينقطع
 * الاتصال أثناء محاولة تسجيل طلبية محل. تُزامَن تلقائياً عند عودة الشبكة.
 *
 * مبني بنفس نمط van-app/src/lib/offlineQueue.js بالضبط — المندوب
 * المتنقّل (بائع من محل لمحل) غالباً ما يعمل في مناطق بتغطية ضعيفة أو
 * منعدمة، فبدل منع تسجيل الطلبية بالكامل، نحفظها محلياً ونرسلها بمجرد
 * عودة الاتصال، دون أن يفقد المندوب أي بيانات أدخلها.
 */

const KEY = 'nq_confirm_pending_orders'

export function getPendingOrders() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function queueOrder(order) {
  const pending = getPendingOrders()
  const withId = { ...order, _localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, _queuedAt: new Date().toISOString() }
  pending.push(withId)
  localStorage.setItem(KEY, JSON.stringify(pending))
  return withId
}

export function removePendingOrder(localId) {
  const pending = getPendingOrders().filter(o => o._localId !== localId)
  localStorage.setItem(KEY, JSON.stringify(pending))
}

export function pendingCount() {
  return getPendingOrders().length
}

/**
 * يحاول إرسال كل الطلبيات المعلّقة عبر supabase.rpc('submit_store_order', ...).
 * يرجع { synced, failed } — أي طلبية فشلت لخطأ منطقي (نقص مخزون مثلاً،
 * وليس خطأ شبكة) تبقى بالطابور مع سبب الفشل حتى يراجعها المندوب يدوياً
 * (يعدّل الكمية أو يحذف الصنف) بدل أن تضيع بصمت أو تُعاد المحاولة للأبد.
 */
export async function syncPendingOrders(supabase) {
  const pending = getPendingOrders()
  let synced = 0
  const stillPending = []

  for (const order of pending) {
    try {
      const { error } = await supabase.rpc('submit_store_order', {
        p_employee_id: order.employee_id,
        p_store_id: order.store_id,
        p_items: order.items,
        p_customer_phone: order.customer_phone,
        p_notes: order.notes,
      })
      if (error) throw error
      synced++
    } catch (e) {
      const isNetworkError = e?.message === 'Failed to fetch' || e?.name === 'TypeError'
      if (isNetworkError) {
        // ما زلنا غير متصلين فعلياً، أبقِ الطلبية بالطابور دون تغيير
        stillPending.push(order)
      } else {
        // خطأ منطقي حقيقي (نقص مخزون مثلاً) — أبقِها مع سبب الفشل
        // ليراجعها المندوب بدل حذفها بصمت
        stillPending.push({ ...order, _error: e.message || 'فشل غير معروف' })
      }
    }
  }

  localStorage.setItem(KEY, JSON.stringify(stillPending))
  return { synced, failed: stillPending.length }
}
