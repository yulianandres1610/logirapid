import { useEffect, useRef } from 'react'
import { useKioskStore } from '../store/kiosk-store'
import { CONFIG } from '../config'

export function useInactivityTimeout() {
  const step = useKioskStore(s => s.step)
  const logoutGuard = useKioskStore(s => s.logoutGuard)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Only activate timeout when in kiosk mode (after guard PIN)
    const inactiveSteps = ['login', 'kiosk_select', 'loading', 'guard_pin']
    if (inactiveSteps.includes(step)) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logoutGuard()
      }, CONFIG.INACTIVITY_TIMEOUT)
    }

    resetTimer()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [step, logoutGuard])
}
