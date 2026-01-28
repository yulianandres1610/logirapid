'use client'

import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Upload,
  Smartphone,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  User
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PhoneUploadModal } from '@/components/uploads/PhoneUploadModal'

interface EmployeePhotoUploadProps {
  employeeId: number
  employeeName: string
  employeeGender: 'M' | 'F' | null
  currentPhotoUrl?: string
  onPhotoProcessed: (originalPath: string, processedPath: string, processedBase64: string) => void
  onGenderChange: (gender: 'M' | 'F') => void
}

type PhotoUploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function EmployeePhotoUpload({
  employeeId,
  employeeName,
  employeeGender,
  currentPhotoUrl,
  onPhotoProcessed,
  onGenderChange
}: EmployeePhotoUploadProps) {
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<PhotoUploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showPhoneModal, setShowPhoneModal] = useState(false)

  // Images
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no debe exceder 10MB')
      return
    }

    setStatus('uploading')
    setError(null)

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64 = event.target?.result as string
        setOriginalImage(base64)
        setStatus('idle')
      }
      reader.onerror = () => {
        setError('Error al leer el archivo')
        setStatus('error')
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Error al cargar la imagen')
      setStatus('error')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePhoneUploadComplete = useCallback((
    fileUrl: string,
    fileName: string,
    fileSize?: number,
    fileType?: string,
    signedUrl?: string
  ) => {
    // The signed URL contains the actual image we can fetch
    if (signedUrl) {
      // Fetch the image and convert to base64
      fetch(signedUrl)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const base64 = e.target?.result as string
            setOriginalImage(base64)
          }
          reader.readAsDataURL(blob)
        })
        .catch(() => {
          setError('Error al cargar la imagen desde el teléfono')
        })
    }
    setShowPhoneModal(false)
  }, [])

  const processWithAI = async () => {
    if (!originalImage || !employeeGender) {
      setError('Selecciona una imagen y género para el traje')
      return
    }

    setStatus('processing')
    setError(null)

    try {
      const response = await fetch('/api/ai/process-employee-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: originalImage,
          gender: employeeGender === 'M' ? 'male' : 'female',
          employeeId
        })
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Error al procesar la imagen')
        setStatus('error')
        return
      }

      // Set processed image (with data URI prefix for display)
      const processedBase64 = `data:image/jpeg;base64,${result.data.processedBase64}`
      setProcessedImage(processedBase64)

      // Notify parent
      onPhotoProcessed(
        result.data.originalPath,
        result.data.processedPath,
        result.data.processedBase64
      )

      setStatus('success')
    } catch (err) {
      setError('Error de conexión al procesar la imagen')
      setStatus('error')
    }
  }

  const resetPhoto = () => {
    setOriginalImage(null)
    setProcessedImage(null)
    setStatus('idle')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Gender Selection */}
      <div>
        <label className={cn(
          "block text-sm font-medium mb-3",
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          Tipo de traje para la foto profesional *
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onGenderChange('M')}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl border-2 transition-all font-medium",
              employeeGender === 'M'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : theme === 'dark'
                  ? 'border-gray-700 hover:border-gray-600 text-gray-400'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
            )}
          >
            Traje Masculino
          </button>
          <button
            type="button"
            onClick={() => onGenderChange('F')}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl border-2 transition-all font-medium",
              employeeGender === 'F'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : theme === 'dark'
                  ? 'border-gray-700 hover:border-gray-600 text-gray-400'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
            )}
          >
            Traje Femenino
          </button>
        </div>
      </div>

      {/* Upload Area */}
      {!originalImage && !processedImage && (
        <div className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center",
          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        )}>
          <div className={cn(
            "w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          )}>
            <User className={cn(
              "w-10 h-10",
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )} />
          </div>

          <h3 className={cn(
            "text-lg font-semibold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Foto de {employeeName || 'Empleado'}
          </h3>
          <p className={cn(
            "text-sm mb-6",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            Sube una foto del empleado para procesarla con IA
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors",
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
              )}
            >
              <Upload className="w-5 h-5" />
              Subir desde dispositivo
            </button>
            <button
              type="button"
              onClick={() => setShowPhoneModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
            >
              <Smartphone className="w-5 h-5" />
              Usar teléfono
            </button>
          </div>
        </div>
      )}

      {/* Image Preview & Processing */}
      {(originalImage || processedImage) && (
        <div className="space-y-6">
          {/* Before / After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original */}
            <div className={cn(
              "rounded-2xl p-4",
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={cn(
                  "font-medium",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Foto Original
                </h4>
                <button
                  type="button"
                  onClick={resetPhoto}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {originalImage && (
                <div className="aspect-square rounded-xl overflow-hidden bg-white">
                  <img
                    src={originalImage}
                    alt="Foto original"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Processed */}
            <div className={cn(
              "rounded-2xl p-4",
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <div className="flex items-center gap-2 mb-3">
                <h4 className={cn(
                  "font-medium",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Foto Procesada con IA
                </h4>
                {status === 'success' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>
              <div className={cn(
                "aspect-square rounded-xl overflow-hidden flex items-center justify-center",
                theme === 'dark' ? 'bg-gray-900' : 'bg-white'
              )}>
                {processedImage ? (
                  <img
                    src={processedImage}
                    alt="Foto procesada"
                    className="w-full h-full object-cover"
                  />
                ) : status === 'processing' ? (
                  <div className="text-center p-6">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-3" />
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Procesando con IA...
                    </p>
                  </div>
                ) : (
                  <div className={cn(
                    "text-center p-6",
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      Presiona "Procesar con IA" para generar
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!processedImage && status !== 'processing' && (
              <button
                type="button"
                onClick={processWithAI}
                disabled={!employeeGender}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors",
                  !employeeGender
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                )}
              >
                <Sparkles className="w-5 h-5" />
                Procesar con IA
              </button>
            )}

            {processedImage && status !== 'processing' && (
              <button
                type="button"
                onClick={processWithAI}
                className={cn(
                  "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                )}
              >
                <RefreshCw className="w-5 h-5" />
                Reprocesar
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors border",
                theme === 'dark'
                  ? 'border-gray-700 hover:bg-gray-800 text-gray-300'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              )}
            >
              <Camera className="w-5 h-5" />
              Cambiar foto
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && processedImage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-400">
            Foto procesada correctamente. Se aplicará al contrato.
          </span>
        </motion.div>
      )}

      {/* Phone Upload Modal */}
      <PhoneUploadModal
        isOpen={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        purpose="employee_contract_photo"
        referenceType="contract"
        referenceId={employeeId}
        onUploadComplete={handlePhoneUploadComplete}
      />
    </div>
  )
}
