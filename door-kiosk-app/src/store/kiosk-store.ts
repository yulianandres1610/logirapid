import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  KioskStep,
  KioskInfo,
  GuardInfo,
  VisitorInfo,
  KioskStats,
  PendingSale,
  ScannedInvoice,
  AvailableKiosk,
  ScannedProduct,
  PrintJobResult,
} from './types'
import {
  authGuard,
  fetchKioskInfo,
  verifyGuard,
  findOrCreateVisitor,
  fetchPendingSales,
  registerLog,
  scanDocument,
  fetchTodayLogs,
  type VisitorLogEntry,
  validateDocument,
  fetchKioskStats,
  scanProduct,
  searchProducts as apiSearchProducts,
  printProductLabel,
} from '../services/api'
import { parseCubanIdQr } from '../utils/parse-cuban-id-qr'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '../services/feedback'
import { CONFIG } from '../config'

const STORAGE_KEY_KIOSK = '@door_kiosk_selected_id'

/**
 * Normalize barcodes that were printed without dashes.
 * FAC20260006 → FAC-2026-0006
 * POS20260006 → POS-2026-0006
 * INV20260006 → INV-2026-0006
 * If already has dashes, return as-is.
 */
function normalizeDocumentBarcode(barcode: string): string {
  const trimmed = barcode.trim()

  // Already has dashes — return as-is
  if (trimmed.includes('-')) return trimmed

  // Match pattern: PREFIX(3 letters) + YEAR(4 digits) + SEQ(4+ digits)
  const match = trimmed.match(/^([A-Z]{3})(\d{4})(\d{4,})$/)
  if (match) {
    const [, prefix, year, seq] = match
    return `${prefix}-${year}-${seq}`
  }

  return trimmed
}

interface KioskStore {
  // Auth & kiosk selection
  step: KioskStep
  availableKiosks: AvailableKiosk[]
  selectedKioskId: string | null

  // Kiosk state
  kiosk: KioskInfo | null
  guard: GuardInfo | null
  visitor: VisitorInfo | null
  stats: KioskStats | null
  pendingSales: PendingSale[]
  scannedInvoices: ScannedInvoice[]
  errorMessage: string
  activeLogId: number | null
  selectedPurpose: string
  entryTime: string | null
  parsedName: string | null
  todayLogs: VisitorLogEntry[]

  // Print label state
  scannedProduct: ScannedProduct | null
  printCopies: number
  isPrinting: boolean
  printResult: PrintJobResult | null
  productSearchResults: ScannedProduct[]
  productSearchQuery: string

  // Actions — auth flow
  init: () => Promise<void>
  loginGuard: (pin: string) => Promise<{ success: boolean; error?: string }>
  selectKiosk: (kiosk: AvailableKiosk) => Promise<void>
  changeKiosk: () => void

  // Actions — kiosk flow
  loadKiosk: () => Promise<void>
  authenticateGuard: (pin: string) => Promise<boolean>
  processIdScan: (qrText: string) => Promise<void>
  processInvoiceScan: (barcode: string) => Promise<void>
  selectPurpose: (purpose: string) => Promise<void>
  confirmExit: (notes?: string) => Promise<void>
  resetToIdle: () => void
  logoutGuard: () => void
  logoutFull: () => void
  refreshStats: () => Promise<void>
  showTodayLog: () => Promise<void>
  hideTodayLog: () => void
  showInsideVisitors: () => Promise<void>
  hideInsideVisitors: () => void

  // Actions — print label
  enterPrintMode: () => void
  exitPrintMode: () => void
  processProductScan: (barcode: string) => Promise<void>
  searchProducts: (query: string) => Promise<void>
  selectProduct: (product: ScannedProduct) => void
  setPrintCopies: (n: number) => void
  printLabel: () => Promise<void>
  clearScannedProduct: () => void
}

