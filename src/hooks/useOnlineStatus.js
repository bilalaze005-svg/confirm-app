import { useState, useEffect } from 'react'

/**
 * @file useOnlineStatus.js
 * @description يراقب حالة الاتصال بالإنترنت للجهاز، يفيد لعرض تنبيه واضح
 * للموظف بدل ما يشوف أخطاء غامضة لما يكون بدون شبكة (حالة شائعة للمندوبين
 * وهم متنقلين بين المحلات).
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
