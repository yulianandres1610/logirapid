'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { X, Camera, Flashlight, FlashlightOff, SwitchCamera, Loader2, QrCode, Barcode } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScannedRef = useRef<string>('')
  const lastScannedTimeRef = useRef<number>(0)

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices && devices.length > 0) {
        setCameras(devices)
        // Prefer back camera
        const backCameraIndex = devices.findIndex(
          d => d.label.toLowerCase().includes('back') ||
               d.label.toLowerCase().includes('trasera') ||
               d.label.toLowerCase().includes('environment')
        )
        setCurrentCameraIndex(backCameraIndex >= 0 ? backCameraIndex : 0)
        return devices
      } else {
        throw new Error('No se encontraron cámaras disponibles')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al acceder a la cámara'
      setError(message)
      onError?.(message)
      return []
    }
  }, [onError])

  // Start scanner
  const startScanner = useCallback(async (cameraId?: string) => {
    if (!containerRef.current) return

    try {
      setIsInitializing(true)
      setError(null)

      // Stop existing scanner
      if (scannerRef.current) {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
      }

      // Create new scanner with support for all formats
      const scanner = new Html5Qrcode('barcode-scanner-container', {
        verbose: false,
        formatsToSupport: [
          // QR Codes
          Html5QrcodeSupportedFormats.QR_CODE,
          // 1D Barcodes
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          // 2D Codes
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.PDF_417
        ]
      })
      scannerRef.current = scanner

      // Get cameras if not already
      let availableCameras = cameras
      if (cameras.length === 0) {
        availableCameras = await getCameras()
      }

      const cameraToUse = cameraId || availableCameras[currentCameraIndex]?.id

      if (!cameraToUse) {
        throw new Error('No se encontró ninguna cámara')
      }

      // Configuration for scanning - square box for QR and wide for barcodes
      const config = {
        fps: 15,
        qrbox: { width: 280, height: 220 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      }

      // Start scanning
      await scanner.start(
        cameraToUse,
        config,
        (decodedText) => {
          // Debounce - prevent scanning same code too quickly
          const now = Date.now()
          if (
            decodedText === lastScannedRef.current &&
            now - lastScannedTimeRef.current < 3000
          ) {
            return
          }

          lastScannedRef.current = decodedText
          lastScannedTimeRef.current = now

          // Vibrate on successful scan
          if ('vibrate' in navigator) {
            navigator.vibrate(100)
          }

          // Play success sound
          try {
            const audioContext = new AudioContext()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            oscillator.frequency.value = 1200
            oscillator.type = 'sine'
            gainNode.gain.value = 0.1
            oscillator.start()
            setTimeout(() => oscillator.stop(), 100)
          } catch {
            // Ignore audio errors
          }

          onScan(decodedText)
          onClose()
        },
        (errorMessage) => {
          // Ignore continuous scanning errors (normal behavior)
          if (!errorMessage.includes('No QR code found') &&
              !errorMessage.includes('No barcode') &&
              !errorMessage.includes('NotFoundException')) {
            console.warn('Scan error:', errorMessage)
          }
        }
      )

      // Check torch capability
      try {
        const capabilities = scanner.getRunningTrackCameraCapabilities()
        setHasTorch(capabilities.torchFeature().isSupported())
      } catch {
        setHasTorch(false)
      }

      setIsInitializing(false)
    } catch (err) {
      console.error('Scanner start error:', err)
      const message = err instanceof Error ? err.message : 'Error al iniciar la cámara'
      setError(message)
      onError?.(message)
      setIsInitializing(false)
    }
  }, [cameras, currentCameraIndex, getCameras, onClose, onError, onScan])

  // Stop scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err)
      }
    }
  }, [])

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !hasTorch) return

    try {
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities()
      const torch = capabilities.torchFeature()

      if (torch.isSupported()) {
        await torch.apply(!torchEnabled)
        setTorchEnabled(!torchEnabled)
      }
    } catch (err) {
      console.warn('Torch toggle error:', err)
    }
  }, [hasTorch, torchEnabled])

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return

    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    setTorchEnabled(false)
    await startScanner(cameras[nextIndex].id)
  }, [cameras, currentCameraIndex, startScanner])

  // Initialize scanner when opened
  useEffect(() => {
    if (isOpen) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen, startScanner, stopScanner])

  // Handle close
  const handleClose = useCallback(() => {
    stopScanner()
    onClose()
  }, [onClose, stopScanner])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black"
      >
        {/* Scanner container */}
        <div
          ref={containerRef}
          id="barcode-scanner-container"
          className="w-full h-full"
        />

        {/* Overlay UI */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-auto safe-area-inset">
            <motion.button
              onClick={handleClose}
              className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-6 h-6" />
            </motion.button>

            <div className="flex items-center gap-2">
              {/* Torch button */}
              {hasTorch && (
                <motion.button
                  onClick={toggleTorch}
                  className={`p-3 backdrop-blur-sm rounded-full text-white transition-colors ${
                    torchEnabled ? 'bg-amber-500' : 'bg-black/50 hover:bg-black/70'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {torchEnabled ? (
                    <Flashlight className="w-6 h-6" />
                  ) : (
                    <FlashlightOff className="w-6 h-6" />
                  )}
                </motion.button>
              )}

              {/* Switch camera button */}
              {cameras.length > 1 && (
                <motion.button
                  onClick={switchCamera}
                  className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <SwitchCamera className="w-6 h-6" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Scanning viewfinder overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Darkened areas around viewfinder */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Viewfinder cutout - slightly square for both QR and barcodes */}
            <div className="relative w-[300px] h-[240px] z-10">
              {/* Clear center */}
              <div className="absolute inset-0 bg-transparent" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />

              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-amber-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-amber-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-amber-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-amber-500 rounded-br-xl" />

              {/* Scanning line animation */}
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                initial={{ top: '10%' }}
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />

              {/* Format indicators */}
              <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <Barcode className="w-4 h-4" />
                  <span>Barras</span>
                </div>
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <QrCode className="w-4 h-4" />
                  <span>QR</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom instructions */}
          <div className="absolute bottom-0 left-0 right-0 pb-10 pt-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto safe-area-bottom">
            <div className="text-center">
              {isInitializing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-white/80 text-sm">Iniciando cámara...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 px-4">
                  <Camera className="w-10 h-10 text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={() => startScanner()}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-5 h-5 text-amber-500" />
                    <QrCode className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-white font-medium">Escanea el código</p>
                  <p className="text-white/60 text-sm">Código de barras o QR</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
