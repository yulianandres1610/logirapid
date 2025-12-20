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
    maxTimeBetweenKeys = 50,
    enabled = true
  } = options

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetBuffer = useCallback(() => {
    bufferRef.current = ''
  }, [])

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Ignore if focus is on an input/textarea (unless it's the search input)
    const target = event.target as HTMLElement
    const tagName = target.tagName.toLowerCase()
    const isSearchInput = target.getAttribute('placeholder')?.toLowerCase().includes('buscar') ||
                          target.getAttribute('placeholder')?.toLowerCase().includes('escanear')

    if ((tagName === 'input' || tagName === 'textarea') && !isSearchInput) {
      return
    }

    const currentTime = Date.now()
    const key = event.key

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Check if this is a continuation of scanner input
    if (currentTime - lastKeyTimeRef.current < maxTimeBetweenKeys) {
      // Continue building barcode
      if (key === 'Enter') {
        // End of barcode
        const barcode = bufferRef.current.trim()
        if (barcode.length >= minLength) {
          event.preventDefault()
          onScan(barcode)
        }
        resetBuffer()
      } else if (key.length === 1) {
        // Add character to buffer
        bufferRef.current += key
      }
    } else {
      // Start new scan
      if (key.length === 1) {
        bufferRef.current = key
      } else {
        resetBuffer()
      }
    }

    lastKeyTimeRef.current = currentTime

    // Set timeout to clear buffer after inactivity
    timeoutRef.current = setTimeout(() => {
      // If we have a buffer but no Enter was pressed, might be incomplete scan
      if (bufferRef.current.length >= minLength) {
        if (onError) {
          onError('Escaneo incompleto detectado')
        }
      }
      resetBuffer()
    }, 200)

  }, [enabled, maxTimeBetweenKeys, minLength, onScan, onError, resetBuffer])

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
