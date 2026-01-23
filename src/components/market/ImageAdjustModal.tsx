'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  onConfirm: (adjustedImageBase64: string) => void
  theme?: 'dark' | 'light'
}

export function ImageAdjustModal({ isOpen, onClose, imageUrl, onConfirm, theme = 'dark' }: ImageAdjustModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  const CANVAS_SIZE = 512
  const DISPLAY_SIZE = 320

  // Load image
  useEffect(() => {
    if (!isOpen || !imageUrl) return

    setImageLoaded(false)
    setZoom(1)
    setOffset({ x: 0, y: 0 })

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      console.error('[ImageAdjust] Failed to load image:', imageUrl)
    }
    img.src = imageUrl
  }, [isOpen, imageUrl])

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Calculate dimensions to fit image in canvas
    const aspectRatio = img.width / img.height
    let drawWidth: number
    let drawHeight: number

    if (aspectRatio > 1) {
      // Landscape
      drawWidth = CANVAS_SIZE * zoom
      drawHeight = (CANVAS_SIZE / aspectRatio) * zoom
    } else {
      // Portrait or square
      drawHeight = CANVAS_SIZE * zoom
      drawWidth = (CANVAS_SIZE * aspectRatio) * zoom
    }

    // Center image + apply offset
    const x = (CANVAS_SIZE - drawWidth) / 2 + offset.x
    const y = (CANVAS_SIZE - drawHeight) / 2 + offset.y

    ctx.drawImage(img, x, y, drawWidth, drawHeight)
  }, [zoom, offset])

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas()
    }
  }, [imageLoaded, drawCanvas])

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setDragging(false)
  }

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setDragging(true)
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    const touch = e.touches[0]
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    })
  }

  const handleTouchEnd = () => {
    setDragging(false)
  }

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 4))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5))
  const handleReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // Confirm - export canvas as base64
  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const base64 = canvas.toDataURL('image/jpeg', 0.9)
    onConfirm(base64)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'w-full max-w-md rounded-2xl p-5 shadow-2xl',
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Ajustar Imagen</h3>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex justify-center mb-4">
          <div
            className={cn(
              'relative rounded-xl overflow-hidden border-2 cursor-move',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
            )}
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={handleZoomOut}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <input
            type="range"
            min="50"
            max="400"
            value={zoom * 100}
            onChange={e => setZoom(parseInt(e.target.value) / 100)}
            className="flex-1 h-2 rounded-full appearance-none bg-gray-300 dark:bg-gray-700 accent-blue-500"
          />

          <button
            onClick={handleZoomIn}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <button
            onClick={handleReset}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            )}
            title="Restablecer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <p className={cn(
          'text-xs text-center mb-4',
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        )}>
          Arrastra para mover. Usa el slider para zoom.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-colors',
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imageLoaded}
            className={cn(
              'flex-[2] py-3 rounded-xl font-bold transition-all',
              imageLoaded
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
