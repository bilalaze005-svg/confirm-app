import { supabase } from './supabase.js'

/**
 * @file notifications.js
 * @description طبقة بيانات الإشعارات القادمة من الإدارة.
 *
 * ✅ الجدول الحقيقي (المُنشأ بلوحة الإدارة naqaa-admin، راجع
 * fix_notifications_schema.sql) يخزّن صفاً منفصلاً لكل مستلم مع عمود
 * target ('customer'|'employee'|'driver'|'admin') وعمود employee_id مضبوط
 * دائماً (حتى عند إرسال "لكل الموظفين" — الإدارة تُنشئ صفاً بكل employee_id
 * على حدة، وليس صفاً واحداً بـ employee_id فارغ). لذا الفلترة الصحيحة هي
 * target='employee' AND employee_id = <رقم هذا الموظف> فقط — بدون أي حالة
 * NULL، وإلا يرى الموظف إشعارات موجّهة لعملاء/سائقين/الإدارة أيضاً.
 *
 * حالة "مقروء/غير مقروء" تُحفظ محلياً على جهاز الموظف فقط (وليس بقاعدة
 * البيانات)، لتفادي الحاجة لعمود read_at قد لا يكون مناسباً للإشعارات
 * المشتركة بين عدة موظفين بنفس الجهاز.
 */

function readIdsKey(employeeId) {
  return `nq_confirm_notif_read_${employeeId}`
}

function getReadIds(employeeId) {
  try { return new Set(JSON.parse(localStorage.getItem(readIdsKey(employeeId)) || '[]')) }
  catch { return new Set() }
}

function saveReadIds(employeeId, idsSet) {
  try { localStorage.setItem(readIdsKey(employeeId), JSON.stringify([...idsSet])) } catch { /* تجاهل */ }
}

export async function fetchNotifications(employeeId) {
  if (!employeeId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,body,employee_id,created_at')
    .eq('target', 'employee')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error

  const readIds = getReadIds(employeeId)
  return (data || []).map(n => ({ ...n, isRead: readIds.has(n.id) }))
}

export function markAsRead(employeeId, notificationId) {
  const readIds = getReadIds(employeeId)
  readIds.add(notificationId)
  saveReadIds(employeeId, readIds)
}

export function markAllAsRead(employeeId, notificationIds) {
  const readIds = getReadIds(employeeId)
  notificationIds.forEach(id => readIds.add(id))
  saveReadIds(employeeId, readIds)
}

// اشتراك بالتحديثات الفورية (إشعار جديد يوصل مباشرة بدون إعادة فتح الشاشة)
export function subscribeToNotifications(employeeId, onInsert) {
  const channel = supabase
    .channel(`notifications-${employeeId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      const n = payload.new
      if (n.target === 'employee' && n.employee_id === employeeId) onInsert(n)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}
