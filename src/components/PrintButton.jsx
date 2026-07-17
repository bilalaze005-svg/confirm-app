import { useState } from 'react'
import { T, buttonGhost } from '../lib/theme.js'
import { isConnected, isSupported, reconnectSavedPrinter, pickAndConnectPrinter, printReceipt, printTestPage } from '../lib/print.js'

/**
 * @file PrintButton.jsx
 * @description زر طباعة الفاتورة. يحاول أولاً الاتصال التلقائي بآخر طابعة محفوظة
 * (من شاشة إعدادات الطباعة)، وإن لم توجد طابعة محفوظة أو فشل الاتصال، يفتح نافذة
 * اختيار طابعة جديدة. حجم الخط وحجم الورق يُقرآن من الإعدادات المحفوظة تلقائياً
 * (راجع screens/PrintSettingsScreen.jsx).
 */
export default function PrintButton({ order, showToast }) {
  const [status, setStatus] = useState('idle') // idle | connecting | printing

  if (!isSupported()) {
    return (
      <div style={{ fontSize: 11.5, color: T.textFaint, textAlign: 'center', padding: '8px 4px' }}>
        🖨️ الطباعة غير مدعومة بهذا الجهاز
      </div>
    )
  }

  const ensureConnected = async () => {
    if (isConnected()) return
    setStatus('connecting')
    const reconnected = await reconnectSavedPrinter()
    if (!reconnected) {
      const printer = await pickAndConnectPrinter()
      showToast(`🔗 تم الاتصال بـ ${printer.name}`)
    }
  }

  const handlePrint = async () => {
    try {
      await ensureConnected()
      setStatus('printing')
      await printReceipt(order)
      showToast('🖨️ تم إرسال الفاتورة للطباعة')
      setStatus('idle')
    } catch (e) {
      console.error('❌ خطأ الطباعة:', e)
      showToast('❌ ' + (e.message || 'تعذّرت الطباعة'), true)
      setStatus('idle')
    }
  }

  const handleTestPrint = async () => {
    try {
      await ensureConnected()
      setStatus('printing')
      await printTestPage()
      showToast('🖨️ تم إرسال صفحة اختبار')
      setStatus('idle')
    } catch (e) {
      console.error('❌ خطأ اختبار الطباعة:', e)
      showToast('❌ ' + (e.message || 'تعذّر الاختبار'), true)
      setStatus('idle')
    }
  }

  const busy = status !== 'idle'

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={handlePrint} disabled={busy}
        style={{ flex: 1, padding: 13, borderRadius: T.radiusMd, border: 'none', background: busy ? T.textFaint : T.text, color: 'white', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {status === 'connecting' ? '⏳ جارِ الاتصال...' : status === 'printing' ? '⏳ جارِ الطباعة...' : '🖨️ طباعة الفاتورة'}
      </button>
      <button onClick={handleTestPrint} disabled={busy}
        style={{ ...buttonGhost, padding: '13px 12px', fontSize: 11.5 }} title="طباعة صفحة اختبار للتأكد من الاتصال">
        اختبار
      </button>
    </div>
  )
}
