'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Loader2, Flashlight, FlashlightOff } from 'lucide-react'
import { motion } from 'framer-motion'

interface CameraBarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  onError?: (error: string) => void
}

export default function CameraBarcodeScanner({
  isOpen,
  onClose,
  onScan,
  onError
}: CameraBarcodeScannerProps) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)
  const mountedRef = useRef(true)

  // Cleanup scanner
  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        console.warn('Cleanup error:', err)
      }
      scannerRef.current = null
    }
  }, [])

  // Start scanner
  const startScanner = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      setIsInitializing(true)
      setError(null)

      // Cleanup previous instance
      await cleanupScanner()

      // Wait for DOM
      await new Promise(resolve => setTimeout(resolve, 100))

      const container = document.getElementById('qr-reader')
      if (!container || !mountedRef.current) return

      // Create scanner instance
      const scanner = new Html5Qrcode('qr-reader', {
        verbose: false
      })
      scannerRef.current = scanner

      // Start with back camera using facingMode
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.777778,
          disableFlip: false
        },
        (decodedText) => {
          // Debounce
          const now = Date.now()
          if (
            decodedText === lastScannedRef.current &&
            now - lastScannedTimeRef.current < 2000
          ) {
            return
          }

          lastScannedRef.current = decodedText
          lastScannedTimeRef.current = now

          // Vibrate
          if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50])
          }

          onScan(decodedText)
          onClose()
        },
        () => {
          // Ignore scan errors - they happen continuously when no code is found
        }
      )

      // Check torch support
      try {
        const capabilities = scanner.getRunningTrackCameraCapabilities()
        const torch = capabilities.torchFeature()
        setHasTorch(torch.isSupported())
      } catch {
        setHasTorch(false)
      }

      if (mountedRef.current) {
        setIsInitializing(false)
      }
    } catch (err) {
      console.error('Scanner error:', err)
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Error al iniciar cámara'
        setError(message)
        onError?.(message)
        setIsInitializing(false)
      }
    }
  }, [cleanupScanner, onClose, onError, onScan])

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !hasTorch) return

    try {
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities()
      const torch = capabilities.torchFeature()
      if (torch.isSupported()) {
        const newState = !torchEnabled
        await torch.apply(newState)
        setTorchEnabled(newState)
      }
    } catch (err) {
      console.warn('Torch error:', err)
    }
  }, [hasTorch, torchEnabled])

  // Handle open/close
  useEffect(() => {
    mountedRef.current = true

    if (isOpen) {
      startScanner()
    }

    return () => {
      mountedRef.current = false
      cleanupScanner()
    }
  }, [isOpen, startScanner, cleanupScanner])

  // Handle close
  const handleClose = useCallback(async () => {
    await cleanupScanner()
    onClose()
  }, [cleanupScanner, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Scanner styles to override library defaults */}
      <style jsx global>{`
        #qr-reader {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          background: black !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
        #qr-reader__scan_region {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        #qr-reader__scan_region video {
          max-width: none !important;
          max-height: none !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
        #qr-shaded-region {
          border-width: 60px 40px !important;
          border-color: rgba(0,0,0,0.6) !important;
        }
        #qr-reader__scan_region > img {
          display: none !important;
        }
      `}</style>

      {/* Scanner container - full screen */}
      <div id="qr-reader" className="absolute inset-0" />

      {/* Custom overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-12 pointer-events-auto z-10">
          <motion.button
            onClick={handleClose}
            className="w-12 h-12 flex items-center justify-center bg-black/60 backdrop-blur rounded-full text-white active:bg-black/80"
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-6 h-6" />
          </motion.button>

          {hasTorch && (
            <motion.button
              onClick={toggleTorch}
              className={`w-12 h-12 flex items-center justify-center backdrop-blur rounded-full text-white ${
                torchEnabled ? 'bg-amber-500' : 'bg-black/60 active:bg-black/80'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              {torchEnabled ? (
                <Flashlight className="w-6 h-6" />
              ) : (
                <FlashlightOff className="w-6 h-6" />
              )}
            </motion.button>
          )}
        </div>

        {/* Scan area indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-32">
            {/* Corner brackets */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />

            {/* Scanning line */}
            <motion.div
              className="absolute left-2 right-2 h-0.5 bg-amber-500 shadow-lg shadow-amber-500/50"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 pb-16 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-center px-4">
            {isInitializing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-white text-base">Iniciando cámara...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => startScanner()}
                  className="px-6 py-3 bg-amber-500 text-white rounded-xl text-base font-medium pointer-events-auto active:bg-amber-600"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-white text-lg font-medium">Apunta al código de barras</p>
                <p className="text-white/60 text-sm">Mantén el código dentro del recuadro</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
