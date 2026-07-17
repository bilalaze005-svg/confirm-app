import { useState, useEffect } from 'react'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import {
  isConnected, disconnectPrinter, pickAndConnectPrinter, reconnectSavedPrinter,
  getSavedPrinterName, getPaperSize, setPaperSize, getPrintFontSize, setPrintFontSize,
  getAutoPrint, setAutoPrint, getPrintCopies, setPrintCopies,
  getFooterText, setFooterText, printTestPage,
} from '../lib/print.js'

export default function PrintSettingsScreen({ onClose, showToast }) {
  const [connected, setConnected] = useState(isConnected())
  const [busy, setBusy] = useState(false)
  const [savedName, setSavedName] = useState(getSavedPrinterName())
  const [paper, setPaper] = useState(getPaperSize())
  const [fontKey, setFontKey] = useState(getPrintFontSize())
  const [autoprint, setAutoprintState] = useState(getAutoPrint())
  const [copies, setCopiesState] = useState(getPrintCopies())
  const [footer, setFooterState] = useState(getFooterText())

  // نحاول الاتصال التلقائي بآخر طابعة محفوظة عند فتح الشاشة، بدون إزعاج المستخدم لو فشل
  useEffect(() => {
    if (!connected && savedName) {
      reconnectSavedPrinter().then(ok => { if (ok) setConnected(true) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangePrinter = async () => {
    setBusy(true)
    try {
      const printer = await pickAndConnectPrinter()
      setConnected(true)
      setSavedName(printer.name)
      showToast(`✅ تم الاتصال بـ ${printer.name}`)
    } catch (e) {
      console.error('❌ خطأ الاتصال بالطابعة:', e)
      showToast('❌ ' + (e.message || 'تعذّر الاتصال'), true)
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = () => {
    disconnectPrinter()
    setConnected(false)
    showToast('🔌 تم قطع الاتصال بالطابعة')
  }

  const handleTestPrint = async () => {
    setBusy(true)
    try {
      if (!connected) { showToast('⚠️ الطابعة غير متصلة', true); return }
      await printTestPage()
      showToast('✅ أُرسلت صفحة اختبار — تحقق أن الطابعة طبعتها فعلياً')
    } catch (e) {
      showToast('❌ ' + (e.message || 'فشل الاختبار'), true)
    } finally {
      setBusy(false)
    }
  }

  const choosePaper       = (key) => { setPaper(key); setPaperSize(key) }
  const chooseFont        = (key) => { setFontKey(key); setPrintFontSize(key) }
  const handleAutoToggle  = () => { const n = !autoprint; setAutoprintState(n); setAutoPrint(n) }
  const handleCopiesDelta = (d)  => { const n = Math.min(Math.max(copies + d, 1), 5); setCopiesState(n); setPrintCopies(n) }
  const handleFooter      = (e)  => { setFooterState(e.target.value); setFooterText(e.target.value) }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* هيدر الشاشة */}
      <div style={{ background: 'white', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.text }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>🖨️ إعدادات الطباعة</div>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ padding: 16 }}>
        {/* حالة الطابعة */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: T.textSoft, fontWeight: 700 }}>الطابعة</span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: T.radiusPill,
              background: connected ? '#ECFDF5' : '#FEE2E2', color: connected ? T.success : T.danger,
            }}>
              {connected ? '● متصلة' : '● غير متصلة'}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
            {savedName || 'لا توجد طابعة محفوظة'}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleChangePrinter} disabled={busy}
              style={{ ...buttonPrimary, flex: 1, padding: 12, fontSize: 12.5 }}>
              {busy ? '⏳ ...' : '🔍 تغيير الطابعة'}
            </button>
            {connected && (
              <button onClick={handleDisconnect} disabled={busy}
                style={{ flex: 1, padding: 12, fontSize: 12.5, borderRadius: T.radiusMd, border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit', background: '#FEE2E2', color: T.danger }}>
                🔌 قطع الاتصال
              </button>
            )}
          </div>

          <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 12, lineHeight: 1.7 }}>
            اضغط "تغيير الطابعة" واختر جهازك من القائمة التي يعرضها النظام. تأكد أن بلوتوث
            الهاتف مفعّل وأن الطابعة مُشغّلة وقريبة منك. الطابعة تُحفظ تلقائياً لمرات الاستخدام القادمة.
          </div>

          {connected && (
            <button onClick={handleTestPrint} disabled={busy}
              style={{ ...buttonGhost, width: '100%', padding: 12, fontSize: 12.5, marginTop: 12 }}>
              {busy ? '⏳ جارِ الطباعة...' : '🧾 اختبار الطباعة'}
            </button>
          )}
        </div>

        {/* حجم الورق */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>حجم الورق</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'Roll80', l: 'Roll80' }, { v: 'Roll58', l: 'Roll58' }].map(w => (
              <button key={w.v} onClick={() => choosePaper(w.v)}
                style={{ flex: 1, padding: 12, borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  background: paper === w.v ? T.success : T.bg, color: paper === w.v ? 'white' : T.textSoft }}>
                {w.l}
              </button>
            ))}
          </div>
        </div>

        {/* حجم الخط */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>حجم الخط</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'large', l: 'كبير' }, { v: 'medium', l: 'متوسط' }, { v: 'small', l: 'صغير' }].map(f => (
              <button key={f.v} onClick={() => chooseFont(f.v)}
                style={{ flex: 1, padding: 12, borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  background: fontKey === f.v ? T.success : T.bg, color: fontKey === f.v ? 'white' : T.textSoft }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* إعدادات إضافية */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>طباعة تلقائية بعد كل بيع</span>
            <button onClick={handleAutoToggle}
              style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                background: autoprint ? T.primary : T.border }}>
              <span style={{ position: 'absolute', top: 3, [autoprint ? 'right' : 'left']: 3, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>عدد نسخ الفاتورة</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => handleCopiesDelta(-1)} disabled={copies <= 1}
                style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies <= 1 ? 0.4 : 1 }}>−</button>
              <span style={{ fontSize: 14, fontWeight: 900, minWidth: 16, textAlign: 'center' }}>{copies}</span>
              <button onClick={() => handleCopiesDelta(1)} disabled={copies >= 5}
                style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies >= 5 ? 0.4 : 1 }}>+</button>
            </div>
          </div>

          <div style={{ padding: '10px 0 2px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>نص أسفل الفاتورة</span>
            <input value={footer} onChange={handleFooter} maxLength={60}
              placeholder="شكراً لتعاملكم معنا" style={{ ...inputStyle, padding: 9, fontSize: 12.5 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
