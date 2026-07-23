import { describe, it, expect } from 'vitest'
import { distanceKm, formatDistance, geoErrorMessage } from '../geo.js'

describe('distanceKm', () => {
  it('يحسب صفراً لنفس النقطة', () => {
    expect(distanceKm(36.75, 3.06, 36.75, 3.06)).toBeCloseTo(0, 5)
  })

  it('يحسب مسافة صحيحة تقريباً بين الجزائر ووهران (~350 كم خط مستقيم)', () => {
    const d = distanceKm(36.7538, 3.0588, 35.6969, -0.6331)
    expect(d).toBeGreaterThan(340)
    expect(d).toBeLessThan(360)
  })

  it('يرجّع null عند إحداثيات ناقصة', () => {
    expect(distanceKm(null, 3.06, 36.75, 3.06)).toBeNull()
    expect(distanceKm(36.75, undefined, 36.75, 3.06)).toBeNull()
    expect(distanceKm(36.75, 3.06, 36.75, NaN)).toBeNull()
  })
})

describe('formatDistance', () => {
  it('يعرض بالمتر إن كانت المسافة أقل من كم واحد', () => {
    expect(formatDistance(0.35)).toBe('350 م')
  })
  it('يعرض بالكيلومتر مع رقم عشري واحد فوق الكم', () => {
    expect(formatDistance(4.567)).toBe('4.6 كم')
  })
  it('يرجّع null بدون قيمة', () => {
    expect(formatDistance(null)).toBeNull()
    expect(formatDistance(undefined)).toBeNull()
  })
})

describe('geoErrorMessage', () => {
  it('يترجم كود 1 (رفض الإذن)', () => {
    expect(geoErrorMessage({ code: 1 })).toMatch(/رفض/)
  })
  it('يترجم كود 3 (انتهاء المهلة)', () => {
    expect(geoErrorMessage({ code: 3 })).toMatch(/مهلة/)
  })
  it('يرجّع رسالة افتراضية بدون خطأ', () => {
    expect(geoErrorMessage(null)).toMatch(/تعذّر/)
  })
})
