import { useState, useCallback, useRef } from 'react'
import { T } from '../lib/theme.js'

/**
 * @file useToast.jsx
 * @description هوك تنبيهات بسيط. الاستخدام: const [showToast, ToastUI] = useToast()
 * ثم showToast('رسالة') أو showToast('خطأ', true) لتنبيه بلون أحمر.
 */
export default function useToast() {
  const [toast, setToast] = useState(null) // { message, isError }
  const timeoutRef = useRef(null)

  const showToast = useCallback((message, isError = false) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ message, isError })
    timeoutRef.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const ToastUI = toast ? (
    <div
      role="status"
      style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, maxWidth: '92%', background: toast.isError ? T.danger : T.text,
        color: 'white', padding: '12px 20px', borderRadius: T.radiusPill,
        fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        textAlign: 'center', animation: 'nqToastIn .2s ease',
      }}
    >
      {toast.message}
      <style>{`@keyframes nqToastIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  ) : null

  return [showToast, ToastUI]
}
