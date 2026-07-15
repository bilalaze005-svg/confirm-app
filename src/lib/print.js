import { BleClient } from '@capacitor-community/bluetooth-le'

/**
 * @file print.js
 * @description طباعة فاتورة عبر طابعة حرارية 80مم متصلة بـ Bluetooth Low Energy (BLE).
 *
 * ⚠️ ملاحظة تقنية مهمة تم تصحيحها في هذه النسخة:
 * الإصدار الأول من هذا الملف كان يستخدم Web Bluetooth (navigator.bluetooth) مباشرة.
 * هذا يشتغل تمام في متصفح Chrome العادي، لكن **لا يعمل إطلاقاً داخل تطبيق Android
 * المبني بـ Capacitor** لأن WebView المستخدم بالتطبيقات (حتى لو مبني على Chrome) لا
 * يفعّل Web Bluetooth API بتاتاً — قيد من جوجل نفسها على كل الـ WebViews وليس خاص
 * بهذا المشروع. لذلك تم استبدالها بـ @capacitor-community/bluetooth-le وهو الجسر
 * الرسمي الذي يتصل مباشرة بأجهزة البلوتوث الأصلية للنظام (Native Android Bluetooth API)
 * ويشتغل صحيح داخل التطبيق المُعبّأ.
 *
 * باقي الملاحظات (تنطبق بنفس القدر هنا):
 * 1) الطابعة يجب أن تكون BLE. لو طابعتك Bluetooth Classic (SPP) فهذا الجسر أيضاً لن
 *    يتصل بها — ولا حل ويب/Capacitor عام يقدر يحلها، تحتاج كود Android أصلي مخصص.
 * 2) النص العربي يُرسل كصورة (raster bitmap) بدل نص خام، لأن أغلب الطابعات الرخيصة
 *    لا تدعم ترميز UTF-8/العربي بجداولها الداخلية.
 */

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

export function isSupported() {
  // متاح دوماً تقريباً (المتصفح لو Web Bluetooth مدعوم، أو داخل تطبيق Capacitor)
  return true
}

// يفتح نافذة اختيار جهاز البلوتوث، يتصل، ويكتشف أول خدمة طباعة معروفة يدعمها الجهاز
export async function connectPrinter() {
  await ensureInitialized()

  const device = await BleClient.requestDevice({
    optionalServices: CANDIDATE_SERVICES.map(c => c.service),
  })

  await BleClient.connect(device.deviceId, () => {
    _deviceId = null
    _matchedService = null
  })

  _deviceId = device.deviceId

  // نفحص الخدمات الفعلية المتوفرة بالجهاز ونطابقها مع قائمتنا المرشّحة، ونتحقق
  // أيضاً أن الخاصية تدعم الكتابة فعلاً (بدل تخمين ذلك)
  const services = await BleClient.getServices(device.deviceId)
  for (const candidate of CANDIDATE_SERVICES) {
    const svc = services.find(s => s.uuid.toLowerCase() === candidate.service.toLowerCase())
    const ch = svc?.characteristics.find(c => c.uuid.toLowerCase() === candidate.writeChar.toLowerCase())
    if (ch && (ch.properties.write || ch.properties.writeWithoutResponse)) {
      _matchedService = { ...candidate, useWriteWithoutResponse: !!ch.properties.writeWithoutResponse }
      return { name: device.name || 'طابعة بدون اسم' }
    }
  }

  await BleClient.disconnect(device.deviceId)
  _deviceId = null
  throw new Error('تم الاتصال بالجهاز لكن لم يتم العثور على خدمة طباعة معروفة — أرسل لي موديل طابعتك بالضبط لأضيف معرّفها')
}

export function disconnectPrinter() {
  if (_deviceId) BleClient.disconnect(_deviceId).catch(() => {})
  _deviceId = null
  _matchedService = null
}

export function isConnected() {
  return !!_deviceId && !!_matchedService
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
function renderReceiptCanvas({ storeName, address, items, total, employeeName, dateStr }, widthDots = 384) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const lineHeight = 26
  const padding = 12
  const estimatedLines = 6 + items.length * 2
  canvas.width = widthDots
  canvas.height = estimatedLines * lineHeight + padding * 2

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  let y = padding + lineHeight

  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(storeName, canvas.width / 2, y); y += lineHeight
  if (address) { ctx.font = '16px sans-serif'; ctx.fillText(address, canvas.width / 2, y); y += lineHeight }
  ctx.font = '14px sans-serif'
  ctx.fillText(dateStr, canvas.width / 2, y); y += lineHeight * 1.2

  ctx.textAlign = 'right'
  ctx.font = '16px sans-serif'
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

  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('الإجمالي', canvas.width - padding, y)
  ctx.textAlign = 'left'
  ctx.fillText(`${total.toFixed(0)} دج`, padding, y)
  y += lineHeight * 1.2

  ctx.textAlign = 'center'
  ctx.font = '14px sans-serif'
  ctx.fillText(`المندوب: ${employeeName}`, canvas.width / 2, y)

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
      const isBlack = gray < 160
      if (isBlack) {
        raster[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx % 8)
      }
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
  const init = new Uint8Array([0x1b, 0x40])
  const text = new TextEncoder().encode('=== اختبار الطباعة ===\nTest OK 123\n\n\n')
  await writeBytes(init)
  await writeBytes(text)
}

export async function printReceipt(order) {
  if (!isConnected()) throw new Error('الطابعة غير متصلة')
  const canvas = renderReceiptCanvas(order)
  const raster = canvasToEscposRaster(canvas)
  const init = new Uint8Array([0x1b, 0x40])
  const feed = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a])
  await writeBytes(init)
  await writeBytes(raster)
  await writeBytes(feed)
}
