'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import SignaturePadLib from 'signature_pad'
import { PenLine, Trash2, Check, RotateCcw } from 'lucide-react'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  width?: number
  height?: number
  penColor?: string
  backgroundColor?: string
  disabled?: boolean
  initialData?: string
  label?: string
  required?: boolean
}

export default function SignaturePad({
  onSave,
  onClear,
  width = 400,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
  initialData,
  label = 'Firma',
  required = false
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [isSaved, setIsSaved] = useState(false)

  // Inicializar signature_pad
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ratio = Math.max(window.devicePixelRatio || 1, 1)

    // Configurar canvas para alta resolución
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.getContext('2d')?.scale(ratio, ratio)

    // Crear instancia de SignaturePad
    signaturePadRef.current = new SignaturePadLib(canvas, {
      penColor,
      backgroundColor,
      minWidth: 0.5,
      maxWidth: 2.5
    })

    // Cargar datos iniciales si existen
    if (initialData) {
      signaturePadRef.current.fromDataURL(initialData, {
        width: width,
        height: height,
        ratio: ratio
      })
      setIsEmpty(false)
      setIsSaved(true)
    }

    // Manejar eventos de dibujo
    const handleBeginStroke = () => {
      setIsEmpty(false)
      setIsSaved(false)
    }

    signaturePadRef.current.addEventListener('beginStroke', handleBeginStroke)

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.removeEventListener('beginStroke', handleBeginStroke)
        signaturePadRef.current.off()
      }
    }
  }, [width, height, penColor, backgroundColor, initialData])

  // Habilitar/deshabilitar según prop
  useEffect(() => {
    if (signaturePadRef.current) {
      if (disabled) {
        signaturePadRef.current.off()
      } else {
        signaturePadRef.current.on()
      }
    }
  }, [disabled])

  const handleClear = useCallback(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear()
      setIsEmpty(true)
      setIsSaved(false)
      onClear?.()
    }
  }, [onClear])

  const handleUndo = useCallback(() => {
    if (signaturePadRef.current) {
      const data = signaturePadRef.current.toData()
      if (data && data.length > 0) {
        data.pop()
        signaturePadRef.current.fromData(data)
        if (data.length === 0) {
          setIsEmpty(true)
        }
        setIsSaved(false)
      }
    }
  }, [])

  const handleSave = useCallback(() => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      // Exportar como PNG base64
      const dataUrl = signaturePadRef.current.toDataURL('image/png')
      onSave(dataUrl)
      setIsSaved(true)
    }
  }, [onSave])

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Canvas container */}
      <div className={`relative border-2 rounded-lg overflow-hidden transition-colors ${
        disabled
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
          : isEmpty
            ? 'border-dashed border-gray-300 dark:border-gray-600'
            : isSaved
              ? 'border-green-500 dark:border-green-400'
              : 'border-blue-400 dark:border-blue-500'
      }`}>
        <canvas
          ref={canvasRef}
          className={`touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}`}
          style={{ display: 'block' }}
        />

        {/* Placeholder text cuando está vacío */}
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              Firme aquí
            </p>
          </div>
        )}

        {/* Indicador de guardado */}
        {isSaved && !isEmpty && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <Check className="w-3 h-3" />
            Guardado
          </div>
        )}
      </div>

      {/* Botones de acción */}
      {!disabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={isEmpty}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Deshacer
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || isSaved}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <Check className="w-4 h-4" />
            {isSaved ? 'Guardada' : 'Guardar firma'}
          </button>
        </div>
      )}

      {/* Información adicional */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {disabled
          ? 'La firma está deshabilitada'
          : 'Use el mouse o el dedo para firmar. La firma se guardará como imagen.'
        }
      </p>
    </div>
  )
}
