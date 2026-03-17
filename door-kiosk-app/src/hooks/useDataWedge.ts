import { useEffect } from 'react'
import { configureDataWedge, subscribeToScanner } from '../services/scanner'
import { useKioskStore } from '../store/kiosk-store'
import { isCubanIdQr } from '../utils/parse-cuban-id-qr'

export function useDataWedge() {
  const processIdScan = useKioskStore(s => s.processIdScan)
  const processInvoiceScan = useKioskStore(s => s.processInvoiceScan)
  const processProductScan = useKioskStore(s => s.processProductScan)

  useEffect(() => {
    configureDataWedge()

    return subscribeToScanner((data) => {
      const step = useKioskStore.getState().step

      // Only process scans when in kiosk mode (not login/select/loading)
      if (step === 'login' || step === 'kiosk_select' || step === 'loading' || step === 'guard_pin') return

      // Print label mode: route all scans to product lookup
      if (step === 'print_label') {
        processProductScan(data)
        return
      }

      if (isCubanIdQr(data)) {
        processIdScan(data)
      } else if (step === 'exit_pending') {
        processInvoiceScan(data)
      }
    })
  }, [processIdScan, processInvoiceScan, processProductScan])
}
