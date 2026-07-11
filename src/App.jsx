import { useState, useEffect, useCallback } from 'react'
import { configError, supabase } from './lib/supabase.js'
import useToast from './hooks/useToast.jsx'
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
  const [showToast, ToastUI] = useToast()

  const loadTodayCount = useCallback(async () => {
    if (!employee) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employee.id)
      .gte('created_at', start.toISOString())
    setTodayCount(count || 0)
  }, [employee])

  useEffect(() => { loadTodayCount() }, [loadTodayCount])

  if (configError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#DC2626', fontSize: 14 }}>{configError}</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('nq_confirm_employee')
    setEmployee(null)
  }

  if (!employee) return <LoginScreen onLogin={setEmployee} />

  return (
    <div style={{ minHeight: '100vh' }}>
      {ToastUI}

      <div style={{ background: 'linear-gradient(135deg,#1565C0,#0D47A1)', padding: '18px 18px 14px', color: 'white', borderRadius: '0 0 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>👋 {employee.name}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>✅ {todayCount} طلبية اليوم</div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 20, padding: '7px 14px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          خروج
        </button>
      </div>

      {view === 'select' && (
        <StoreSelectScreen
          showToast={showToast}
          onStoreSelected={(store) => { setActiveStore(store); setView('order') }}
          onNewStore={() => setView('newStore')}
        />
      )}

      {view === 'newStore' && (
        <NewStoreScreen
          showToast={showToast}
          onCancel={() => setView('select')}
          onCreated={(store) => { setActiveStore(store); setView('order') }}
        />
      )}

      {view === 'order' && activeStore && (
        <OrderScreen
          store={activeStore}
          employee={employee}
          showToast={showToast}
          onChangeStore={() => { setActiveStore(null); setView('select') }}
          onDone={() => { setActiveStore(null); setView('select'); loadTodayCount() }}
        />
      )}
    </div>
  )
}

