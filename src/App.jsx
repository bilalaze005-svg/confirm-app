import { useState, useEffect, useCallback } from 'react'
import { configError, supabase } from './lib/supabase.js'
import { T, offlineBannerStyle } from './lib/theme.js'
import useToast from './hooks/useToast.jsx'
import useOnlineStatus from './hooks/useOnlineStatus.js'
import LoginScreen from './screens/LoginScreen.jsx'
import StoreSelectScreen from './screens/StoreSelectScreen.jsx'
import NewStoreScreen from './screens/NewStoreScreen.jsx'
import OrderScreen from './screens/OrderScreen.jsx'

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
        <button onClick={handleLogoutTap} style={{ background: confirmLogout ? T.danger : 'rgba(255,255,255,.16)', border: 'none', borderRadius: T.radiusPill, padding: '8px 16px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'background .15s ease' }}>
          {confirmLogout ? 'تأكيد الخروج؟' : 'خروج'}
        </button>
      </div>

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
    </div>
  )
}
