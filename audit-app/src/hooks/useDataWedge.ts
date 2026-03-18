import { useEffect, useRef } from 'react'
import { configureDataWedge, subscribeToScanner } from '@/src/services/scanner'

const DEBOUNCE_MS = 500

export function useDataWedge(onScan: (barcode: string) => void) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 })

  useEffect(() => {
    configureDataWedge()
    const unsubscribe = subscribeToScanner((data) => {
      const barcode = data.trim()
      const now = Date.now()
      const last = lastScanRef.current

      // Ignore duplicate scan within debounce window
      if (barcode === last.barcode && now - last.time < DEBOUNCE_MS) {
        return
      }

      lastScanRef.current = { barcode, time: now }
      onScanRef.current(barcode)
    })
    return unsubscribe
  }, [])
}
