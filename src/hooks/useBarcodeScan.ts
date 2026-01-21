'use client'

import { useEffect, useCallback, useRef } from 'react'

interface UseBarcodeScanOptions {
  onScan: (barcode: string) => void
  onError?: (error: string) => void
  minLength?: number
  maxTimeBetweenKeys?: number
  enabled?: boolean
}

/**
 * Hook to detect barcode scanner input
 *
 * Barcode scanners typically emulate keyboard input but type much faster than humans.
 * This hook detects rapid sequential keypresses and treats them as barcode scans.
 *
 * @param options Configuration options
 * @returns Object with scanner status
 */
export function useBarcodeScan(options: UseBarcodeScanOptions) {
  const {
    onScan,
    onError,
    minLength = 3,
    maxTimeBetweenKeys = 100, // Increased default for slower physical scanners
    enabled = true
  } = options

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scanStartTimeRef = useRef(0)
  const keyCountRef = useRef(0)

  const resetBuffer = useCallback(() => {
    bufferRef.current = ''
    scanStartTimeRef.current = 0
    keyCountRef.current = 0
  }, [])

  const processBarcode = useCallback((barcode: string, event?: KeyboardEvent) => {
    const trimmed = barcode.trim()
    if (trimmed.length >= minLength) {
      if (event) {
        event.preventDefault()
      }
      console.log('[Barcode Scanner] Detected:', trimmed)
      onScan(trimmed)
    }
    resetBuffer()
  }, [minLength, onScan, resetBuffer])

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Ignore if focus is on an input/textarea (unless it's the search input)
    const target = event.target as HTMLElement
    const tagName = target.tagName.toLowerCase()
    const placeholder = target.getAttribute('placeholder')?.toLowerCase() || ''
    const isSearchInput = placeholder.includes('buscar') || placeholder.includes('escanear') || placeholder.includes('search')

    // Allow scanning from inputs that are search-related
    if ((tagName === 'input' || tagName === 'textarea') && !isSearchInput) {
      return
    }

    const currentTime = Date.now()
    const key = event.key

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Check if this is a continuation of scanner input (or start of new scan)
    const timeSinceLastKey = currentTime - lastKeyTimeRef.current
    const isRapidInput = timeSinceLastKey < maxTimeBetweenKeys

    if (key === 'Enter') {
      // End of barcode - process if we have content
      if (bufferRef.current.length > 0) {
        processBarcode(bufferRef.current, event)
      }
      return
    }

    // Only process printable characters (single char, no modifiers)
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (isRapidInput || bufferRef.current.length === 0) {
        // Continue or start building barcode
        if (bufferRef.current.length === 0) {
          scanStartTimeRef.current = currentTime
          keyCountRef.current = 0
        }
        bufferRef.current += key
        keyCountRef.current++
      } else {
        // Too slow between keys - start new scan
        bufferRef.current = key
        scanStartTimeRef.current = currentTime
        keyCountRef.current = 1
      }
    }

    lastKeyTimeRef.current = currentTime

    // Auto-process buffer after short delay (for scanners without Enter)
    // Use shorter timeout since scanners are fast
    timeoutRef.current = setTimeout(() => {
      if (bufferRef.current.length >= minLength) {
        const totalTime = Date.now() - scanStartTimeRef.current
        const avgTimePerChar = bufferRef.current.length > 1 ? totalTime / (bufferRef.current.length - 1) : 0

        // Process if:
        // 1. Average time per char is fast enough (scanner speed), OR
        // 2. Buffer length suggests it's a barcode (8+ chars typed rapidly)
        const isScannerSpeed = avgTimePerChar < maxTimeBetweenKeys * 1.5
        const looksLikeBarcode = bufferRef.current.length >= 8 && avgTimePerChar < 150

        if (isScannerSpeed || looksLikeBarcode) {
          processBarcode(bufferRef.current)
        } else {
          // Not scanner input - clear buffer silently
          resetBuffer()
        }
      } else {
        resetBuffer()
      }
    }, 150) // Short timeout - scanners are fast, no need to wait for Enter

  }, [enabled, maxTimeBetweenKeys, minLength, processBarcode, resetBuffer])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [handleKeyPress, enabled])

  return {
    resetBuffer,
    isEnabled: enabled
  }
}

// Web Serial API types
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable?: ReadableStream
}

interface SerialNavigator extends Navigator {
  serial: {
    requestPort(): Promise<SerialPort>
  }
}

/**
 * Alternative hook using the Web Serial API for direct scanner connection
 * (Requires user permission and HTTPS)
 */
export function useSerialBarcodeScan(options: {
  onScan: (barcode: string) => void
  enabled?: boolean
}) {
  const { onScan, enabled = true } = options
  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      console.warn('Web Serial API not supported')
      return false
    }

    try {
      const port = await (navigator as SerialNavigator).serial.requestPort()
      await port.open({ baudRate: 9600 })
      portRef.current = port

      const reader = port.readable?.getReader()
      if (!reader) return false

      readerRef.current = reader

      // Read loop
      const readLoop = async () => {
        let buffer = ''
        while (true) {
          try {
            const { value, done } = await reader.read()
            if (done) break

            const text = new TextDecoder().decode(value)
            buffer += text

            // Check for line ending
            if (buffer.includes('\n') || buffer.includes('\r')) {
              const barcode = buffer.replace(/[\r\n]/g, '').trim()
              if (barcode.length > 0) {
                onScan(barcode)
              }
              buffer = ''
            }
          } catch (error) {
            console.error('Serial read error:', error)
            break
          }
        }
      }

      readLoop()
      return true
    } catch (error) {
      console.error('Failed to connect to serial port:', error)
      return false
    }
  }, [onScan])

  const disconnect = useCallback(async () => {
    if (readerRef.current) {
      await readerRef.current.cancel()
      readerRef.current = null
    }
    if (portRef.current) {
      await portRef.current.close()
      portRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    isConnected: !!portRef.current,
    isSupported: typeof navigator !== 'undefined' && 'serial' in navigator
  }
}
