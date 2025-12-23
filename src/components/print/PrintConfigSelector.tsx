'use client'

import { useState, useEffect } from 'react'
import { Printer, Wifi, WifiOff, AlertTriangle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PrintConfiguration {
  id: number
  documentType: string
  copies: number
  autoPrint: boolean
  printServiceId: number
  serviceName: string
  serviceOnline: boolean
  printerId: number
  printerName: string
  printerType: string
  printerOnline: boolean
  scope: 'terminal' | 'warehouse' | 'company'
}

interface ResolvedConfig {
  found: boolean
  configuration?: PrintConfiguration
  canPrint: boolean
  warnings: string[]
}

interface PrintConfigSelectorProps {
  documentType: 'pos_receipt' | 'shipping_label' | 'product_label' | 'invoice'
  posTerminalId?: number
  warehouseId?: number
  onConfigResolved?: (config: PrintConfiguration | null) => void
  showStatus?: boolean
  className?: string
}

export function PrintConfigSelector({
  documentType,
  posTerminalId,
  warehouseId,
  onConfigResolved,
  showStatus = true,
  className
}: PrintConfigSelectorProps) {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ResolvedConfig | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          documentType,
          ...(posTerminalId && { posTerminalId: posTerminalId.toString() }),
          ...(warehouseId && { warehouseId: warehouseId.toString() })
        })

        const response = await fetch(`/api/print/configurations/resolve?${params}`)
        if (response.ok) {
          const data = await response.json()
          setConfig(data.data)
          onConfigResolved?.(data.data?.configuration || null)
        }
      } catch (error) {
        console.error('Error fetching print config:', error)
        setConfig({ found: false, canPrint: false, warnings: ['Error al cargar configuración'] })
        onConfigResolved?.(null)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [documentType, posTerminalId, warehouseId, onConfigResolved])

  if (!showStatus) return null

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
        <Printer className="w-4 h-4 animate-pulse" />
        <span>Verificando impresora...</span>
      </div>
    )
  }

  if (!config?.found) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500", className)}>
        <AlertTriangle className="w-4 h-4" />
        <span>No hay impresora configurada</span>
      </div>
    )
  }

  const { configuration, canPrint, warnings } = config

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex items-center gap-2 text-sm",
        canPrint ? "text-green-600 dark:text-green-500" : "text-yellow-600 dark:text-yellow-500"
      )}>
        {canPrint ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        <span className="truncate max-w-[200px]" title={configuration?.printerName}>
          {configuration?.printerName}
        </span>
        {configuration && configuration.scope !== 'company' && (
          <span className="text-xs text-gray-400 capitalize">
            ({configuration.scope})
          </span>
        )}
      </div>

      {warnings && warnings.length > 0 && (
        <div className="text-xs text-yellow-600 dark:text-yellow-500">
          {warnings.map((w, i) => (
            <span key={i} className="block">{w}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// Status indicator component
export function PrinterStatus({
  documentType,
  posTerminalId,
  warehouseId,
  compact = false
}: {
  documentType: 'pos_receipt' | 'shipping_label' | 'product_label' | 'invoice'
  posTerminalId?: number
  warehouseId?: number
  compact?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [canPrint, setCanPrint] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const params = new URLSearchParams({
          documentType,
          ...(posTerminalId && { posTerminalId: posTerminalId.toString() }),
          ...(warehouseId && { warehouseId: warehouseId.toString() })
        })

        const response = await fetch(`/api/print/configurations/resolve?${params}`)
        if (response.ok) {
          const data = await response.json()
          setCanPrint(data.data?.canPrint || false)
          setPrinterName(data.data?.configuration?.printerName || null)
        }
      } catch {
        setCanPrint(false)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [documentType, posTerminalId, warehouseId])

  if (loading) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1",
        compact ? "text-xs" : "text-sm"
      )}>
        <Printer className={cn("animate-pulse", compact ? "w-3 h-3" : "w-4 h-4")} />
      </span>
    )
  }

  if (compact) {
    return canPrint ? (
      <span title={printerName || 'Impresora disponible'}>
        <Wifi className="w-3 h-3 text-green-500" />
      </span>
    ) : (
      <span title="Sin impresora">
        <WifiOff className="w-3 h-3 text-gray-400" />
      </span>
    )
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
      canPrint
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    )}>
      {canPrint ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {printerName || (canPrint ? 'Disponible' : 'Sin impresora')}
    </div>
  )
}

export default PrintConfigSelector
