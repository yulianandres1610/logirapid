'use client'

import { useState, useEffect, useCallback } from 'react'

interface PrintServiceOption {
  id: number
  name: string
  online: boolean
  printerName: string | null
  printerType: string | null
  warehouseId: number | null
  posTerminalId: number | null
  agentPrinters: string[]
}

interface UsePrintServiceReturn {
  services: PrintServiceOption[]
  selectedServiceId: number | null
  setSelectedServiceId: (id: number | null) => void
  hasMultipleServices: boolean
  loading: boolean
  /** Fetch available services for a document type */
  fetchServices: (documentType: string) => Promise<void>
}

/**
 * Hook to fetch and manage print service selection.
 * Use this whenever you need to let users choose which printer/service to use.
 *
 * Usage:
 *   const { services, selectedServiceId, hasMultipleServices, fetchServices } = usePrintService()
 *
 *   useEffect(() => { fetchServices('purchase_invoice') }, [])
 *
 *   // In your fetch body:
 *   body: JSON.stringify({ ...data, serviceId: selectedServiceId })
 */
export function usePrintService(): UsePrintServiceReturn {
  const [services, setServices] = useState<PrintServiceOption[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchServices = useCallback(async (documentType: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/print-services/available?documentType=${documentType}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success && data.data) {
        setServices(data.data)
        // Auto-select first online, or first available
        const online = data.data.filter((s: PrintServiceOption) => s.online)
        if (online.length === 1) {
          setSelectedServiceId(online[0].id)
        } else if (data.data.length === 1) {
          setSelectedServiceId(data.data[0].id)
        }
      }
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    services,
    selectedServiceId,
    setSelectedServiceId,
    hasMultipleServices: services.length > 1,
    loading,
    fetchServices,
  }
}
