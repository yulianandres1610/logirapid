'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  RotateCcw,
  FileCheck,
  Printer,
  X,
  Calendar,
  Warehouse,
  Hash,
  DollarSign,
  ArrowRight
} from 'lucide-react'

interface CountLine {
  productId: number
  variantId?: number
  productName: string
  productSku: string
  productBarcode: string
  productImage?: string
  costPrice: number
  sellingPrice: number
  systemQuantity: number
  countedQuantity: number
  difference: number
  differenceValueCost: number
  differenceValueSale: number
}

interface CountData {
  id: number
  countNumber: string
  status: string
  warehouseId: number
  warehouseName: string
  totalProducts: number
  productsWithDifferences: number
  totalShortageValue: number
  totalExcessValue: number
  totalStockAtCost: number
  totalStockAtSale: number
  startedAt?: string
  completedAt?: string
  lines: CountLine[]
}

export default function AuditReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const countId = searchParams.get('countId')
  const printRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [countData, setCountData] = useState<CountData | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printServices, setPrintServices] = useState<Array<{ id: number; serviceName: string; printers: Array<{ id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string; supportedDocumentTypes?: string[] }> }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!countId) {
        setError('No se especifico un conteo')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const countRes = await fetch(`/api/audit/counts?countId=${countId}`)
        const countResult = await countRes.json()

        if (!countResult.success) {
          throw new Error(countResult.error || 'Error al cargar conteo')
        }

        if (!countResult.data) {
          throw new Error('No se encontro el conteo')
        }

        setCountData(countResult.data)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [countId])

  const goBackToCount = useCallback(() => {
    if (countData) {
      router.push(`/dashboard/audit/count?warehouseId=${countData.warehouseId}`)
    } else {
      router.push('/dashboard/audit')
    }
  }, [router, countData])

  const goToDashboard = useCallback(() => {
    router.push('/dashboard/audit')
  }, [router])

  // Complete count
  const completeCount = useCallback(async () => {
    if (!countData) return

    try {
      setCompleting(true)

      const response = await fetch('/api/audit/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: countData.warehouseId,
          countId: countData.id,
          lines: countData.lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            productSku: l.productSku,
            productBarcode: l.productBarcode,
            productImage: l.productImage,
            costPrice: l.costPrice,
            sellingPrice: l.sellingPrice,
            systemQuantity: l.systemQuantity,
            countedQuantity: l.countedQuantity
          })),
          action: 'complete'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Go back to dashboard
      router.push('/dashboard/audit')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar conteo')
      setCompleting(false)
    }
  }, [countData, router])

  // Fetch print services
  const fetchPrintServices = async () => {
    try {
      const response = await fetch('/api/print/services')
      const data = await response.json()

      if (data.success && data.data?.services) {
        const allServices = data.data.services

        // Filter to active/pending/offline services with printers
        const activeServices = allServices.filter(
          (s: { status: string; printers?: unknown[] }) =>
            (s.status === 'active' || s.status === 'pending' || s.status === 'offline') &&
            s.printers && s.printers.length > 0
        )

        // Filter printers that support audit_count_report or thermal printers
        const supportsAuditReport = (p: { printerType: string; supportedDocumentTypes?: string[] }) => {
          if (p.supportedDocumentTypes && p.supportedDocumentTypes.length > 0) {
            return p.supportedDocumentTypes.includes('audit_count_report') ||
                   p.supportedDocumentTypes.includes('inventory_count_report') ||
                   p.supportedDocumentTypes.includes('pos_receipt')
          }
          const thermalTypes = ['thermal_80mm', 'thermal_58mm', 'pos', 'receipt', 'thermal']
          return thermalTypes.includes((p.printerType || '').toLowerCase())
        }

        const servicesWithValidPrinters = activeServices.map((service: { id: number; serviceName: string; printers: Array<{ id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string; supportedDocumentTypes?: string[] }> }) => ({
          ...service,
          printers: service.printers.filter(supportsAuditReport)
        })).filter((s: { printers: unknown[] }) => s.printers.length > 0)

        setPrintServices(servicesWithValidPrinters)

        // Auto-select first printer
        if (servicesWithValidPrinters.length > 0 && servicesWithValidPrinters[0].printers.length > 0) {
          const firstPrinter = servicesWithValidPrinters[0].printers.find((p: { isOnline: boolean }) => p.isOnline) || servicesWithValidPrinters[0].printers[0]
          setSelectedPrinter({ serviceId: servicesWithValidPrinters[0].id, printerId: firstPrinter.id })
        }
      }
    } catch (err) {
      console.error('[AuditReport] Error fetching print services:', err)
    }
  }

  // Print with service
  const printWithService = async () => {
    if (!countData || !selectedPrinter) return

    setPrintingWithService(true)
    try {
      const response = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'audit_count_report',
          documentData: {
            countNumber: countData.countNumber,
            countId: countData.id,
            warehouseName: countData.warehouseName,
            totalProducts: countData.totalProducts,
            productsWithDifferences: countData.productsWithDifferences,
            totalShortageValue: countData.totalShortageValue,
            totalExcessValue: countData.totalExcessValue,
            totalStockAtCost: countData.totalStockAtCost,
            totalStockAtSale: countData.totalStockAtSale,
            startedAt: countData.startedAt,
            status: countData.status,
            lines: linesWithDifferences.map(l => ({
              productName: l.productName,
              productSku: l.productSku,
              systemQuantity: l.systemQuantity,
              countedQuantity: l.countedQuantity,
              difference: l.difference,
              differenceValueCost: l.differenceValueCost,
              differenceValueSale: l.differenceValueSale
            }))
          },
          copies,
          printServiceId: selectedPrinter.serviceId,
          printerId: selectedPrinter.printerId,
          sourceType: 'audit_count',
          sourceId: countData.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Error printing with service:', err)
      printBrowser()
      setShowPrintModal(false)
    } finally {
      setPrintingWithService(false)
    }
  }

  // Browser print fallback
  const printBrowser = useCallback(() => {
    setTimeout(() => {
      window.print()
    }, 300)
  }, [])

  // Handle print click
  const handlePrint = useCallback(() => {
    fetchPrintServices()
    setShowPrintModal(true)
  }, [])

  // Filter lines with differences only
  const linesWithDifferences = countData?.lines.filter(l => l.difference !== 0) || []

  // Calculate totals
  const totals = countData ? {
    totalProducts: countData.totalProducts,
    productsWithDifferences: linesWithDifferences.length,
    productsWithExcess: linesWithDifferences.filter(l => l.difference < 0).length, // Negative difference = excess (counted more)
    productsWithShortage: linesWithDifferences.filter(l => l.difference > 0).length, // Positive difference = shortage (counted less)
    totalShortageValueCost: linesWithDifferences.filter(l => l.difference > 0).reduce((sum, l) => sum + l.differenceValueCost, 0),
    totalShortageValueSale: linesWithDifferences.filter(l => l.difference > 0).reduce((sum, l) => sum + l.differenceValueSale, 0),
    totalExcessValueCost: linesWithDifferences.filter(l => l.difference < 0).reduce((sum, l) => sum + Math.abs(l.differenceValueCost), 0),
    totalExcessValueSale: linesWithDifferences.filter(l => l.difference < 0).reduce((sum, l) => sum + Math.abs(l.differenceValueSale), 0),
    totalStockAtCost: countData.totalStockAtCost,
    totalStockAtSale: countData.totalStockAtSale
  } : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  if (error || !countData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error || 'No hay datos de conteo'}</p>
          <button
            onClick={goToDashboard}
            className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-500 font-medium"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background: #f5f5f5;
          }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 no-print sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 lg:max-w-7xl lg:mx-auto w-full">
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <motion.button
                onClick={goBackToCount}
                className="p-2 lg:p-2.5 hover:bg-gray-700 rounded-xl transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
              </motion.button>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm sm:text-base lg:text-xl truncate">Reporte de Conteo</h1>
                <p className="text-xs lg:text-sm text-gray-400 truncate">{countData.countNumber}</p>
              </div>
            </div>
            <motion.button
              onClick={handlePrint}
              className="p-2.5 lg:px-4 lg:py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors flex items-center gap-2"
              whileTap={{ scale: 0.95 }}
            >
              <Printer className="w-5 h-5" />
              <span className="hidden sm:inline text-sm lg:text-base font-medium">Imprimir</span>
            </motion.button>
          </div>
        </header>

        {/* Info Bar */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-800/50 border-b border-gray-700/50 no-print">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-6 text-xs sm:text-sm lg:text-base text-gray-400 lg:max-w-7xl lg:mx-auto">
            <span className="flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              {countData.warehouseName}
            </span>
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              {countData.countNumber}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              {countData.startedAt ? new Date(countData.startedAt).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES')}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-4 py-3 lg:p-6 no-print">
          <div className="lg:max-w-7xl lg:mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-gray-400 mb-1 lg:mb-2">
                  <Package className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm">Contados</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{totals?.totalProducts}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 }}
                className="bg-gray-800 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-gray-400 mb-1 lg:mb-2">
                  <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm">Diferencias</span>
                </div>
                <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${totals?.productsWithDifferences ? 'text-amber-400' : 'text-green-400'}`}>
                  {totals?.productsWithDifferences}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-green-400 mb-1 lg:mb-2">
                  <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm">Sobrantes</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-400">{totals?.productsWithExcess || 0}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="bg-gray-800 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-red-400 mb-1 lg:mb-2">
                  <TrendingDown className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm">Faltantes</span>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-400">{totals?.productsWithShortage || 0}</p>
              </motion.div>
            </div>

            {/* Valuation Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mt-3 lg:mt-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-700/30 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-amber-400 mb-2 lg:mb-3">
                  <DollarSign className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-medium">Valoracion a Costo</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:gap-4 text-sm lg:text-base">
                  <div>
                    <p className="text-gray-500 text-xs lg:text-sm">Stock Contado</p>
                    <p className="font-bold text-white text-base lg:text-lg">${(totals?.totalStockAtCost || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs lg:text-sm">Faltantes</p>
                    <p className="font-bold text-red-400 text-base lg:text-lg">-${(totals?.totalShortageValueCost || 0).toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="bg-gradient-to-r from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-3 sm:p-4 lg:p-5"
              >
                <div className="flex items-center gap-2 text-blue-400 mb-2 lg:mb-3">
                  <DollarSign className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-medium">Valoracion a Venta</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:gap-4 text-sm lg:text-base">
                  <div>
                    <p className="text-gray-500 text-xs lg:text-sm">Stock Contado</p>
                    <p className="font-bold text-white text-base lg:text-lg">${(totals?.totalStockAtSale || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs lg:text-sm">Faltantes</p>
                    <p className="font-bold text-red-400 text-base lg:text-lg">-${(totals?.totalShortageValueSale || 0).toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Section Header - Only Differences */}
        {linesWithDifferences.length > 0 && (
          <div className="px-4 lg:px-6 py-2 lg:py-3 border-y border-gray-700/50 bg-gray-800/30 no-print">
            <div className="flex items-center gap-2 text-amber-400 lg:max-w-7xl lg:mx-auto">
              <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="text-sm lg:text-base font-medium">Productos con Diferencias ({linesWithDifferences.length})</span>
            </div>
          </div>
        )}

        {/* Products List - Only with differences */}
        <div className="flex-1 overflow-auto px-4 lg:px-6 pb-[100px] sm:pb-[80px]">
          <div className="max-w-7xl mx-auto">
            {linesWithDifferences.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 lg:p-8 text-center mt-4"
              >
                <CheckCircle2 className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-3 text-green-400" />
                <p className="font-semibold text-green-300 text-lg lg:text-xl">Conteo sin diferencias!</p>
                <p className="text-sm lg:text-base text-green-200/70 mt-1">Todos los productos coinciden con el sistema.</p>
              </motion.div>
            ) : (
              <>
                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-2 mt-2">
                {linesWithDifferences.map((line, index) => {
                  const isExcess = line.difference < 0
                  const isShortage = line.difference > 0

                  return (
                    <motion.div
                      key={`${line.productId}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`bg-gray-800 rounded-xl p-3 ${
                        isExcess ? 'ring-1 ring-green-500/30' : 'ring-1 ring-red-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{line.productName}</p>
                          <p className="text-xs text-gray-500">{line.productSku || line.productBarcode}</p>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold ${
                          isExcess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isExcess && <TrendingUp className="w-3.5 h-3.5" />}
                          {isShortage && <TrendingDown className="w-3.5 h-3.5" />}
                          {line.difference > 0 ? '-' : '+'}{Math.abs(line.difference)}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-gray-700/50 rounded-lg py-1.5 px-1">
                          <p className="text-[10px] text-gray-500 uppercase">Sistema</p>
                          <p className="font-mono font-medium text-sm">{line.systemQuantity}</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg py-1.5 px-1">
                          <p className="text-[10px] text-gray-500 uppercase">Contado</p>
                          <p className="font-mono font-bold text-sm text-amber-400">{line.countedQuantity}</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg py-1.5 px-1">
                          <p className="text-[10px] text-gray-500 uppercase">$ Costo</p>
                          <p className={`font-mono font-medium text-xs ${
                            isExcess ? 'text-green-400' : 'text-red-400'
                          }`}>
                            ${Math.abs(line.differenceValueCost).toFixed(0)}
                          </p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg py-1.5 px-1">
                          <p className="text-[10px] text-gray-500 uppercase">$ Venta</p>
                          <p className={`font-mono font-medium text-xs ${
                            isExcess ? 'text-green-400' : 'text-red-400'
                          }`}>
                            ${Math.abs(line.differenceValueSale).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden lg:block bg-gray-800 rounded-xl overflow-hidden mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Producto</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sistema</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contado</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Dif.</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-amber-400 uppercase tracking-wider">$ Costo</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">$ Venta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {linesWithDifferences.map((line, index) => {
                        const isExcess = line.difference < 0
                        const isShortage = line.difference > 0

                        return (
                          <tr
                            key={`${line.productId}-${index}`}
                            className={`transition-colors ${
                              isExcess ? 'bg-green-900/10 hover:bg-green-900/20' : 'bg-red-900/10 hover:bg-red-900/20'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{line.productName}</p>
                              <p className="text-xs text-gray-500">{line.productSku || line.productBarcode}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-300">{line.systemQuantity}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{line.countedQuantity}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center gap-1 font-mono font-bold ${
                                isExcess ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {isExcess && <TrendingUp className="w-3.5 h-3.5" />}
                                {isShortage && <TrendingDown className="w-3.5 h-3.5" />}
                                {line.difference > 0 ? '-' : '+'}{Math.abs(line.difference)}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${
                              isExcess ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${Math.abs(line.differenceValueCost).toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${
                              isExcess ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${Math.abs(line.differenceValueSale).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-700/50">
                      <tr className="font-bold">
                        <td className="px-4 py-3">TOTALES DIFERENCIAS</td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right font-mono text-red-400">
                          -${(totals?.totalShortageValueCost || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-red-400">
                          -${(totals?.totalShortageValueSale || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mobile Totals Summary */}
              <div className="lg:hidden mt-3 bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-500 text-center mb-2">TOTAL DIFERENCIAS</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-amber-400">A Precio Costo</p>
                    <p className="text-lg font-bold font-mono text-red-400">-${(totals?.totalShortageValueCost || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-400">A Precio Venta</p>
                    <p className="text-lg font-bold font-mono text-red-400">-${(totals?.totalShortageValueSale || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Footer - Fixed at bottom, edge-to-edge on mobile */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-gray-800 border-t border-gray-700 no-print pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:max-w-7xl lg:mx-auto">
            <button
              onClick={goBackToCount}
              disabled={completing}
              className="flex-1 sm:flex-initial px-4 lg:px-5 py-2.5 sm:py-3 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              Volver a Contar
            </button>

            {countData.status === 'in_progress' ? (
              <button
                onClick={completeCount}
                disabled={completing}
                className="flex-[2] sm:flex-initial px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base lg:text-lg shadow-lg shadow-amber-500/25"
              >
                {completing ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span>Completar Conteo</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button
                onClick={goToDashboard}
                className="flex-[2] sm:flex-initial px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 flex items-center justify-center gap-2 text-sm sm:text-base lg:text-lg shadow-lg shadow-green-500/25"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Conteo Completado</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Print Content - Hidden on screen, visible on print */}
      <div id="print-content" className="hidden print:block" ref={printRef}>
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>Reporte de Auditoria de Inventario</h1>
            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>{countData.countNumber}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
            <div>
              <p><strong>Almacen:</strong> {countData.warehouseName}</p>
              <p><strong>Estado:</strong> {countData.status === 'completed' ? 'Completado' : 'En Progreso'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Fecha:</strong> {countData.startedAt ? new Date(countData.startedAt).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES')}</p>
              <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-ES')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, padding: '10px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Productos</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals?.totalProducts}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Diferencias</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#856404' }}>{totals?.productsWithDifferences}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#d4edda', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Sobrantes</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>{totals?.productsWithExcess}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#f8d7da', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Faltantes</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>{totals?.productsWithShortage}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, padding: '10px', background: '#fef3cd', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Valoracion a Costo</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Stock: <strong>${(totals?.totalStockAtCost || 0).toFixed(2)}</strong></span>
                <span style={{ color: '#721c24' }}>Faltantes: <strong>-${(totals?.totalShortageValueCost || 0).toFixed(2)}</strong></span>
              </div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#cce5ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Valoracion a Venta</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Stock: <strong>${(totals?.totalStockAtSale || 0).toFixed(2)}</strong></span>
                <span style={{ color: '#721c24' }}>Faltantes: <strong>-${(totals?.totalShortageValueSale || 0).toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {linesWithDifferences.length > 0 && (
            <>
              <h3 style={{ fontSize: '14px', marginBottom: '10px', color: '#856404' }}>Productos con Diferencias</h3>
              <table className="print-table" style={{ fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Sistema</th>
                    <th style={{ textAlign: 'right' }}>Contado</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                    <th style={{ textAlign: 'right' }}>$ Costo</th>
                    <th style={{ textAlign: 'right' }}>$ Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {linesWithDifferences.map((line, index) => (
                    <tr key={index} style={{ background: line.difference > 0 ? '#f8d7da' : '#d4edda' }}>
                      <td>
                        <div>{line.productName}</div>
                        <div style={{ fontSize: '10px', color: '#666' }}>{line.productSku || line.productBarcode}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{line.systemQuantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{line.countedQuantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: line.difference > 0 ? '#721c24' : '#155724' }}>
                        {line.difference > 0 ? '-' : '+'}{Math.abs(line.difference)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: line.difference > 0 ? '#721c24' : '#155724' }}>
                        ${Math.abs(line.differenceValueCost).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: line.difference > 0 ? '#721c24' : '#155724' }}>
                        ${Math.abs(line.differenceValueSale).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 'bold', background: '#e9ecef' }}>
                    <td colSpan={4}>TOTALES FALTANTES</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#721c24' }}>
                      -${(totals?.totalShortageValueCost || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#721c24' }}>
                      -${(totals?.totalShortageValueSale || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '45%' }}>
              <p style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px', fontSize: '12px' }}>Firma del Auditor</p>
            </div>
            <div style={{ width: '45%' }}>
              <p style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px', fontSize: '12px' }}>Firma del Supervisor</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPrintModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-gray-800"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-900/30">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Imprimir Reporte de Auditoria</h3>
                    <p className="text-xs text-gray-400">{countData.countNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {printServices.length === 0 ? (
                  <div className="text-center py-4">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
                    <p className="text-gray-300 font-medium">No hay servicios de impresion disponibles</p>
                    <p className="text-sm text-gray-500 mt-1">Se usara la impresion del navegador</p>
                  </div>
                ) : (
                  <>
                    {/* Printer Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Seleccionar Impresora
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {printServices.map(service => (
                          service.printers.map(printer => (
                            <button
                              key={`${service.id}-${printer.id}`}
                              onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                                selectedPrinter?.printerId === printer.id
                                  ? 'border-amber-500 bg-amber-900/20'
                                  : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Printer className={`w-5 h-5 ${selectedPrinter?.printerId === printer.id ? 'text-amber-400' : 'text-gray-400'}`} />
                                <div>
                                  <p className={`font-medium ${selectedPrinter?.printerId === printer.id ? 'text-amber-400' : 'text-white'}`}>
                                    {printer.printerName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {printer.printerType === 'thermal_80mm' ? 'Termica 80mm' :
                                     printer.printerType === 'label_4x6' ? 'Etiquetas 4x6' :
                                     'Estandar'}
                                    {printer.isDefault && ' • Predeterminada'}
                                  </p>
                                </div>
                              </div>
                              <div className={`flex items-center gap-1 ${printer.isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                                <div className={`w-2 h-2 rounded-full ${printer.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                                <span className="text-xs">{printer.isOnline ? 'Online' : 'Offline'}</span>
                              </div>
                            </button>
                          ))
                        ))}
                      </div>
                    </div>

                    {/* Copies Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Cantidad de copias
                      </label>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => setCopies(Math.max(1, copies - 1))}
                          className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white"
                        >
                          <span className="text-xl font-bold">-</span>
                        </button>
                        <div className="w-20 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-gray-700 text-white">
                          {copies}
                        </div>
                        <button
                          onClick={() => setCopies(Math.min(10, copies + 1))}
                          className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white"
                        >
                          <span className="text-xl font-bold">+</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex gap-3">
                <button
                  onClick={() => {
                    setShowPrintModal(false)
                    printBrowser()
                  }}
                  className="flex-1 py-3 rounded-xl font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Imprimir (Navegador)
                </button>
                {printServices.length > 0 && selectedPrinter && (
                  <button
                    onClick={printWithService}
                    disabled={printingWithService}
                    className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 disabled:opacity-50"
                  >
                    {printingWithService ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Printer className="w-5 h-5" />
                    )}
                    {printingWithService ? 'Enviando...' : `Imprimir ${copies > 1 ? `(${copies})` : ''}`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
