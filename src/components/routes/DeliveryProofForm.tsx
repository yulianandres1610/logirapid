'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  Check,
  MapPin,
  User,
  FileText,
  AlertCircle
} from 'lucide-react'
import SignaturePad from '@/components/ui/SignaturePad'
import DeliveryPhotoUpload from './DeliveryPhotoUpload'

interface Photo {
  storagePath: string
  originalName?: string
  uploadedAt: string
  previewUrl?: string
  isNew?: boolean
}

interface DeliveryProofFormProps {
  orderId: number
  orderNumber: string
  companyId: string | number
  recipientName?: string
  onSuccess?: (proofData: any) => void
  onCancel?: () => void
  existingProof?: {
    signatureData?: string
    signerName?: string
    signerRelation?: string
    photos?: Photo[]
    notes?: string
  } | null
}

const SIGNER_RELATIONS = [
  { value: 'recipient', label: 'Destinatario' },
  { value: 'family', label: 'Familiar' },
  { value: 'neighbor', label: 'Vecino' },
  { value: 'guard', label: 'Guardia/Portero' },
  { value: 'other', label: 'Otro' }
]

export default function DeliveryProofForm({
  orderId,
  orderNumber,
  companyId,
  recipientName,
  onSuccess,
  onCancel,
  existingProof
}: DeliveryProofFormProps) {
  // Estado del formulario
  const [signatureData, setSignatureData] = useState<string>('')
  const [signerName, setSignerName] = useState<string>('')
  const [signerRelation, setSignerRelation] = useState<string>('recipient')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [notes, setNotes] = useState<string>('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  // Estado UI
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [markAsDelivered, setMarkAsDelivered] = useState(true)

  // Cargar datos existentes si hay
  useEffect(() => {
    if (existingProof) {
      if (existingProof.signatureData) setSignatureData(existingProof.signatureData)
      if (existingProof.signerName) setSignerName(existingProof.signerName)
      if (existingProof.signerRelation) setSignerRelation(existingProof.signerRelation)
      if (existingProof.photos) setPhotos(existingProof.photos)
      if (existingProof.notes) setNotes(existingProof.notes)
    }
  }, [existingProof])

  // Obtener geolocalización
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
          setLocationError(null)
        },
        (error) => {
          console.warn('Geolocation error:', error)
          setLocationError('No se pudo obtener la ubicación')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setLocationError('Geolocalización no disponible')
    }
  }, [])

  // Validación
  const isValid = signatureData.length > 0 && photos.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validar requisitos obligatorios
    if (!signatureData || signatureData.trim() === '') {
      setError('La firma electrónica es obligatoria')
      return
    }

    if (!photos || photos.length === 0) {
      setError('Al menos una foto es obligatoria')
      return
    }

    setIsSubmitting(true)

    try {
      // Paso 1: Subir la firma a S3 primero
      console.log('📝 Subiendo firma a S3...')
      const signatureResponse = await fetch('/api/upload/delivery-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signatureData,
          orderId,
          companyId
        })
      })

      const signatureResult = await signatureResponse.json()

      if (!signatureResponse.ok || !signatureResult.success) {
        throw new Error(signatureResult.error || 'Error al subir la firma')
      }

      console.log('✅ Firma subida:', signatureResult.storagePath)

      // Paso 2: Guardar el comprobante con la referencia a la firma en S3
      const response = await fetch('/api/delivery-proofs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId,
          signatureData, // Mantener el base64 por compatibilidad
          signatureStoragePath: signatureResult.storagePath, // Path en S3
          signerName: signerName || recipientName || 'No especificado',
          signerRelation,
          photos: photos.map(p => ({
            storagePath: p.storagePath,
            uploadedAt: p.uploadedAt
          })),
          latitude: location?.latitude,
          longitude: location?.longitude,
          notes,
          markAsDelivered
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar comprobante')
      }

      onSuccess?.(data.data)
    } catch (err: any) {
      console.error('Error saving delivery proof:', err)
      setError(err.message || 'Error al guardar el comprobante')
    } finally {
      setIsSubmitting(false)
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Orden: <span className="font-mono">{orderNumber}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Firma electrónica */}
            <SignaturePad
              onSave={setSignatureData}
              onClear={() => setSignatureData('')}
              label="Firma electrónica"
              required
              initialData={existingProof?.signatureData}
              width={Math.min(500, window.innerWidth - 80)}
              height={180}
            />

            {/* Datos del firmante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-1.5">
                  <User className="w-4 h-4" />
                  Nombre de quien firma
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder={recipientName || 'Nombre completo'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Relación con el destinatario
                </label>
                <select
                  value={signerRelation}
                  onChange={(e) => setSignerRelation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  {SIGNER_RELATIONS.map((rel) => (
                    <option key={rel.value} value={rel.value}>
                      {rel.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fotos */}
            <DeliveryPhotoUpload
              orderId={orderId}
              companyId={companyId}
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={5}
              required
            />

            {/* Notas */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-1.5">
                <FileText className="w-4 h-4" />
                Notas adicionales
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones sobre la entrega..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Ubicación */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              {location ? (
                <span className="text-green-600 dark:text-green-400">
                  Ubicación capturada: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </span>
              ) : locationError ? (
                <span className="text-yellow-600 dark:text-yellow-400">{locationError}</span>
              ) : (
                <span className="text-gray-500">Obteniendo ubicación...</span>
              )}
            </div>

            {/* Checkbox marcar como entregado */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="markDelivered"
                checked={markAsDelivered}
                onChange={(e) => setMarkAsDelivered(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="markDelivered" className="text-sm text-gray-700 dark:text-gray-300">
                Marcar orden como entregada al guardar
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Indicador de requisitos */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                Requisitos para completar la entrega:
              </p>
              <div className="flex flex-col gap-1 text-sm">
                <span className={`flex items-center gap-2 ${signatureData ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {signatureData ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 border border-current rounded-full" />}
                  Firma electrónica
                </span>
                <span className={`flex items-center gap-2 ${photos.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {photos.length > 0 ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 border border-current rounded-full" />}
                  Al menos 1 foto
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar comprobante
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
