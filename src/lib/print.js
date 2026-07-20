import { BleClient } from '@capacitor-community/bluetooth-le'

/**
 * @file print.js
 * @description طباعة فاتورة عبر طابعة حرارية متصلة بـ Bluetooth Low Energy (BLE)
 * باستخدام @capacitor-community/bluetooth-le (يشتغل داخل تطبيق Android الحقيقي،
 * بخلاف Web Bluetooth اللي لا يعمل داخل WebView التطبيقات).
 *
 * ملاحظات مهمة:
 * 1) الطابعة يجب أن تكون BLE، وليس Bluetooth Classic (SPP).
 * 2) النص العربي يُرسل كصورة (raster bitmap) لأن أغلب الطابعات الرخيصة لا تدعم
 *    ترميز UTF-8/العربي بجداولها الداخلية.
 */

// ── إعدادات محفوظة (حجم الورق + حجم الخط + هوية آخر طابعة متصلة) ──
const PAPER_STORAGE_KEY = 'nq_confirm_paper_size'
const FONT_STORAGE_KEY = 'nq_confirm_print_font_scale'
const PRINTER_ID_KEY = 'nq_confirm_printer_device_id'
const PRINTER_NAME_KEY = 'nq_confirm_printer_name'

// عرض الطباعة بالنقاط لكل حجم ورق شائع (بدقة 203dpi القياسية لهذه الطابعات)
export const PAPER_WIDTH_DOTS = { Roll80: 576, Roll58: 384 }
// ✅ تكبير عام لكل الأحجام: "الصغير" الجديد ≈ "الكبير" القديم (كان صغيراً
// فعلياً على الفاتورة الحقيقية)، و"متوسط" و"كبير" أكبر من ذلك بوضوح
export const PRINT_FONT_SCALE = { small: 1.3, medium: 1.7, large: 2.1 }

export function getPaperSize() { return localStorage.getItem(PAPER_STORAGE_KEY) || 'Roll80' }
export function setPaperSize(key) { localStorage.setItem(PAPER_STORAGE_KEY, key) }

export function getPrintFontSize() { return localStorage.getItem(FONT_STORAGE_KEY) || 'medium' }
export function setPrintFontSize(key) { localStorage.setItem(FONT_STORAGE_KEY, key) }

const AUTOPRINT_KEY = 'nq_confirm_autoprint'
const COPIES_KEY = 'nq_confirm_print_copies'
const FOOTER_KEY = 'nq_confirm_print_footer'

export function getAutoPrint() { return localStorage.getItem(AUTOPRINT_KEY) === '1' }
export function setAutoPrint(v) { localStorage.setItem(AUTOPRINT_KEY, v ? '1' : '0') }

export function getPrintCopies() { return parseInt(localStorage.getItem(COPIES_KEY) || '1', 10) }
export function setPrintCopies(n) { localStorage.setItem(COPIES_KEY, String(Math.min(Math.max(n, 1), 5))) }

export function getFooterText() { return localStorage.getItem(FOOTER_KEY) || '' }
export function setFooterText(t) { localStorage.setItem(FOOTER_KEY, t || '') }

export function getSavedPrinterName() { return localStorage.getItem(PRINTER_NAME_KEY) || null }

function saveConnectedPrinter(deviceId, name) {
  localStorage.setItem(PRINTER_ID_KEY, deviceId)
  localStorage.setItem(PRINTER_NAME_KEY, name || 'طابعة بدون اسم')
}
export function forgetSavedPrinter() {
  localStorage.removeItem(PRINTER_ID_KEY)
  localStorage.removeItem(PRINTER_NAME_KEY)
}

const CANDIDATE_SERVICES = [
  { service: '000018f0-0000-1000-8000-00805f9b34fb', writeChar: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', writeChar: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', writeChar: '0000ff02-0000-1000-8000-00805f9b34fb' },
]

let _deviceId = null
let _matchedService = null
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    initialized = true
  }
}

export function isSupported() { return true }
export function isConnected() { return !!_deviceId && !!_matchedService }

// خدمات GATT قياسية عامة (معلومات الجهاز/البطارية...) لا علاقة لها بالطباعة،
// نتجاهلها أثناء البحث الاحتياطي حتى لا نحاول الكتابة عليها بالخطأ
const IGNORED_GENERIC_SERVICES = ['1800', '1801', '180a', '180f']

