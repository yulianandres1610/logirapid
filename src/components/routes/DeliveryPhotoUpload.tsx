'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, X, Upload, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'

interface Photo {
  storagePath: string
  originalName?: string
  uploadedAt: string
  previewUrl?: string
  isNew?: boolean
}

interface DeliveryPhotoUploadProps {
  orderId: number
  companyId: string | number
  photos: Photo[]
  onPhotosChange: (photos: Photo[]) => void
  maxPhotos?: number
  disabled?: boolean
  label?: string
  required?: boolean
}

export default function DeliveryPhotoUpload({
  orderId,
  companyId,
  photos,
  onPhotosChange,
  maxPhotos = 5,
  disabled = false,
  label = 'Fotos de entrega',
  required = false
}: DeliveryPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (disabled) return

    setError(null)

    // Validar cantidad máxima
    const remainingSlots = maxPhotos - photos.length
    if (remainingSlots <= 0) {
      setError(`Máximo ${maxPhotos} fotos permitidas`)
      return
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots)

    // Validar tipos de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const invalidFiles = filesToUpload.filter(f => !validTypes.includes(f.type))
    if (invalidFiles.length > 0) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP)')
      return
    }

    // Validar tamaño (10MB máx)
    const maxSize = 10 * 1024 * 1024
    const largeFiles = filesToUpload.filter(f => f.size > maxSize)
    if (largeFiles.length > 0) {
      setError('Las imágenes deben ser menores a 10MB')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('orderId', orderId.toString())
      formData.append('companyId', companyId.toString())
      filesToUpload.forEach(file => {
        formData.append('photos', file)
      })

      const response = await fetch('/api/upload/delivery-photos', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al subir fotos')
      }

      // Crear previews locales para las nuevas fotos
      const newPhotos: Photo[] = data.photos.map((photo: any, index: number) => ({
        ...photo,
        previewUrl: URL.createObjectURL(filesToUpload[index]),
        isNew: true
      }))

      onPhotosChange([...photos, ...newPhotos])
    } catch (err: any) {
      console.error('Error uploading photos:', err)
      setError(err.message || 'Error al subir las fotos')
    } finally {
      setIsUploading(false)
      // Limpiar inputs
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }, [orderId, companyId, photos, maxPhotos, disabled, onPhotosChange])

  const handleRemovePhoto = useCallback((index: number) => {
    const updatedPhotos = [...photos]
    const removed = updatedPhotos.splice(index, 1)[0]

    // Revocar URL de preview si existe
    if (removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl)
    }

    onPhotosChange(updatedPhotos)
  }, [photos, onPhotosChange])

  const handleTakePhoto = useCallback(() => {
    if (cameraInputRef.current && !disabled) {
      cameraInputRef.current.click()
    }
  }, [disabled])

  const handleSelectFiles = useCallback(() => {
    if (fileInputRef.current && !disabled) {
      fileInputRef.current.click()
    }
  }, [disabled])

  return (
    <div className="flex flex-col gap-3">
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {label}
          {required && <span className="text-red-500">*</span>}
          <span className="text-gray-400 font-normal">
            ({photos.length}/{maxPhotos})
          </span>
        </label>
      )}

      {/* Grid de fotos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Fotos existentes */}
        {photos.map((photo, index) => (
          <div
            key={`${photo.storagePath}-${index}`}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group"
          >
            {photo.previewUrl ? (
              <img
                src={photo.previewUrl}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}

            {/* Botón eliminar */}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Indicador de nueva foto */}
            {photo.isNew && (
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded">
                Nueva
              </div>
            )}
          </div>
        ))}

        {/* Botones de agregar foto */}
        {photos.length < maxPhotos && !disabled && (
          <>
            {/* Botón tomar foto (móvil) */}
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={isUploading}
              className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              ) : (
                <>
                  <Camera className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500">Cámara</span>
                </>
              )}
            </button>

            {/* Botón seleccionar archivos */}
            <button
              type="button"
              onClick={handleSelectFiles}
              disabled={isUploading}
              className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500">Galería</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Inputs ocultos */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled || isUploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled || isUploading}
      />

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {disabled
          ? 'Las fotos están deshabilitadas'
          : `Puede agregar hasta ${maxPhotos} fotos. Formatos permitidos: JPG, PNG, WebP. Máx 10MB por foto.`
        }
      </p>
    </div>
  )
}
