'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Camera,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowLeft,
  User,
  Scan,
  Save,
  Trash2
} from 'lucide-react'
import { useFaceRecognition } from '@/hooks/useFaceRecognition'

interface Employee {
  id: number
  employee_code: string
  fullname: string
  hasFaceRegistered: boolean
}

export default function RegisterFacePage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    descriptorToString
  } = useFaceRecognition()

  useEffect(() => {
    fetchEmployee()
    return () => stopCamera()
  }, [employeeId])

  // Face detection loop when camera is active
  useEffect(() => {
    if (!cameraActive || !isModelLoaded || capturedImage) return

    let animationFrameId: number
    let isProcessing = false

    const detectFaceLoop = async () => {
      if (!videoRef.current || isProcessing) {
        animationFrameId = requestAnimationFrame(detectFaceLoop)
        return
      }

      isProcessing = true

      try {
        const descriptor = await detectFace(videoRef.current)
        setFaceDetected(!!descriptor)
      } catch (err) {
        console.error('Face detection error:', err)
      }

      isProcessing = false
      animationFrameId = requestAnimationFrame(detectFaceLoop)
    }

    const timeoutId = setTimeout(() => {
      animationFrameId = requestAnimationFrame(detectFaceLoop)
    }, 500)

    return () => {
      cancelAnimationFrame(animationFrameId)
      clearTimeout(timeoutId)
    }
  }, [cameraActive, isModelLoaded, capturedImage, detectFace])

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/market/hr/employees/${employeeId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployee(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching employee:', error)
    } finally {
      setLoading(false)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
        setCapturedImage(null)
        setCapturedDescriptor(null)
        setMessage(null)
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setMessage({ type: 'error', text: 'No se pudo acceder a la cámara' })
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setFaceDetected(false)
  }

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !faceDetected) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw mirrored image
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform

    // Get face descriptor
    const descriptor = await detectFace(video)

    if (descriptor) {
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8))
      setCapturedDescriptor(descriptor)
      stopCamera()
      setMessage({ type: 'success', text: 'Foto capturada. Haz clic en Guardar para registrar el rostro.' })
    } else {
      setMessage({ type: 'error', text: 'No se detectó un rostro. Intenta de nuevo.' })
    }
  }, [faceDetected, detectFace])

  const saveface = async () => {
    if (!capturedDescriptor || !capturedImage) return

    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`/api/market/hr/employees/${employeeId}/register-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceEncoding: descriptorToString(capturedDescriptor),
          photoUrl: capturedImage // In production, upload to S3/storage first
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: 'Rostro registrado exitosamente' })
        setEmployee(prev => prev ? { ...prev, hasFaceRegistered: true } : null)
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al guardar el rostro' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  const deleteFace = async () => {
    if (!confirm('¿Estás seguro de eliminar el registro facial?')) return

    try {
      setSaving(true)
      const response = await fetch(`/api/market/hr/employees/${employeeId}/register-face`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: 'Registro facial eliminado' })
        setEmployee(prev => prev ? { ...prev, hasFaceRegistered: false } : null)
        setCapturedImage(null)
        setCapturedDescriptor(null)
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al eliminar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  const retakePhoto = () => {
    setCapturedImage(null)
    setCapturedDescriptor(null)
    setMessage(null)
    startCamera()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Empleado no encontrado</h2>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Registro Facial</h1>
            <p className="text-sm text-gray-500">{employee.fullname} ({employee.employee_code})</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              employee.hasFaceRegistered ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {employee.hasFaceRegistered ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {employee.hasFaceRegistered ? 'Rostro Registrado' : 'Sin Registro Facial'}
              </h3>
              <p className="text-sm text-gray-500">
                {employee.hasFaceRegistered
                  ? 'Este empleado puede usar reconocimiento facial en el kiosco'
                  : 'Registra el rostro para habilitar el reconocimiento facial'
                }
              </p>
            </div>
          </div>

          {employee.hasFaceRegistered && (
            <button
              onClick={deleteFace}
              disabled={saving}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar registro facial
            </button>
          )}
        </div>

        {/* Model Loading Status */}
        {modelsLoading && (
          <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Cargando modelos de reconocimiento facial...</span>
          </div>
        )}

        {modelError && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
            {modelError}
          </div>
        )}

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-3 rounded-lg mb-6 flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {message.text}
          </motion.div>
        )}

        {/* Camera / Capture Section */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Captura de Rostro
            </h3>

            {/* Camera View or Captured Image */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] mb-4">
              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Camera className="w-16 h-16 opacity-50 mb-4" />
                  <p className="text-gray-400">Cámara no activa</p>
                </div>
              )}

              {cameraActive && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />

                  {/* Face detection overlay */}
                  <div className={`absolute inset-0 border-4 rounded-xl transition-colors ${
                    faceDetected ? 'border-green-500' : 'border-transparent'
                  }`} />

                  {/* Status indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
                      faceDetected ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-700'
                    }`}>
                      <Scan className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {faceDetected ? 'Rostro detectado - Listo para capturar' : 'Buscando rostro...'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured face"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!cameraActive && !capturedImage && (
                <button
                  onClick={startCamera}
                  disabled={!isModelLoaded}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-5 h-5" />
                  Iniciar Cámara
                </button>
              )}

              {cameraActive && (
                <>
                  <button
                    onClick={capturePhoto}
                    disabled={!faceDetected}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-5 h-5" />
                    Capturar Foto
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
                  >
                    Cancelar
                  </button>
                </>
              )}

              {capturedImage && (
                <>
                  <button
                    onClick={saveface}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Guardar Rostro
                  </button>
                  <button
                    onClick={retakePhoto}
                    disabled={saving}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium disabled:opacity-50"
                  >
                    Volver a Tomar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <h4 className="font-medium text-gray-900 mb-2">Instrucciones:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>1. Asegúrate de tener buena iluminación</li>
              <li>2. Mira directamente a la cámara</li>
              <li>3. Mantén una expresión neutral</li>
              <li>4. Espera a que se detecte tu rostro (borde verde)</li>
              <li>5. Haz clic en "Capturar Foto" y luego "Guardar"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
