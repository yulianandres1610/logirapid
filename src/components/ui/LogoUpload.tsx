'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoUploadProps {
  value?: string // URL del logo actual
  onChange: (url: string) => void
  className?: string
  disabled?: boolean
  uploadEndpoint?: string // Endpoint de carga (default: '/api/upload/logo')
  label?: string // Etiqueta para el alt text (default: 'Logo de la empresa')
}

export default function LogoUpload({
  value,
  onChange,
  className,
  disabled,
  uploadEndpoint = '/api/upload/logo',
  label = 'Logo de la empresa'
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Debug: Log cuando el value cambia
  console.log('🖼️ [LogoUpload] Received value:', value)

  const handleFile = async (file: File) => {
    setError('')

    // Validar tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Solo se aceptan archivos PNG, JPG, SVG o WEBP')
      return
    }

    // Validar tamaño (máximo 5GB)
    const maxSize = 5 * 1024 * 1024 * 1024
    if (file.size > maxSize) {
      setError('El archivo es demasiado grande. Máximo 5GB')
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('logo', file)

      // Si hay un logo antiguo, enviarlo para que sea eliminado
      if (value) {
        formData.append('oldLogoUrl', value)
      }

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData
      })

      // Verificar si la respuesta es JSON válida
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // Si no es JSON, obtener el texto de error
        const errorText = await response.text()
        console.error('Response is not JSON:', errorText)
        setError('Error del servidor: respuesta no válida')
        return
      }

      const data = await response.json()

      if (data.success) {
        onChange(data.url)
      } else {
        setError(data.error || 'Error al subir el logo')
      }
    } catch (err: any) {
      console.error('Error uploading logo:', err)
      setError('Error al subir el logo. Por favor intenta de nuevo')
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || uploading) return

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleRemove = () => {
    onChange('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {value ? (
        // Preview del logo subido
        <div className="relative group">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-center">
              <img
                src={value}
                alt={label}
                className="max-h-40 max-w-full object-contain"
              />
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {!disabled && (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full px-4 py-2 text-sm font-medium border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                Cambiar logo
              </button>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                El logo anterior será eliminado automáticamente
              </p>
            </div>
          )}
        </div>
      ) : (
        // Área de carga
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 transition-colors text-center',
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            onChange={handleChange}
            disabled={disabled || uploading}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Subiendo logo...
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
                  >
                    Haz clic para subir
                  </button>
                  {' '}o arrastra el logo aquí
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, SVG o WEBP (máx. 5GB)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
