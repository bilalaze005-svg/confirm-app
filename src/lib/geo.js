/**
 * @file geo.js
 * @description أدوات مساعدة صغيرة للتعامل مع الموقع الجغرافي: حساب المسافة
 * بين نقطتين (لترتيب المحلات حسب الأقرب) وتفسير أخطاء geolocation برسائل
 * عربية مفهومة بدل الأكواد الرقمية.
 */

// حساب المسافة بالكيلومتر بين نقطتين باستخدام صيغة Haversine
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v === null || v === undefined || Number.isNaN(v))) {
    return null
  }
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km) {
  if (km === null || km === undefined) return null
  if (km < 1) return `${Math.round(km * 1000)} م`
  return `${km.toFixed(1)} كم`
}

// يترجم كود خطأ GeolocationPositionError إلى رسالة عربية واضحة
export function geoErrorMessage(err) {
  if (!err) return '❌ تعذّر تحديد الموقع'
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return '⚠️ تم رفض إذن الموقع — فعّله من إعدادات المتصفح/الجهاز'
    case 2: // POSITION_UNAVAILABLE
      return '❌ تعذّر تحديد الموقع الحالي — تأكد من تفعيل GPS'
    case 3: // TIMEOUT
      return '⏳ انتهت مهلة تحديد الموقع — حاول في مكان مفتوح'
    default:
      return '❌ تعذّر تحديد الموقع'
  }
}