// بحث احتياطي: لو الطابعة لا تطابق أياً من CANDIDATE_SERVICES المعروفة (شائع
// مع بعض الطابعات الصينية الرخيصة ذات معرّفات خاصة بالمصنّع)، نفحص كل خدمات
// الجهاز ونأخذ أول خاصية قابلة للكتابة نجدها، بدل الفشل الكامل
function findAnyWritableCharacteristic(services) {
  for (const service of services) {
    const shortId = service.uuid.slice(4, 8).toLowerCase()
    if (IGNORED_GENERIC_SERVICES.includes(shortId)) continue
    for (const char of service.characteristics || []) {
      if (char.properties?.write || char.properties?.writeWithoutResponse) {
        return {
          service: service.uuid, writeChar: char.uuid,
          useWriteWithoutResponse: !!char.properties.writeWithoutResponse,
        }
      }
    }
  }
  return null
}

async function discoverWritableService(deviceId) {
  // ✅ على أندرويد 13+، getServices() قد ترجع فاضية أحياناً إلا لو استُدعيت
  // discoverServices() أولاً (مشكلة معروفة بمكتبة @capacitor-community/bluetooth-le)
  try { await BleClient.discoverServices(deviceId) } catch { /* بعض الأجهزة لا تحتاجها، نتجاهل الخطأ */ }
  const services = await BleClient.getServices(deviceId)
  for (const candidate of CANDIDATE_SERVICES) {
    const svc = services.find(s => s.uuid.toLowerCase() === candidate.service.toLowerCase())
    const ch = svc?.characteristics.find(c => c.uuid.toLowerCase() === candidate.writeChar.toLowerCase())
    if (ch && (ch.properties.write || ch.properties.writeWithoutResponse)) {
      return { ...candidate, useWriteWithoutResponse: !!ch.properties.writeWithoutResponse }
    }
  }
  // ✅ لم تُطابَق أي خدمة معروفة — نجرّب البحث الاحتياطي العام قبل الاستسلام
  return findAnyWritableCharacteristic(services)
}

// يفتح نافذة اختيار جهاز بلوتوث جديد، يتصل، ويحفظ هويته لإعادة الاتصال تلقائياً لاحقاً
export async function pickAndConnectPrinter() {
  await ensureInitialized()

  const device = await BleClient.requestDevice({
    optionalServices: CANDIDATE_SERVICES.map(c => c.service),
  })

  await BleClient.connect(device.deviceId, () => { _deviceId = null; _matchedService = null })
  _deviceId = device.deviceId

  const matched = await discoverWritableService(device.deviceId)
  if (!matched) {
    await BleClient.disconnect(device.deviceId)
    _deviceId = null
    throw new Error('تم الاتصال بالجهاز لكن لم يتم العثور على خدمة طباعة معروفة — أرسل لي موديل طابعتك بالضبط لأضيف معرّفها')
  }

  _matchedService = matched
  saveConnectedPrinter(device.deviceId, device.name)
  return { name: device.name || 'طابعة بدون اسم' }
}

// يحاول الاتصال بآخر طابعة محفوظة تلقائياً (بدون فتح نافذة اختيار) — يفشل بهدوء لو
// كانت الطابعة غير موجودة بمدى البلوتوث أو مطفأة
export async function reconnectSavedPrinter() {
  const savedId = localStorage.getItem(PRINTER_ID_KEY)
  if (!savedId) return false
  await ensureInitialized()
  try {
    await BleClient.connect(savedId, () => { _deviceId = null; _matchedService = null })
    _deviceId = savedId
    const matched = await discoverWritableService(savedId)
    if (!matched) throw new Error('no matching service')
    _matchedService = matched
    return true
  } catch {
    _deviceId = null
    _matchedService = null
    return false
  }
}

export function disconnectPrinter() {
  if (_deviceId) BleClient.disconnect(_deviceId).catch(() => {})
  _deviceId = null
  _matchedService = null
}

// يرسل بايتات خام للطابعة، مقسّمة لدفعات صغيرة (أغلب طابعات BLE تقبل ~180-244 بايت كحد أقصى بالمرة)
async function writeBytes(bytes) {
  const CHUNK = 180
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK)
    const dataView = new DataView(chunk.buffer)
    if (_matchedService.useWriteWithoutResponse) {
      await BleClient.writeWithoutResponse(_deviceId, _matchedService.service, _matchedService.writeChar, dataView)
    } else {
      await BleClient.write(_deviceId, _matchedService.service, _matchedService.writeChar, dataView)
    }
    await new Promise(r => setTimeout(r, 12))
  }
}

