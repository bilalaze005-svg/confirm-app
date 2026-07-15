import { useEffect, useRef } from 'react'
import { T, buttonGhost } from '../lib/theme.js'

/**
 * @file QrScanner.jsx
 * @description ماسح QR بالكاميرا، يستخدم مكتبة html5-qrcode (npm). يتطلب إذن
 * الكاميرا من المتصفح/التطبيق. props: onScan(text), onClose().
 */
export default function QrScanner({ onScan, onClose }) {
  const containerRef = useRef(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled || !containerRef.current) return
      const scanner = new Html5Qrcode(containerRef.current.id)
      scannerRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          // نوقف المسح فور نجاح القراءة لتفادي مسح نفس الرمز عدة مرات
          scanner.stop().catch(() => {})
          onScan(decodedText)
        },
        () => { /* تجاهل أخطاء الإطارات الفردية أثناء المسح المستمر */ }
      ).catch((err) => {
        console.error('❌ تعذّر تشغيل الكاميرا:', err)
      })
    })

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>📷 وجّه الكاميرا نحو رمز QR</span>
        <button onClick={onClose} style={{ ...buttonGhost, background: 'rgba(255,255,255,.15)', color: 'white', border: 'none' }}>إغلاق</button>
      </div>
      <div id="nq-qr-reader" ref={containerRef} style={{ flex: 1, width: '100%' }} />
    </div>
  )
}
