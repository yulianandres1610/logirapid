'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Search,
  Briefcase,
  Wifi,
  WifiOff,
  Check,
  X,
  AlertCircle,
  Loader2,
  ClipboardList,
  ChevronRight,
  Warehouse,
  Camera,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  Tag
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import CameraBarcodeScanner from '@/components/barcode-scanner/CameraBarcodeScanner'

type Theme = 'dark' | 'light'
type ScanStatus = 'found' | 'missing' | 'surplus'
type TabView = 'pending' | 'scanned'

const getThemeFromStorage = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  try {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

const themeStyles = {
  dark: {
    bg: 'bg-gray-900',
    bgAlt: 'bg-gray-800',
    bgCard: 'bg-gray-800',
    text: 'text-white',
    textMuted: 'text-gray-400',
    border: 'border-gray-700',
    input: 'bg-gray-700 border-gray-600',
    inputAlt: 'bg-gray-900 border-gray-700',
    button: 'bg-gray-700 hover:bg-gray-600',
  },
  light: {
    bg: 'bg-gray-100',
    bgAlt: 'bg-white',
    bgCard: 'bg-white',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    border: 'border-gray-300',
    input: 'bg-white border-gray-300',
    inputAlt: 'bg-gray-50 border-gray-300',
    button: 'bg-gray-200 hover:bg-gray-300',
  }
}

const getThemeClasses = (theme: Theme) => themeStyles[theme]

interface FixedAsset {
  id: number
  assetCode: string
  barcode: string | null
  name: string
  description: string | null
  status: string
  condition: string
  currentValue: number
  warehouseId: number
  warehouseName: string
  locationCode: string | null
  categoryId: number | null
  categoryName: string | null
  responsibleEmployeeId: number | null
  responsibleName: string
  lastAuditDate: string | null
  imageUrl: string | null
  brand: string | null
  model: string | null
}

interface ScannedAsset {
  assetId: number
  assetCode: string
  assetBarcode: string | null
  assetName: string
  categoryName: string | null
  responsibleName: string | null
  currentValue: number
  expectedWarehouseId: number
  foundWarehouseId?: number
  expectedCondition: string
  observedCondition?: string
  scanStatus: ScanStatus
  productImage?: string | null
}

interface WarehouseInfo {
  id: number
  name: string
}

export default function AuditCountAssetsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const warehouseId = searchParams.get('warehouseId')
  const isNewCount = searchParams.get('new') === 'true'
  const searchInputRef = useRef<HTMLInputElement>(null)

  // State
  const [isOnline, setIsOnline] = useState(true)
  const [theme, setTheme] = useState<Theme>('dark')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [warehouse, setWarehouse] = useState<WarehouseInfo | null>(null)
  const [countId, setCountId] = useState<number | null>(null)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [scannedAssets, setScannedAssets] = useState<ScannedAsset[]>([])

  const [search, setSearch] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null)
  const [activeTab, setActiveTab] = useState<TabView>('pending')
  const [showCameraScanner, setShowCameraScanner] = useState(false)

  // Auto-save refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')
  const isSavingRef = useRef(false)

  // LocalStorage key
  const getLocalStorageKey = () => `audit-assets-${warehouseId}`

  // Save to localStorage
  const saveToLocalStorage = useCallback((items: ScannedAsset[]) => {
    if (!warehouseId) return
    try {
      const key = getLocalStorageKey()
      const data = { countId, assets: items, savedAt: new Date().toISOString() }
      localStorage.setItem(key, JSON.stringify(data))
      console.log('[LocalStorage] Saved', items.length, 'assets')
    } catch (e) {
      console.error('[LocalStorage] Save error:', e)
    }
  }, [warehouseId, countId])

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): { countId: number | null, assets: ScannedAsset[] } | null => {
    if (!warehouseId) return null
    try {
      const key = getLocalStorageKey()
      const stored = localStorage.getItem(key)
      if (stored) {
        const data = JSON.parse(stored)
        return { countId: data.countId, assets: data.assets || [] }
      }
    } catch (e) {
      console.error('[LocalStorage] Load error:', e)
    }
    return null
  }, [warehouseId])

  // Clear localStorage
  const clearLocalStorage = useCallback(() => {
    if (!warehouseId) return
    try {
      localStorage.removeItem(getLocalStorageKey())
    } catch (e) {
      console.error('[LocalStorage] Clear error:', e)
    }
  }, [warehouseId])

  // Online status and theme
  useEffect(() => {
    setIsOnline(navigator.onLine)
    setTheme(getThemeFromStorage())

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load assets
  useEffect(() => {
    const loadData = async () => {
      if (!warehouseId) {
        setError('No se especificó un almacén')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load fixed assets for the warehouse
        const assetsRes = await fetch(`/api/audit/fixed-assets?warehouseId=${warehouseId}`)
        const assetsData = await assetsRes.json()

        if (!assetsData.success) {
          throw new Error(assetsData.error || 'Error al cargar activos fijos')
        }

        setWarehouse(assetsData.data.warehouse)
        setAssets(assetsData.data.assets)

        if (isNewCount) {
          clearLocalStorage()
          setCountId(null)
          setScannedAssets([])
          lastSavedRef.current = ''
        } else {
          // Load from localStorage or server
          const localData = loadFromLocalStorage()

          // Check for existing in-progress count on server
          const countRes = await fetch(`/api/audit/counts?warehouseId=${warehouseId}&status=in_progress&auditType=fixed_assets`)
          const countData = await countRes.json()

          if (localData && localData.assets.length > 0) {
            setCountId(localData.countId)
            setScannedAssets(localData.assets)
          } else if (countData.success && countData.data?.count) {
            // Load from server
            const existingCountId = countData.data.count.id
            const detailRes = await fetch(`/api/audit/counts?countId=${existingCountId}`)
            const detailData = await detailRes.json()

            if (detailData.success && detailData.data) {
              setCountId(detailData.data.id)
              const serverAssets: ScannedAsset[] = detailData.data.lines.map((l: ScannedAsset) => ({
                assetId: l.assetId,
                assetCode: l.assetCode,
                assetBarcode: l.assetBarcode,
                assetName: l.assetName,
                categoryName: l.categoryName,
                responsibleName: l.responsibleName,
                currentValue: l.currentValue,
                expectedWarehouseId: l.expectedWarehouseId,
                expectedCondition: l.expectedCondition,
                observedCondition: l.observedCondition,
                scanStatus: l.scanStatus,
                productImage: l.productImage
              }))
              setScannedAssets(serverAssets)
              saveToLocalStorage(serverAssets)
            }
          }
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [warehouseId, isNewCount, loadFromLocalStorage, saveToLocalStorage, clearLocalStorage])

  // Auto-save effect
  useEffect(() => {
    if (!warehouseId) return

    const currentState = JSON.stringify(scannedAssets)
    if (currentState === lastSavedRef.current) return
    if (scannedAssets.length === 0 && lastSavedRef.current === '') return

    saveToLocalStorage(scannedAssets)

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return

      try {
        isSavingRef.current = true
        const response = await fetch('/api/audit/counts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseId: parseInt(warehouseId),
            countId: countId,
            assetLines: scannedAssets,
            action: 'save',
            auditType: 'fixed_assets'
          })
        })

        const data = await response.json()
        if (data.success) {
          if (data.data.countId && !countId) {
            setCountId(data.data.countId)
          }
          lastSavedRef.current = currentState
          console.log('[AutoSave] Server save complete')
        }
      } catch (err) {
        console.error('[AutoSave] Server error:', err)
      } finally {
        isSavingRef.current = false
      }
    }, 1500)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [warehouseId, countId, scannedAssets, saveToLocalStorage])

  // Filter assets by search
  const filteredAssets = useMemo(() => {
    if (!search || search.length < 2) return []
    const searchLower = search.toLowerCase()
    return assets.filter(a =>
      a.name.toLowerCase().includes(searchLower) ||
      a.assetCode.toLowerCase().includes(searchLower) ||
      (a.barcode && a.barcode.toLowerCase().includes(searchLower))
    ).slice(0, 10)
  }, [assets, search])

  // Calculate progress
  const progress = useMemo(() => {
    const total = assets.length
    const scanned = scannedAssets.length
    const found = scannedAssets.filter(a => a.scanStatus === 'found').length
    const missing = scannedAssets.filter(a => a.scanStatus === 'missing').length
    const surplus = scannedAssets.filter(a => a.scanStatus === 'surplus').length
    const pending = total - scanned
    const percentage = total > 0 ? Math.round((scanned / total) * 100) : 0

    return { total, scanned, found, missing, surplus, pending, percentage }
  }, [assets, scannedAssets])

  // Pending assets (not yet scanned)
  const pendingAssets = useMemo(() => {
    const scannedIds = new Set(scannedAssets.map(a => a.assetId))
    return assets.filter(a => !scannedIds.has(a.id))
  }, [assets, scannedAssets])

  // Handle barcode scan
  const handleBarcodeScan = useCallback((barcode: string) => {
    const lowerBarcode = barcode.toLowerCase()
    const asset = assets.find(a =>
      a.barcode?.toLowerCase() === lowerBarcode ||
      a.assetCode.toLowerCase() === lowerBarcode
    )

    if (asset) {
      setSelectedAsset(asset)
      setSearch('')
    } else {
      setError(`Activo no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 3000)
    }
  }, [assets])

  // Barcode scanner hook
  useBarcodeScan({
    onScan: handleBarcodeScan,
    onError: (error) => console.warn('Barcode scan:', error),
    minLength: 3,
    maxTimeBetweenKeys: 100,
    enabled: !loading && !selectedAsset
  })

  // Mark asset as found or missing
  const markAsset = useCallback((asset: FixedAsset, status: ScanStatus) => {
    const existingIndex = scannedAssets.findIndex(a => a.assetId === asset.id)

    const scannedAsset: ScannedAsset = {
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetBarcode: asset.barcode,
      assetName: asset.name,
      categoryName: asset.categoryName,
      responsibleName: asset.responsibleName,
      currentValue: asset.currentValue,
      expectedWarehouseId: asset.warehouseId,
      expectedCondition: asset.condition,
      scanStatus: status,
      productImage: asset.imageUrl
    }

    if (existingIndex >= 0) {
      const updated = [...scannedAssets]
      updated[existingIndex] = scannedAsset
      setScannedAssets(updated)
    } else {
      setScannedAssets(prev => [scannedAsset, ...prev])
    }

    setSelectedAsset(null)
    setSearch('')
  }, [scannedAssets])

  // Remove scanned asset
  const removeScannedAsset = useCallback((assetId: number) => {
    setScannedAssets(prev => prev.filter(a => a.assetId !== assetId))
  }, [])

  // Save count
  const saveCount = useCallback(async () => {
    if (!warehouseId) return

    try {
      setSaving(true)
      saveToLocalStorage(scannedAssets)

      const response = await fetch('/api/audit/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: parseInt(warehouseId),
          countId: countId,
          assetLines: scannedAssets,
          action: 'save',
          auditType: 'fixed_assets'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      if (data.data.countId && !countId) {
        setCountId(data.data.countId)
      }
      lastSavedRef.current = JSON.stringify(scannedAssets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [warehouseId, countId, scannedAssets, saveToLocalStorage])

  // Go to report
  const goToReport = useCallback(async () => {
    if (!warehouseId || scannedAssets.length === 0) return

    try {
      setSaving(true)
      saveToLocalStorage(scannedAssets)

      const response = await fetch('/api/audit/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: parseInt(warehouseId),
          countId: countId,
          assetLines: scannedAssets,
          action: 'save',
          auditType: 'fixed_assets'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      const savedCountId = data.data.countId || countId
      clearLocalStorage()

      router.push(`/dashboard/audit/report?countId=${savedCountId}&auditType=fixed_assets`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [warehouseId, countId, scannedAssets, router, saveToLocalStorage, clearLocalStorage])

  // Go back
  const goBack = useCallback(() => {
    if (warehouseId && scannedAssets.length > 0) {
      saveToLocalStorage(scannedAssets)
    }
    router.push('/dashboard/audit')
  }, [router, warehouseId, scannedAssets, saveToLocalStorage])

  const tc = getThemeClasses(theme)

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tc.bg}`}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className={tc.textMuted}>Cargando activos fijos...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !warehouse) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tc.bg} ${tc.text} p-4`}>
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={goBack} className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium">
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen h-[100dvh] flex flex-col overflow-hidden ${tc.bg} ${tc.text}`}>
      <style jsx global>{`
        @supports (-webkit-touch-callout: none) {
          input, select, textarea { font-size: 16px !important; }
        }
        * { touch-action: manipulation; }
      `}</style>

      {/* Header */}
      <header className={`${tc.bgAlt} border-b ${tc.border} fixed top-0 left-0 right-0 z-40`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center h-[56px] sm:h-[64px] px-2 sm:px-4">
          <motion.button onClick={goBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-700/50" whileTap={{ scale: 0.95 }}>
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          <div className="flex items-center gap-1 px-2 min-w-0">
            <Warehouse className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span className="text-xs truncate max-w-[80px] text-gray-300">{warehouse?.name}</span>
          </div>

          <div className="flex-1 relative mx-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar activo..."
              className={`w-full pl-9 pr-2 py-2 ${tc.inputAlt} rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-600`}
              disabled={!!selectedAsset}
            />
          </div>

          <motion.button onClick={() => setShowCameraScanner(true)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-700/50" whileTap={{ scale: 0.95 }}>
            <Camera className="w-5 h-5 text-blue-500" />
          </motion.button>

          <div className="w-8 flex items-center justify-center">
            {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-yellow-500" />}
          </div>
        </div>

        {/* Search results */}
        {search && filteredAssets.length > 0 && !selectedAsset && (
          <div className="absolute left-0 right-0 top-full z-50 bg-gray-800 border-b border-gray-700 shadow-2xl max-h-[50vh] overflow-auto">
            {filteredAssets.map(asset => (
              <button
                key={asset.id}
                onClick={() => { setSelectedAsset(asset); setSearch('') }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 border-b border-gray-700/50 last:border-0"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
                  {asset.imageUrl ? (
                    <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <Briefcase className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{asset.name}</p>
                  <p className="text-xs text-gray-400 truncate">{asset.assetCode}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-700 flex items-center gap-2 mt-[56px]">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-shrink-0 h-[56px] sm:h-[64px]" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Selected asset panel */}
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border-b border-gray-700"
          >
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-700 flex items-center justify-center">
                  {selectedAsset.imageUrl ? (
                    <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-full h-full object-cover" />
                  ) : (
                    <Briefcase className="w-8 h-8 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{selectedAsset.name}</h3>
                      <p className="text-sm text-gray-400">{selectedAsset.assetCode}</p>
                    </div>
                    <button onClick={() => setSelectedAsset(null)} className="p-2 hover:bg-gray-700 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                    {selectedAsset.categoryName && (
                      <span className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
                        <Tag className="w-3 h-3" />
                        {selectedAsset.categoryName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
                      <User className="w-3 h-3" />
                      {selectedAsset.responsibleName}
                    </span>
                    {selectedAsset.locationCode && (
                      <span className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
                        <MapPin className="w-3 h-3" />
                        {selectedAsset.locationCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => markAsset(selectedAsset, 'found')}
                  className="flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold"
                  whileTap={{ scale: 0.98 }}
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>Encontrado</span>
                </motion.button>
                <motion.button
                  onClick={() => markAsset(selectedAsset, 'missing')}
                  className="flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold"
                  whileTap={{ scale: 0.98 }}
                >
                  <XCircle className="w-6 h-6" />
                  <span>Faltante</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        {!selectedAsset && (
          <div className="px-4 py-2 border-b border-gray-700">
            <div className="flex gap-2 p-1 bg-gray-800 rounded-xl">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'pending' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Pendientes ({progress.pending})
              </button>
              <button
                onClick={() => setActiveTab('scanned')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeTab === 'scanned' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Escaneados ({progress.scanned})
              </button>
            </div>
          </div>
        )}

        {/* Asset list */}
        {!selectedAsset && (
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'pending' ? (
              pendingAssets.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-green-400 font-medium">Todos los activos escaneados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingAssets.map(asset => (
                    <motion.button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-3 flex items-center gap-3 text-left"
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
                        {asset.imageUrl ? (
                          <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
                        ) : (
                          <Briefcase className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{asset.name}</p>
                        <p className="text-xs text-gray-400 truncate">{asset.assetCode}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </motion.button>
                  ))}
                </div>
              )
            ) : (
              scannedAssets.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-500 opacity-50" />
                  <p className="text-gray-400">No hay activos escaneados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {scannedAssets.map(asset => (
                      <motion.div
                        key={asset.assetId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`bg-gray-800 rounded-xl p-3 flex items-center gap-3 border-l-4 ${
                          asset.scanStatus === 'found' ? 'border-green-500' : 'border-red-500'
                        }`}
                      >
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
                          {asset.productImage ? (
                            <img src={asset.productImage} alt={asset.assetName} className="w-full h-full object-cover" />
                          ) : (
                            <Briefcase className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{asset.assetName}</p>
                          <p className="text-xs text-gray-400 truncate">{asset.assetCode}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          asset.scanStatus === 'found' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {asset.scanStatus === 'found' ? 'Encontrado' : 'Faltante'}
                        </div>
                        <button onClick={() => removeScannedAsset(asset.assetId)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-gray-800 border-t border-gray-700" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Progress */}
        <div className="px-4 pt-3 pb-2">
          <div className="h-6 bg-gray-700 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {progress.percentage}% ({progress.pending} pendientes)
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="font-bold">{progress.found}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="font-bold">{progress.missing}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveCount}
              disabled={saving || scannedAssets.length === 0}
              className="px-4 py-2.5 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="hidden sm:inline">Guardar</span>
            </button>

            <button
              onClick={goToReport}
              disabled={saving || scannedAssets.length === 0}
              className="px-4 py-2.5 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
            >
              <span>Reporte</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Camera Scanner */}
      <CameraBarcodeScanner
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleBarcodeScan}
        onError={(error) => {
          setError(error)
          setTimeout(() => setError(null), 3000)
        }}
      />
    </div>
  )
}