// يرسم الفاتورة على canvas بالعربي (المتصفح/WebView يتكفّل بربط الحروف والاتجاه RTL تلقائياً)
function renderReceiptCanvas({ storeName, address, items, total, employeeName, dateStr }, widthDots, fontKey) {
  const scale = PRINT_FONT_SCALE[fontKey] ?? 1
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const lineHeight = Math.round(26 * scale)
  const padding = 12
  const fTitle = Math.round(24 * scale)
  const fSub = Math.round(16 * scale)
  const fSmall = Math.round(14 * scale)
  const fTotal = Math.round(20 * scale)
  const estimatedLines = 6 + items.length * 2 + (getFooterText() ? 1 : 0)
  canvas.width = widthDots
  canvas.height = estimatedLines * lineHeight + padding * 2

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  let y = padding + lineHeight

  ctx.font = `bold ${fTitle}px sans-serif`
  ctx.fillText(storeName, canvas.width / 2, y); y += lineHeight
  if (address) { ctx.font = `${fSub}px sans-serif`; ctx.fillText(address, canvas.width / 2, y); y += lineHeight }
  ctx.font = `${fSmall}px sans-serif`
  ctx.fillText(dateStr, canvas.width / 2, y); y += lineHeight * 1.2

  ctx.textAlign = 'right'
  ctx.font = `${fSub}px sans-serif`
  items.forEach(it => {
    ctx.fillText(`${it.name} × ${it.quantity}`, canvas.width - padding, y)
    ctx.textAlign = 'left'
    ctx.fillText(`${it.total.toFixed(0)} دج`, padding, y)
    ctx.textAlign = 'right'
    y += lineHeight
  })

  y += lineHeight * 0.4
  ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(canvas.width - padding, y); ctx.stroke()
  y += lineHeight

  ctx.font = `bold ${fTotal}px sans-serif`
  ctx.fillText('الإجمالي', canvas.width - padding, y)
  ctx.textAlign = 'left'
  ctx.fillText(`${total.toFixed(0)} دج`, padding, y)
  y += lineHeight * 1.2

  ctx.textAlign = 'center'
  ctx.font = `${fSmall}px sans-serif`
  ctx.fillText(`المندوب: ${employeeName}`, canvas.width / 2, y)

  const footer = getFooterText()
  if (footer) {
    y += lineHeight
    ctx.font = `${fSmall}px sans-serif`
    ctx.fillText(footer, canvas.width / 2, y)
  }

  return canvas
}

// يحوّل صورة الـ canvas إلى نقاط أبيض/أسود (1-bit) بصيغة أوامر ESC/POS الخام (GS v 0)
function canvasToEscposRaster(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const imgData = ctx.getImageData(0, 0, width, height).data
  const bytesPerRow = Math.ceil(width / 8)
  const raster = new Uint8Array(bytesPerRow * height)

  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      const idx = (yy * width + xx) * 4
      const gray = (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3
      if (gray < 160) raster[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx % 8)
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ])

  const out = new Uint8Array(header.length + raster.length)
  out.set(header, 0); out.set(raster, header.length)
  return out
}

export async function printTestPage() {
  if (!isConnected()) throw new Error('الطابعة غير متصلة')
  const widthDots = PAPER_WIDTH_DOTS[getPaperSize()] || 576
  const fontKey = getPrintFontSize()
  const scale = PRINT_FONT_SCALE[fontKey] ?? 1

  // ✅ نفس أسلوب الفاتورة بالضبط: النص العربي يُرسل كصورة (raster) وليس
  // نصاً خاماً — أغلب الطابعات الرخيصة لا تدعم ترميز UTF-8/العربي، فلو
  // أرسلنا النص مباشرة (كما كان سابقاً) يطبع فاضياً أو رموزاً غريبة حتى
  // لو الاتصال بالطابعة سليم تماماً، ما يعطي انطباعاً خاطئاً بوجود عطل.
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const lineHeight = Math.round(26 * scale)
  const padding = 12
  canvas.width = widthDots
  canvas.height = lineHeight * 3 + padding * 2

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'; ctx.direction = 'rtl'; ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(20 * scale)}px sans-serif`
  ctx.fillText('=== اختبار الطباعة ===', canvas.width / 2, padding + lineHeight)
  ctx.font = `${Math.round(15 * scale)}px sans-serif`
  ctx.fillText('Test OK 123', canvas.width / 2, padding + lineHeight * 2.2)

  const raster = canvasToEscposRaster(canvas)
  const init = new Uint8Array([0x1b, 0x40])
  const feed = new Uint8Array([0x0a, 0x0a, 0x0a])
  await writeBytes(init)
  await writeBytes(raster)
  await writeBytes(feed)
}

export async function printReceipt(order) {
  if (!isConnected()) throw new Error('الطابعة غير متصلة')
  const widthDots = PAPER_WIDTH_DOTS[getPaperSize()] || 576
  const canvas = renderReceiptCanvas(order, widthDots, getPrintFontSize())
  const raster = canvasToEscposRaster(canvas)
  const init = new Uint8Array([0x1b, 0x40])
  const feed = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a])
  const copies = getPrintCopies()
  for (let i = 0; i < copies; i++) {
    await writeBytes(init)
    await writeBytes(raster)
    await writeBytes(feed)
  }
}
