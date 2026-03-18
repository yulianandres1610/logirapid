import { useEffect, useRef } from 'react'
import { CONFIG } from '@/src/config'
import { useAuthStore } from '@/src/stores/auth-store'

export function useInactivityTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (isAuthenticated) {
      timerRef.current = setTimeout(() => {
        logout()
      }, CONFIG.INACTIVITY_TIMEOUT)
    }
  }

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated])

  return { resetTimer }
}