export const useKioskStore = create<KioskStore>((set, get) => ({
  step: 'login',
  availableKiosks: [],
  selectedKioskId: null,

  kiosk: null,
  guard: null,
  visitor: null,
  stats: null,
  pendingSales: [],
  scannedInvoices: [],
  errorMessage: '',
  activeLogId: null,
  selectedPurpose: '',
  entryTime: null,
  parsedName: null,
  todayLogs: [],

  // Print label state
  scannedProduct: null,
  printCopies: 1,
  isPrinting: false,
  printResult: null,
  productSearchResults: [],
  productSearchQuery: '',

  // Check if there's a saved kiosk — if so, skip to guard_pin
  init: async () => {
    try {
      const savedId = await AsyncStorage.getItem(STORAGE_KEY_KIOSK)
      if (savedId) {
        set({ selectedKioskId: savedId, step: 'loading' })
        await get().loadKiosk()
      } else {
        set({ step: 'login' })
      }
    } catch {
      set({ step: 'login' })
    }
  },

  // Step 1: Guard logs in with PIN → get available kiosks
  loginGuard: async (pin: string) => {
    try {
      const data = await authGuard(pin)
      const guard = data.guard

      // Single kiosk assigned → save and go
      if (data.kiosk && !data.kiosks) {
        const kioskId = data.kiosk.id.toString()
        await AsyncStorage.setItem(STORAGE_KEY_KIOSK, kioskId)
        set({
          guard,
          selectedKioskId: kioskId,
          availableKiosks: [data.kiosk],
          step: 'loading',
        })
        await get().loadKiosk()
        return { success: true }
      }

      // Multiple kiosks → show selection
      if (data.kiosks && data.kiosks.length > 0) {
        set({
          guard,
          availableKiosks: data.kiosks,
          step: 'kiosk_select',
        })
        return { success: true }
      }

      // No kiosks available
      return { success: false, error: 'No hay puertas asignadas' }
    } catch (err: any) {
      return { success: false, error: err.message || 'PIN invalido' }
    }
  },

  // Step 2: Select a kiosk from the list
  selectKiosk: async (kiosk: AvailableKiosk) => {
    const kioskId = kiosk.id.toString()
    await AsyncStorage.setItem(STORAGE_KEY_KIOSK, kioskId)
    set({ selectedKioskId: kioskId, step: 'loading' })
    await get().loadKiosk()
  },

  // Go back to kiosk selection (from settings or long-press)
  changeKiosk: () => {
    AsyncStorage.removeItem(STORAGE_KEY_KIOSK)
    set({
      selectedKioskId: null,
      kiosk: null,
      guard: null,
      step: 'login',
      availableKiosks: [],
    })
  },

  // Load kiosk info and go to guard_pin
  loadKiosk: async () => {
    const { selectedKioskId } = get()
    if (!selectedKioskId) {
      set({ step: 'login' })
      return
    }

    try {
      const kiosk = await fetchKioskInfo(selectedKioskId)
      set({ kiosk, step: 'guard_pin' })
    } catch (err: any) {
      set({
        step: 'error',
        errorMessage: err.message || 'Error al cargar el kiosk',
      })
      // If kiosk not found, clear saved and go back to login
      setTimeout(() => {
        AsyncStorage.removeItem(STORAGE_KEY_KIOSK)
        set({ step: 'login', selectedKioskId: null })
      }, 3000)
    }
  },

  // Guard PIN at kiosk level (same as PWA)
  authenticateGuard: async (pin: string) => {
    const { selectedKioskId } = get()
    if (!selectedKioskId) return false

    try {
      const data = await verifyGuard(selectedKioskId, pin)
      const guard = data.guard
      set({ guard, step: 'idle' })
      get().refreshStats()
      return true
    } catch {
      return false
    }
  },

  processIdScan: async (qrText: string) => {
    const { step, guard, selectedKioskId } = get()
    if (!selectedKioskId) return

    const allowedSteps: KioskStep[] = ['idle', 'error', 'entry_success', 'exit_success']
    if (!allowedSteps.includes(step)) return

    const parsed = parseCubanIdQr(qrText)
    if (!parsed || !parsed.isValid) {
      playErrorBeep()
      vibrateError()
      set({ step: 'error', errorMessage: 'QR no valido' })
      setTimeout(() => {
        if (get().step === 'error') set({ step: 'idle' })
      }, 2000)
      return
    }

    playSuccessBeep()
    vibrateSuccess()

    set({
      visitor: null,
      activeLogId: null,
      pendingSales: [],
      scannedInvoices: [],
      selectedPurpose: '',
      entryTime: null,
      errorMessage: '',
      parsedName: parsed.fullName,
      step: 'processing',
    })

    try {
      const visitor = await findOrCreateVisitor({
        kioskId: parseInt(selectedKioskId),
        guardId: guard!.id,
        fullName: parsed.fullName,
        idType: 'cedula',
        idNumber: parsed.idNumber,
        dateOfBirth: parsed.dateOfBirth || null,
      })

      set({ visitor })

      if (visitor.isCurrentlyInside) {
        const logId = visitor.activeLogId
        set({ activeLogId: logId })

        if (logId) {
          try {
            const { pendingSales, entryTime } = await fetchPendingSales(logId, selectedKioskId, guard!.id)
            console.log('[Exit] pendingSales:', pendingSales.length, 'entryTime:', entryTime)
            set({ pendingSales, entryTime })
          } catch (e: any) {
            console.log('[Exit] fetchPendingSales error:', e?.message)
            set({ pendingSales: [] })
          }
        }

        set({ scannedInvoices: [], step: 'exit_pending' })
      } else {
        set({ step: 'purpose_select' })
      }
    } catch (err: any) {
      set({ step: 'error', errorMessage: err.message || 'Error al procesar' })
      setTimeout(() => {
        if (get().step === 'error') set({ step: 'idle' })
      }, 3000)
    }
  },

  processInvoiceScan: async (barcode: string) => {
    const { step, activeLogId, scannedInvoices, guard, selectedKioskId } = get()

    if (step !== 'exit_pending' || !activeLogId || !guard || !selectedKioskId) return

    // Normalize barcode: FAC20260006 → FAC-2026-0006, POS20260006 → POS-2026-0006
    const normalized = normalizeDocumentBarcode(barcode)

    // Only block if already validated successfully — allow retry on error
    if (scannedInvoices.some(s => s.documentNumber === normalized && s.validated)) return

    // Remove previous failed entry for this barcode (retry)
    const cleaned = scannedInvoices.filter(s => s.documentNumber !== normalized)
    set({ scannedInvoices: cleaned })

    playSuccessBeep()
    vibrateSuccess()

    try {
      console.log('[InvoiceScan] Scanning:', normalized, 'logId:', activeLogId, 'kioskId:', selectedKioskId, 'guardId:', guard.id)
      const scanResult = await scanDocument({
        scannedCode: normalized,
        visitorLogId: activeLogId,
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
      })
      console.log('[InvoiceScan] Result:', JSON.stringify(scanResult))

      if (scanResult && scanResult.found) {
        // If already validated in a previous visit, it's NOT valid for this exit
        if (scanResult.alreadyValidated) {
          console.log('[InvoiceScan] Document already validated previously — not valid')
          set({
            scannedInvoices: [
              ...get().scannedInvoices,
              { documentNumber: normalized, validated: false, reason: 'Ya fue validada anteriormente' },
            ],
          })
          playErrorBeep()
        } else {
          // Validate the document
          await validateDocument({
            visitorLogId: activeLogId,
            documentType: scanResult.documentType,
            documentId: scanResult.documentId,
            documentNumber: scanResult.documentNumber || normalized,
            totalAmount: scanResult.totalAmount,
            currency: scanResult.currency,
            kioskId: parseInt(selectedKioskId),
            guardId: guard.id,
          })

          set({
            scannedInvoices: [
              ...get().scannedInvoices,
              { documentNumber: normalized, validated: true },
            ],
          })
          playSuccessBeep()
        }
      } else {
        // Document not found
        set({
          scannedInvoices: [
            ...get().scannedInvoices,
            { documentNumber: normalized, validated: false, reason: 'Documento no encontrado' },
          ],
        })
        playErrorBeep()
      }
    } catch (err: any) {
      console.log('[InvoiceScan] Error:', err?.message || err)
      set({
        scannedInvoices: [
          ...get().scannedInvoices,
          { documentNumber: normalized, validated: false, reason: err?.message || 'Error al validar' },
        ],
      })
      playErrorBeep()
    }
  },

  selectPurpose: async (purpose: string) => {
    const { visitor, guard, selectedKioskId } = get()
    if (!visitor || !guard || !selectedKioskId) return

    set({ selectedPurpose: purpose })

    try {
      await registerLog({
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
        visitorId: visitor.id,
        action: 'entry',
        visitPurpose: purpose,
      })

      playSuccessBeep()
      vibrateSuccess()
      set({ step: 'entry_success' })
      get().refreshStats()

      setTimeout(() => {
        const current = get().step
        if (current === 'entry_success') get().resetToIdle()
      }, CONFIG.SUCCESS_SCREEN_DURATION)
    } catch (err: any) {
      set({ step: 'error', errorMessage: err.message || 'Error al registrar entrada' })
      setTimeout(() => {
        if (get().step === 'error') set({ step: 'idle' })
      }, 3000)
    }
  },

  confirmExit: async (notes?: string) => {
    const { visitor, guard, activeLogId, selectedKioskId } = get()
    if (!visitor || !guard || !activeLogId || !selectedKioskId) return

    try {
      await registerLog({
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
        visitorId: visitor.id,
        action: 'exit',
        logId: activeLogId,
        ...(notes ? { visitNotes: notes } : {}),
      })

      playSuccessBeep()
      vibrateSuccess()
      set({ step: 'exit_success' })
      get().refreshStats()

      setTimeout(() => {
        const current = get().step
        if (current === 'exit_success') get().resetToIdle()
      }, CONFIG.SUCCESS_SCREEN_DURATION)
    } catch (err: any) {
      set({ step: 'error', errorMessage: err.message || 'Error al registrar salida' })
      setTimeout(() => {
        if (get().step === 'error') set({ step: 'idle' })
      }, 3000)
    }
  },

  resetToIdle: () => {
    const { step } = get()
    if (step === 'processing' || step === 'purpose_select' || step === 'exit_pending') return

    set({
      visitor: null,
      parsedName: null,
      activeLogId: null,
      pendingSales: [],
      scannedInvoices: [],
      selectedPurpose: '',
      entryTime: null,
      errorMessage: '',
      scannedProduct: null,
      printCopies: 1,
      isPrinting: false,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      step: 'idle',
    })
  },

  // Inactivity → back to guard PIN (keeps kiosk)
  logoutGuard: () => {
    set({
      guard: null,
      visitor: null,
      parsedName: null,
      activeLogId: null,
      pendingSales: [],
      scannedInvoices: [],
      selectedPurpose: '',
      entryTime: null,
      errorMessage: '',
      stats: null,
      scannedProduct: null,
      printCopies: 1,
      isPrinting: false,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      step: 'guard_pin',
    })
  },

  // Full logout → back to login (clears kiosk)
  logoutFull: () => {
    AsyncStorage.removeItem(STORAGE_KEY_KIOSK)
    set({
      guard: null,
      kiosk: null,
      selectedKioskId: null,
      availableKiosks: [],
      visitor: null,
      parsedName: null,
      activeLogId: null,
      pendingSales: [],
      scannedInvoices: [],
      selectedPurpose: '',
      entryTime: null,
      errorMessage: '',
      stats: null,
      scannedProduct: null,
      printCopies: 1,
      isPrinting: false,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      step: 'login',
    })
  },

  refreshStats: async () => {
    const { selectedKioskId, guard } = get()
    if (!selectedKioskId || !guard) return
    try {
      const stats = await fetchKioskStats(selectedKioskId, guard.id)
      set({ stats })
    } catch {
      // Stats not critical
    }
  },

  showTodayLog: async () => {
    const { selectedKioskId, guard } = get()
    if (!selectedKioskId || !guard) return
    set({ step: 'today_log', todayLogs: [] })
    try {
      const logs = await fetchTodayLogs(selectedKioskId, guard.id)
      set({ todayLogs: logs })
    } catch {
      set({ todayLogs: [] })
    }
  },

  hideTodayLog: () => {
    set({ step: 'idle', todayLogs: [] })
  },

  showInsideVisitors: async () => {
    const { selectedKioskId, guard } = get()
    if (!selectedKioskId || !guard) return
    set({ step: 'inside_list', todayLogs: [] })
    try {
      const logs = await fetchTodayLogs(selectedKioskId, guard.id)
      // Filter only visitors currently inside (no exitTime)
      const inside = logs.filter(l => !l.exitTime)
      set({ todayLogs: inside })
    } catch {
      set({ todayLogs: [] })
    }
  },

  hideInsideVisitors: () => {
    set({ step: 'idle', todayLogs: [] })
  },

  // Print label actions
  enterPrintMode: () => {
    set({
      step: 'print_label',
      scannedProduct: null,
      printCopies: 1,
      isPrinting: false,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      errorMessage: '',
    })
  },

  exitPrintMode: () => {
    set({
      step: 'idle',
      scannedProduct: null,
      printCopies: 1,
      isPrinting: false,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      errorMessage: '',
    })
  },

  processProductScan: async (barcode: string) => {
    const { guard, selectedKioskId } = get()
    if (!guard || !selectedKioskId) return

    playSuccessBeep()
    vibrateSuccess()

    try {
      const result = await scanProduct({
        barcode: barcode.trim(),
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
      })

      if (result.found && result.product) {
        set({ scannedProduct: result.product, printCopies: 1, printResult: null, errorMessage: '' })
      } else {
        playErrorBeep()
        vibrateError()
        set({ errorMessage: `Producto no encontrado: ${barcode}` })
        setTimeout(() => {
          if (get().step === 'print_label') set({ errorMessage: '' })
        }, 3000)
      }
    } catch (err: any) {
      playErrorBeep()
      vibrateError()
      set({ errorMessage: err.message || 'Error al buscar producto' })
      setTimeout(() => {
        if (get().step === 'print_label') set({ errorMessage: '' })
      }, 3000)
    }
  },

  searchProducts: async (query: string) => {
    const { guard, selectedKioskId } = get()
    if (!guard || !selectedKioskId) return

    set({ productSearchQuery: query })

    if (query.trim().length < 2) {
      set({ productSearchResults: [] })
      return
    }

    try {
      const result = await apiSearchProducts({
        query: query.trim(),
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
      })
      set({ productSearchResults: result.products })
    } catch {
      set({ productSearchResults: [] })
    }
  },

  selectProduct: (product: ScannedProduct) => {
    set({
      scannedProduct: product,
      printCopies: 1,
      printResult: null,
      productSearchResults: [],
      productSearchQuery: '',
      errorMessage: '',
    })
  },

  setPrintCopies: (n: number) => {
    set({ printCopies: Math.max(1, Math.min(99, n)) })
  },

  printLabel: async () => {
    const { scannedProduct, printCopies, guard, selectedKioskId } = get()
    if (!scannedProduct || !guard || !selectedKioskId) return

    set({ isPrinting: true, errorMessage: '' })

    try {
      const result = await printProductLabel({
        kioskId: parseInt(selectedKioskId),
        guardId: guard.id,
        items: [{
          name: scannedProduct.name,
          barcode: scannedProduct.barcode,
          sku: scannedProduct.sku,
          price: scannedProduct.sellingPrice,
          currency: scannedProduct.currency,
        }],
        copies: printCopies,
      })

      playSuccessBeep()
      vibrateSuccess()
      set({ isPrinting: false, printResult: result })

      // Auto-clear after 2s for next scan
      setTimeout(() => {
        if (get().step === 'print_label') {
          set({ scannedProduct: null, printResult: null, printCopies: 1 })
        }
      }, 2000)
    } catch (err: any) {
      playErrorBeep()
      vibrateError()
      set({ isPrinting: false, errorMessage: err.message || 'Error al imprimir' })
      setTimeout(() => {
        if (get().step === 'print_label') set({ errorMessage: '' })
      }, 3000)
    }
  },

  clearScannedProduct: () => {
    set({ scannedProduct: null, printResult: null, printCopies: 1, errorMessage: '' })
  },
}))
