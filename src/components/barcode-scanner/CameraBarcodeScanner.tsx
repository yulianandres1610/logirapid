'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Flashlight, FlashlightOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'

interface CameraBarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  onError?: (error: string) => void
}

// BarcodeDetector API types (for browsers that support it)
interface BarcodeDetectorOptions {
  formats: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
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
  const [useNativeDetector, setUseNativeDetector] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scanningRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const lastScanTimeRef = useRef(0)

  // Check if native BarcodeDetector is supported
  const isBarcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

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

  // Handle successful scan
  const handleScanSuccess = useCallback((code: string) => {
    const now = Date.now()

    // Debounce - prevent scanning same code too quickly
    if (code !== lastScanned || now - lastScanTimeRef.current > 2000) {
      lastScanTimeRef.current = now
      setLastScanned(code)

      // Vibrate on success
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50])
      }

      // Play beep sound
      playBeep()

      console.log('Scanned:', code)
      onScan(code)
      onClose()
    }
  }, [lastScanned, onScan, onClose, playBeep])

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    scanningRef.current = false

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop html5-qrcode if running
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {})
      html5QrCodeRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Scan frame using native BarcodeDetector
  const scanFrameNative = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) {
      if (scanningRef.current) {
        animationFrameRef.current = requestAnimationFrame(scanFrameNative)
      }
      return
    }

    const video = videoRef.current

    if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      animationFrameRef.current = requestAnimationFrame(scanFrameNative)
      return
    }

    try {
      const barcodes = await detectorRef.current.detect(video)

      if (barcodes.length > 0) {
        handleScanSuccess(barcodes[0].rawValue)
        return
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
        console.warn('Scan error:', err)
      }
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrameNative)
    }
  }, [handleScanSuccess])

  // Start camera with native BarcodeDetector
  const startNativeScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        } as MediaTrackConstraints,
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

      // Initialize native BarcodeDetector
      if (window.BarcodeDetector) {
        const formats = await window.BarcodeDetector.getSupportedFormats()
        detectorRef.current = new window.BarcodeDetector({
          formats: formats.filter(f => [
            'ean_13', 'ean_8', 'upc_a', 'upc_e',
            'code_128', 'code_39', 'code_93',
            'codabar', 'itf', 'qr_code', 'data_matrix'
          ].includes(f))
        })
      }

      setIsInitializing(false)
      scanningRef.current = true
      scanFrameNative()
    } catch (err) {
      throw err
    }
  }, [scanFrameNative])

  // Start camera with html5-qrcode fallback (for Safari/iOS)
  const startHtml5Scanner = useCallback(async () => {
    try {
      const scannerId = 'html5-qrcode-scanner'

      // Create container if it doesn't exist
      let container = document.getElementById(scannerId)
      if (!container) {
        container = document.createElement('div')
        container.id = scannerId
        container.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
        document.getElementById('scanner-container')?.appendChild(container)
      }

      const html5QrCode = new Html5Qrcode(scannerId)
      html5QrCodeRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        () => {
          // Scan failure - ignore, this is called on every frame without a barcode
        }
      )

      setIsInitializing(false)
      scanningRef.current = true
    } catch (err) {
      throw err
    }
  }, [handleScanSuccess])

  // Start camera and scanning
  const startCamera = useCallback(async () => {
    if (!isOpen) return

    try {
      setIsInitializing(true)
      setError(null)
      setLastScanned(null)

      // Try native BarcodeDetector first (faster, hardware-accelerated)
      if (isBarcodeDetectorSupported) {
        setUseNativeDetector(true)
        await startNativeScanner()
      } else {
        // Fallback to html5-qrcode for Safari/iOS
        setUseNativeDetector(false)
        await startHtml5Scanner()
      }
    } catch (err) {
      console.error('Camera error:', err)
      const message = err instanceof Error ? err.message : 'Error al acceder a la cámara'
      setError(message)
      onError?.(message)
      setIsInitializing(false)
    }
  }, [isOpen, isBarcodeDetectorSupported, startNativeScanner, startHtml5Scanner, onError])

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

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Container for scanner */}
      <div id="scanner-container" className="absolute inset-0">
        {/* Video element for native detector */}
        {useNativeDetector && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

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

          {hasTorch && useNativeDetector && (
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

        {/* Scan area with dark overlay - only show for native detector */}
        {useNativeDetector && (
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
        )}

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
                <p className="text-white/60 text-sm">
                  {useNativeDetector ? 'Detección nativa ultrarrápida' : 'Escáner activo'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
