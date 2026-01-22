'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTheme } from '@/contexts/theme-context'
import { X, Smartphone, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhoneUploadModalProps {
  isOpen: boolean
  onClose: () => void
  purpose: 'purchase_invoice' | 'expense_receipt'
  referenceType?: 'purchase' | 'expense' | 'consignment'
  referenceId?: number
  onUploadComplete: (fileUrl: string, fileName: string) => void
}

type TokenStatus = 'creating' | 'ready' | 'uploaded' | 'expired' | 'error'

export function PhoneUploadModal({
  isOpen,
  onClose,
  purpose,
  referenceType,
  referenceId,
  onUploadComplete
}: PhoneUploadModalProps) {
  const { theme } = useTheme()
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<TokenStatus>('creating')
  const [error, setError] = useState<string | null>(null)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const createToken = useCallback(async () => {
    setStatus('creating')
    setError(null)
    setToken(null)

    try {
      const res = await fetch('/api/upload-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, referenceType, referenceId })
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Error al crear token')
        setStatus('error')
        return
      }

      setToken(data.data.token)
      setUploadUrl(`${window.location.origin}/upload/${data.data.token}`)
      setStatus('ready')
    } catch {
      setError('Error de conexion')
      setStatus('error')
    }
  }, [purpose, referenceType, referenceId])

  // Create token when modal opens
  useEffect(() => {
    mountedRef.current = true
    if (isOpen) {
      createToken()
    }
    return () => {
      mountedRef.current = false
    }
  }, [isOpen, createToken])

  // Poll for upload status
  useEffect(() => {
    if (status !== 'ready' || !token) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/upload-tokens/status?token=${token}`)
        const data = await res.json()

        if (!mountedRef.current) return

        if (data.success) {
          if (data.data.status === 'uploaded') {
            setStatus('uploaded')
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            onUploadComplete(data.data.fileUrl, data.data.fileName)
            // Auto-close after 2 seconds
            setTimeout(() => {
              if (mountedRef.current) onClose()
            }, 2000)
          } else if (data.data.expired) {
            setStatus('expired')
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }
      } catch {
        // Ignore polling errors silently
      }
    }

    pollingRef.current = setInterval(poll, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [status, token, onUploadComplete, onClose])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        'relative w-full max-w-md rounded-2xl shadow-2xl p-6',
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 p-2 rounded-full',
            theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3',
            theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
          )}>
            <Smartphone className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className={cn(
            'text-lg font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Subir con Telefono
          </h2>
          <p className={cn(
            'text-sm mt-1',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            Escanea el codigo QR con tu telefono para subir una foto
          </p>
        </div>

        {/* Content based on status */}
        <div className="flex flex-col items-center">
          {status === 'creating' && (
            <div className="py-8">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className={cn(
                'mt-4 text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Generando codigo...
              </p>
            </div>
          )}

          {status === 'ready' && uploadUrl && (
            <>
              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl mb-4">
                <QRCodeSVG
                  value={uploadUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Waiting indicator */}
              <div className={cn(
                'flex items-center gap-2 text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Esperando que subas el archivo...</span>
              </div>

              {/* Timer info */}
              <p className={cn(
                'text-xs mt-3',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                El codigo expira en 15 minutos
              </p>
            </>
          )}

          {status === 'uploaded' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Archivo subido exitosamente
              </p>
            </div>
          )}

          {status === 'expired' && (
            <div className="py-8 text-center">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-100'
              )}>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
              <p className={cn(
                'font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Codigo expirado
              </p>
              <button
                onClick={createToken}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" />
                Generar nuevo codigo
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8 text-center">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className={cn(
                'font-semibold mb-1',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Error
              </p>
              <p className={cn(
                'text-sm mb-4',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {error}
              </p>
              <button
                onClick={createToken}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
