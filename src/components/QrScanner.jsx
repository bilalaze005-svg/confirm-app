import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/**
 * ماسح QR بالكاميرا — يستدعي onScan(text) بمجرد قراءة رمز صالح
 */
export default function QrScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stopped = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch (e) {
        console.error('QR camera error:', e)
        setError('تعذّر فتح الكاميرا — تأكد من منح الإذن للتطبيق')
      }
    }

    const tick = () => {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code && code.data) {
          onScan(code.data)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()
    return () => {
      stopped = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [onScan])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'black', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,.15)',
        color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px',
        fontWeight: 800, fontSize: 14, zIndex: 2
      }}>✕ إغلاق</button>

      <p style={{ color: 'white', fontWeight: 800, marginBottom: 16, textAlign: 'center', padding: '0 24px' }}>
        📷 وجّه الكاميرا نحو رمز QR الخاص بالمحل
      </p>

      {error ? (
        <p style={{ color: '#FCA5A5', textAlign: 'center', padding: 24 }}>{error}</p>
      ) : (
        <div style={{ width: '85%', maxWidth: 340, aspectRatio: '1', border: '3px solid #22C55E', borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
