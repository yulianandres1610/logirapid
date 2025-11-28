'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  PenLine,
  Camera,
  MapPin,
  User,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react'

interface Photo {
  storagePath: string
  originalName?: string
  uploadedAt: string
  signedUrl?: string
}

interface DeliveryProofData {
  id: number
  orderId: number
  orderNumber: string
  orderStatus?: string
  recipient?: {
    name: string
    phone?: string
    address?: string
    city?: string
    state?: string
  }
  signature: {
    hasSignature: boolean
    data?: string
    storagePath?: string
    signerName?: string
    signerRelation?: string
  }
  photos: Photo[]
  location?: {
    latitude?: number
    longitude?: number
  }
  notes?: string
  metadata: {
    createdAt: string
    updatedAt?: string
    createdBy?: number
    createdByName?: string
  }
}

interface DeliveryProofViewerProps {
  orderId: number
  onClose?: () => void
  companyId?: string | number
}

const RELATION_LABELS: Record<string, string> = {
  recipient: 'Destinatario',
  family: 'Familiar',
  neighbor: 'Vecino',
  guard: 'Guardia/Portero',
  other: 'Otro'
}

export default function DeliveryProofViewer({
  orderId,
  onClose,
  companyId
}: DeliveryProofViewerProps) {
  const [proof, setProof] = useState<DeliveryProofData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [showFullImage, setShowFullImage] = useState(false)

  useEffect(() => {
    const fetchProof = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/delivery-proofs/${orderId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Error al obtener comprobante')
        }

        if (!data.data) {
          throw new Error('La orden no tiene comprobante de entrega')
        }

        setProof(data.data)
      } catch (err: any) {
        console.error('Error fetching proof:', err)
        setError(err.message || 'Error al cargar el comprobante')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProof()
  }, [orderId])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const handlePrevPhoto = () => {
    if (proof && proof.photos.length > 0) {
      setCurrentPhotoIndex((prev) =>
        prev === 0 ? proof.photos.length - 1 : prev - 1
      )
    }
  }

  const handleNextPhoto = () => {
    if (proof && proof.photos.length > 0) {
      setCurrentPhotoIndex((prev) =>
        prev === proof.photos.length - 1 ? 0 : prev + 1
      )
    }
  }

  const openInMaps = () => {
    if (proof?.location?.latitude && proof?.location?.longitude) {
      const url = `https://www.google.com/maps?q=${proof.location.latitude},${proof.location.longitude}`
      window.open(url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Comprobante de Entrega
            </h2>
            {proof && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Orden: <span className="font-mono">{proof.orderNumber}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500 dark:text-red-400">{error}</p>
            </div>
          ) : proof ? (
            <div className="p-6 space-y-6">
              {/* Firma */}
              {proof.signature.hasSignature && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                    <PenLine className="w-4 h-4" />
                    Firma electrónica
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                    {proof.signature.data && (
                      <img
                        src={proof.signature.data}
                        alt="Firma"
                        className="max-w-full h-auto mx-auto max-h-48"
                      />
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="w-4 h-4" />
                        <span>{proof.signature.signerName || 'Sin nombre'}</span>
                      </div>
                      {proof.signature.signerRelation && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                          {RELATION_LABELS[proof.signature.signerRelation] || proof.signature.signerRelation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Fotos */}
              {proof.photos && proof.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                    <Camera className="w-4 h-4" />
                    Fotos de entrega ({proof.photos.length})
                  </h3>
                  <div className="relative">
                    {/* Imagen principal */}
                    <div
                      className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer"
                      onClick={() => setShowFullImage(true)}
                    >
                      {proof.photos[currentPhotoIndex].signedUrl ? (
                        <img
                          src={proof.photos[currentPhotoIndex].signedUrl}
                          alt={`Foto ${currentPhotoIndex + 1}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Camera className="w-12 h-12" />
                        </div>
                      )}
                    </div>

                    {/* Navegación de fotos */}
                    {proof.photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevPhoto}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextPhoto}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                          {currentPhotoIndex + 1} / {proof.photos.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Miniaturas */}
                  {proof.photos.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {proof.photos.map((photo, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setCurrentPhotoIndex(index)}
                          className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                            index === currentPhotoIndex
                              ? 'border-blue-500'
                              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          {photo.signedUrl ? (
                            <img
                              src={photo.signedUrl}
                              alt={`Miniatura ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <Camera className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ubicación */}
              {proof.location && (proof.location.latitude || proof.location.longitude) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    Ubicación de entrega
                  </h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {parseFloat(String(proof.location.latitude))?.toFixed(6)}, {parseFloat(String(proof.location.longitude))?.toFixed(6)}
                    </span>
                    <button
                      type="button"
                      onClick={openInMaps}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                    >
                      Ver en mapa
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Notas */}
              {proof.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    Notas
                  </h3>
                  <p className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    {proof.notes}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Registrado: {formatDate(proof.metadata.createdAt)}
                  </span>
                  {proof.metadata.createdByName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Por: {proof.metadata.createdByName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de imagen completa */}
      {showFullImage && proof && proof.photos[currentPhotoIndex] && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]"
          onClick={() => setShowFullImage(false)}
        >
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {proof.photos[currentPhotoIndex].signedUrl && (
            <img
              src={proof.photos[currentPhotoIndex].signedUrl}
              alt="Foto completa"
              className="max-w-[95vw] max-h-[95vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  )
}
