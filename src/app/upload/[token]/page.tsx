'use client'

import React, { useState, useEffect, useRef, use } from 'react'

interface TokenInfo {
  purpose: string
  status: string
  expired: boolean
  hasFile: boolean
}

const PURPOSE_LABELS: Record<string, string> = {
  purchase_invoice: 'Factura de Compra',
  expense_receipt: 'Recibo de Gasto',
  product_image: 'Imagen de Producto'
}

export default function MobileUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/upload-tokens/${token}`)
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'Token no valido')
          return
        }

        if (data.data.expired) {
          setError('Este enlace ha expirado. Genere uno nuevo desde el sistema.')
          return
        }

        if (data.data.status === 'uploaded') {
          setError('Este enlace ya fue utilizado.')
          return
        }

        if (data.data.status !== 'pending') {
          setError('Este enlace no es valido.')
          return
        }

        setTokenInfo(data.data)
      } catch {
        setError('Error de conexion. Verifique su internet.')
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`/api/upload-tokens/${token}/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Error al subir el archivo')
        return
      }

      setUploadSuccess(true)
    } catch {
      setError('Error de conexion al subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando enlace...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Upload success
  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Subido correctamente</h1>
          <p className="text-gray-600">El archivo se ha subido exitosamente. Puede cerrar esta ventana.</p>
        </div>
      </div>
    )
  }

  // Main upload UI
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-6 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">Subir Archivo</h1>
        {tokenInfo && (
          <p className="text-gray-500 mt-1">
            {PURPOSE_LABELS[tokenInfo.purpose] || tokenInfo.purpose}
          </p>
        )}
      </div>

      {/* File Preview or Buttons */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {selectedFile ? (
          <div className="w-full max-w-sm">
            {/* Preview */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
              ) : (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-600 font-medium">{selectedFile.name}</p>
                </div>
              )}
              <div className="p-4 border-t border-gray-100">
                <p className="text-sm text-gray-600 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Subir Archivo
                  </>
                )}
              </button>
              <button
                onClick={clearFile}
                disabled={uploading}
                className="w-full py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 disabled:opacity-50"
              >
                Cambiar archivo
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            {/* Camera Button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-6 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 flex flex-col items-center gap-2 shadow-lg"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-lg">Tomar Foto</span>
            </button>

            {/* File Picker Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 bg-white text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 flex flex-col items-center gap-2 shadow-lg border border-gray-200"
            >
              <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-lg">Seleccionar Archivo</span>
            </button>

            <p className="text-center text-sm text-gray-400 mt-4">
              Formatos: JPG, PNG, WEBP, PDF (max 10MB)
            </p>
          </div>
        )}
      </div>

      {/* Hidden Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  )
}
