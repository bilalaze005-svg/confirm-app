import { useState } from 'react'
import { T, buttonGhost } from '../lib/theme.js'
import { connectPrinter, printReceipt, printTestPage, isConnected, isSupported } from '../lib/print.js'

/**
 * @file PrintButton.jsx
 * @description زر طباعة عبر طابعة حرارية بلوتوث (BLE). يتصل تلقائياً عند أول ضغطة
 * لو ما كانت الطابعة متصلة، ثم يطبع. راجع lib/print.js للتفاصيل والحدود المعروفة.
 */
export default function PrintButton({ order, showToast }) {
  const [status, setStatus] = useState('idle') // idle | connecting | printing | connected

  if (!isSupported()) {
    return (
      <div style={{ fontSize: 11.5, color: T.textFaint, textAlign: 'center', padding: '8px 4px' }}>
        🖨️ الطباعة عبر بلوتوث غير مدعومة بهذا المتصفح (تحتاج Chrome على أندرويد)
      </div>
    )
  }

  const handlePrint = async () => {
    try {
      if (!isConnected()) {
        setStatus('connecting')
        const printer = await connectPrinter()
        showToast(`🔗 تم الاتصال بـ ${printer.name}`)
      }
      setStatus('printing')
      await printReceipt(order)
      showToast('🖨️ تم إرسال الفاتورة للطباعة')
      setStatus('connected')
    } catch (e) {
      console.error('❌ خطأ الطباعة:', e)
      showToast('❌ ' + (e.message || 'تعذّرت الطباعة'), true)
      setStatus('idle')
    }
  }

  const handleTestPrint = async () => {
    try {
      if (!isConnected()) {
        setStatus('connecting')
        const printer = await connectPrinter()
        showToast(`🔗 تم الاتصال بـ ${printer.name}`)
      }
      setStatus('printing')
      await printTestPage()
      showToast('🖨️ تم إرسال صفحة اختبار')
      setStatus('connected')
    } catch (e) {
      console.error('❌ خطأ اختبار الطباعة:', e)
      showToast('❌ ' + (e.message || 'تعذّر الاختبار'), true)
      setStatus('idle')
    }
  }

  const busy = status === 'connecting' || status === 'printing'

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
