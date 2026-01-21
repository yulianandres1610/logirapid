'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Flashlight, FlashlightOff } from 'lucide-react'
import { motion } from 'framer-motion'

interface CameraBarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  onError?: (error: string) => void
}

// BarcodeDetector API types
interface BarcodeDetectorOptions {
  formats: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
}

interface BarcodeDetectorClass {
  new(options?: BarcodeDetectorOptions): BarcodeDetectorInstance
  getSupportedFormats(): Promise<string[]>
}

interface BarcodeDetectorInstance {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorClass
  }
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
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const scanningRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const lastScanTimeRef = useRef(0)

  // Check if BarcodeDetector is supported
  const isBarcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    scanningRef.current = false

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Start camera and scanning
  const startCamera = useCallback(async () => {
    if (!isOpen) return

    try {
      setIsInitializing(true)
      setError(null)
      setLastScanned(null)

      // Request camera access with optimal settings for barcode scanning
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: { ideal: 'continuous' } as unknown as ConstrainDOMString,
          // @ts-expect-error - torch is not in the standard types
          torch: false
        },
        audio: false
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        setHasTorch(!!capabilities.torch)
      }

      // Initialize BarcodeDetector if supported
      if (isBarcodeDetectorSupported && window.BarcodeDetector) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats()
          console.log('Supported barcode formats:', formats)

          detectorRef.current = new window.BarcodeDetector({
            formats: formats.filter(f => [
              'ean_13', 'ean_8', 'upc_a', 'upc_e',
              'code_128', 'code_39', 'code_93',
              'codabar', 'itf', 'qr_code', 'data_matrix'
            ].includes(f))
          })
        } catch (e) {
          console.warn('BarcodeDetector init error:', e)
        }
      }

      setIsInitializing(false)
      scanningRef.current = true
      scanFrame()

    } catch (err) {
      console.error('Camera error:', err)
      const message = err instanceof Error ? err.message : 'Error al acceder a la cámara'
      setError(message)
      onError?.(message)
      setIsInitializing(false)
    }
  }, [isOpen, isBarcodeDetectorSupported, onError])

  // Scan single frame using native BarcodeDetector
  const scanFrame = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) {
      // Retry if detector not ready yet
      if (scanningRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrame)
      }
      return
    }

    const video = videoRef.current

    // Only scan if video is playing and has valid dimensions
    if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    try {
      const barcodes = await detectorRef.current.detect(video)

      if (barcodes.length > 0) {
        const barcode = barcodes[0]
        const now = Date.now()

        // Debounce - prevent scanning same code too quickly
        if (barcode.rawValue !== lastScanned || now - lastScanTimeRef.current > 2000) {
          lastScanTimeRef.current = now
          setLastScanned(barcode.rawValue)

          // Vibrate on success
          if ('vibrate' in navigator) {
            navigator.vibrate([50, 30, 50])
          }

          // Play beep sound
          playBeep()

          console.log('Scanned:', barcode.rawValue, 'Format:', barcode.format)

          onScan(barcode.rawValue)
          onClose()
          return
        }
      }
    } catch (err) {
      // Detection errors are normal when no barcode is visible
      if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
        console.warn('Scan error:', err)
      }
    }

    // Continue scanning
    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
    }
  }, [lastScanned, onClose, onScan])

  // Play beep sound
  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 1800
      oscillator.type = 'square'
      gainNode.gain.value = 0.1

      oscillator.start()
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 80)
    } catch {
      // Ignore audio errors
    }
  }, [])

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      const newTorchState = !torchEnabled

      await videoTrack.applyConstraints({
        // @ts-expect-error - torch is not in standard types
        advanced: [{ torch: newTorchState }]
      })

      setTorchEnabled(newTorchState)
    } catch (err) {
      console.warn('Torch toggle error:', err)
    }
  }, [hasTorch, torchEnabled])

  // Handle open/close
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera])

  // Handle close
  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [onClose, stopCamera])

  if (!isOpen) return null

  // Show error if BarcodeDetector is not supported
  if (!isBarcodeDetectorSupported) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-sm text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Navegador no compatible</h3>
          <p className="text-gray-400 text-sm mb-4">
            Tu navegador no soporta el escáner nativo. Usa Chrome, Edge o Safari actualizado.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-700 text-white rounded-xl font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Video element - full screen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay UI */}
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

        {/* Scan area with dark overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Dark overlay with cutout */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 bg-transparent"
                 style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
          </div>

          {/* Viewfinder frame */}
          <div className="relative w-72 h-36 z-10">
            {/* Corner brackets */}
            <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-amber-500 rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-amber-500 rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-amber-500 rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-amber-500 rounded-br-xl" />

            {/* Animated scan line */}
            <motion.div
              className="absolute left-2 right-2 h-1 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50"
              animate={{ top: ['5%', '95%', '5%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
                  onClick={() => startCamera()}
                  className="px-6 py-3 bg-amber-500 text-white rounded-xl text-base font-medium pointer-events-auto active:bg-amber-600"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-white text-lg font-medium">Apunta al código de barras</p>
                <p className="text-white/60 text-sm">Detección nativa ultrarrápida</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
