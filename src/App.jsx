import { useState, useEffect, useCallback } from 'react'
import { configError, supabase } from './lib/supabase.js'
import { T, offlineBannerStyle } from './lib/theme.js'
import useToast from './hooks/useToast.jsx'
import useOnlineStatus from './hooks/useOnlineStatus.js'
import { fetchNotifications, subscribeToNotifications } from './lib/notifications.js'
import NotificationBell from './components/NotificationBell.jsx'
import NotificationsScreen from './screens/NotificationsScreen.jsx'
import PrintSettingsScreen from './screens/PrintSettingsScreen.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import StoreSelectScreen from './screens/StoreSelectScreen.jsx'
import NewStoreScreen from './screens/NewStoreScreen.jsx'
import OrderScreen from './screens/OrderScreen.jsx'
import OrdersHistoryScreen from './screens/OrdersHistoryScreen.jsx'
import AccountingScreen from './screens/AccountingScreen.jsx'

export default function App() {
  const [employee, setEmployee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nq_confirm_employee') || 'null') } catch { return null }
  })
  const [view, setView] = useState('select') // 'select' | 'newStore' | 'order'
  const [activeStore, setActiveStore] = useState(null)
  const [todayCount, setTodayCount] = useState(0)
  const [countLoading, setCountLoading] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showToast, ToastUI] = useToast()
  const isOnline = useOnlineStatus()
  const [unreadCount, setUnreadCount] = useState(0)
  const [overlay, setOverlay] = useState(null) // null | 'notifications' | 'printSettings'

  const loadTodayCount = useCallback(async () => {
    if (!employee) return
    setCountLoading(true)
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .gte('created_at', start.toISOString())
      if (error) throw error
      setTodayCount(count || 0)
    } catch (e) {
      console.error('❌ خطأ في جلب عدد الطلبيات:', e)
      // لا نعرض توست هنا عمداً — فشل عرض العداد ثانوي وما يستاهل مقاطعة الموظف،
      // بس نتركه يقدر يعيد المحاولة بالضغط على العداد نفسه
    } finally {
      setCountLoading(false)
    }
  }, [employee])

  useEffect(() => { loadTodayCount() }, [loadTodayCount])

  // إعادة تحميل العداد تلقائياً لما يرجع الاتصال بعد انقطاع
  useEffect(() => {
    if (isOnline) loadTodayCount()
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // إشعارات: نجلب عدد غير المقروء عند الدخول، ونشترك بالتحديثات الفورية لإشعار جديد
  useEffect(() => {
    if (!employee) return
    let cancelled = false
    fetchNotifications(employee.id)
      .then(list => { if (!cancelled) setUnreadCount(list.filter(n => !n.isRead).length) })
      .catch(e => console.error('❌ خطأ جلب الإشعارات:', e))
    const unsubscribe = subscribeToNotifications(employee.id, () => {
      setUnreadCount(c => c + 1)
    })
    return () => { cancelled = true; unsubscribe() }
  }, [employee?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // إلغاء نية الخروج لو الموظف ما أكّد خلال 3 ثوانٍ (يمنع الخروج بالخطأ بضغطة واحدة)
  useEffect(() => {
    if (!confirmLogout) return
    const t = setTimeout(() => setConfirmLogout(false), 3000)
    return () => clearTimeout(t)
  }, [confirmLogout])

  if (configError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: T.danger, fontSize: 14 }}>{configError}</p>
        </div>
      </div>
    )
  }

  const handleLogoutTap = () => {
    if (!confirmLogout) { setConfirmLogout(true); return }
    localStorage.removeItem('nq_confirm_employee')
    setEmployee(null)
    setConfirmLogout(false)
  }

  if (!employee) return <LoginScreen onLogin={setEmployee} />

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {ToastUI}

      {!isOnline && (
        <div style={offlineBannerStyle}>📡 لا يوجد اتصال بالإنترنت — لن يتم حفظ أي تغييرات الآن</div>
      )}

      <div style={{ background: T.primaryGradient, padding: '20px 18px 22px', color: 'white', borderRadius: '0 0 28px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 6px 20px rgba(124,58,237,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏬</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{employee.name}</div>
            <button
              onClick={loadTodayCount}
              title="اضغط لتحديث العدد"
              style={{ background: 'none', border: 'none', padding: 0, color: 'white', fontFamily: 'inherit', fontSize: 11, opacity: 0.85, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {countLoading ? '⏳ جارِ التحديث...' : `✅ ${todayCount} طلبية اليوم`}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell unreadCount={unreadCount} onClick={() => setOverlay('notifications')} />
          <button onClick={() => setOverlay('printSettings')} aria-label="إعدادات الطباعة"
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.16)', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🖨️
          </button>
          <button onClick={handleLogoutTap} style={{ background: confirmLogout ? T.danger : 'rgba(255,255,255,.16)', border: 'none', borderRadius: T.radiusPill, padding: '8px 16px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'background .15s ease' }}>
            {confirmLogout ? 'تأكيد الخروج؟' : 'خروج'}
          </button>
        </div>
      </div>

      {overlay === 'notifications' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <NotificationsScreen
            employee={employee}
            showToast={showToast}
            onClose={() => setOverlay(null)}
            onReadStateChanged={setUnreadCount}
          />
        </div>
      )}

      {overlay === 'printSettings' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <PrintSettingsScreen showToast={showToast} onClose={() => setOverlay(null)} />
        </div>
      )}

      {overlay === 'myOrders' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <OrdersHistoryScreen employee={employee} onClose={() => setOverlay(null)} />
        </div>
      )}

      {overlay === 'accounting' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <AccountingScreen employee={employee} onClose={() => setOverlay(null)} />
        </div>
      )}

      {view === 'select' && (
        <StoreSelectScreen
          showToast={showToast}
          isOnline={isOnline}
          onStoreSelected={(store) => { setActiveStore(store); setView('order') }}
          onNewStore={() => setView('newStore')}
        />
      )}

      {view === 'newStore' && (
        <NewStoreScreen
          showToast={showToast}
          isOnline={isOnline}
          onCancel={() => setView('select')}
          onCreated={(store) => { setActiveStore(store); setView('order') }}
        />
      )}

      {view === 'order' && activeStore && (
        <OrderScreen
          store={activeStore}
          employee={employee}
          showToast={showToast}
          isOnline={isOnline}
          onChangeStore={() => { setActiveStore(null); setView('select') }}
          onDone={() => { setActiveStore(null); setView('select'); loadTodayCount() }}
        />
      )}

      {/* شريط سفلي ثابت: طلبياتي (بفلتر يوم/أسبوع/شهر) ومحاسبة (منتجات مباعة + مجموع النقود) */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white',
        borderTop: `1px solid ${T.border}`, display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 16px rgba(0,0,0,.06)', zIndex: 40 }}>
        {[
          { id: 'myOrders',   icon: '📦', label: 'طلبياتي' },
          { id: 'accounting', icon: '📊', label: 'محاسبة' },
        ].map(t => (
          <button key={t.id} onClick={() => setOverlay(t.id)}
            style={{ flex: 1, background: 'none', border: 'none', padding: '10px 0 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              cursor: 'pointer', fontFamily: 'inherit', color: T.textSoft }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ height: 64 }} /> {/* مسافة أسفل المحتوى حتى لا يغطيه الشريط الثابت */}
    </div>
  )
}
