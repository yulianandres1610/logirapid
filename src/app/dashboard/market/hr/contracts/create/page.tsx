'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  User,
  DollarSign,
  Camera,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock,
  Loader2,
  AlertCircle,
  X,
  Scan,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { EmployeePhotoUpload } from '@/components/hr/EmployeePhotoUpload'
import { useFaceRecognition } from '@/hooks/useFaceRecognition'

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  firstName: string
  lastName: string
  status: string
}

interface Department {
  id: number
  name: string
  code: string | null
}

interface Schedule {
  id: number
  name: string
  weeklyHours: number
}

const STEPS = [
  { id: 'employee', title: 'Empleado', icon: User },
  { id: 'contract', title: 'Contrato', icon: FileText },
  { id: 'compensation', title: 'Compensación', icon: DollarSign },
  { id: 'photo', title: 'Foto', icon: Camera },
  { id: 'face-register', title: 'Kiosco', icon: Scan },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

const CONTRACT_TYPES = [
  { value: 'indefinido', label: 'Indefinido', description: 'Sin fecha de finalización' },
  { value: 'temporal', label: 'Temporal', description: 'Con fecha de finalización definida' },
  { value: 'por_obra', label: 'Por Obra', description: 'Hasta completar un proyecto' }
]

const PAY_TYPES = [
  { value: 'hourly', label: 'Por Hora', description: 'Pago calculado por horas trabajadas' },
  { value: 'daily', label: 'Por Día', description: 'Pago calculado por días trabajados' },
  { value: 'monthly', label: 'Mensual', description: 'Salario fijo mensual' }
]

export default function CreateContractPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  const editId = searchParams.get('edit')
  const isEditMode = !!editId

  const [currentStep, setCurrentStep] = useState<string>('employee')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const [formData, setFormData] = useState({
    // Step 1: Employee
    employeeId: '',
    position: '',
    // Step 2: Contract
    contractType: 'indefinido',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    departmentId: '',
    scheduleId: '',
    // Step 3: Compensation
    payType: 'monthly',
    payRate: '',
    currency: 'USD',
    commissionRate: '0',
    notes: '',
    // Step 4: Photo
    photoOriginalPath: '',
    photoProcessedPath: '',
    employeeGender: null as 'M' | 'F' | null,
    // Step 5: Face Registration
    faceEncoding: null as string | null,
    faceRegistered: false
  })

  // Face registration states
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [capturingFace, setCapturingFace] = useState(false)
  const [faceError, setFaceError] = useState<string | null>(null)
  const [skippedFaceRegistration, setSkippedFaceRegistration] = useState(false)

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    descriptorToString
  } = useFaceRecognition()

  const selectedEmployee = employees.find(e => e.id.toString() === formData.employeeId)

  useEffect(() => {
    fetchData()
    if (editId) {
      fetchContract(editId)
    }
  }, [editId])

  // Start/stop camera when in face-register step
  useEffect(() => {
    if (currentStep === 'face-register' && !formData.faceRegistered && !skippedFaceRegistration) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [currentStep, formData.faceRegistered, skippedFaceRegistration])

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
        setFaceError(null)
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err)
      setFaceError('No se pudo acceder a la cámara. Verifique los permisos.')
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

  const captureFace = async () => {
    if (!videoRef.current || !isModelLoaded) return

    try {
      setCapturingFace(true)
      setFaceError(null)

      // Multiple capture attempts for better accuracy
      let bestDescriptor: Float32Array | null = null
      let attempts = 0
      const MAX_ATTEMPTS = 3

      while (!bestDescriptor && attempts < MAX_ATTEMPTS) {
        attempts++
        // Use skipCooldown with reduced face size for better capture experience
        const descriptor = await detectFace(videoRef.current, {
          skipCooldown: true,
          minFaceSize: 80 // Reduced from 150 to allow more flexible capture
        })

        if (descriptor) {
          bestDescriptor = descriptor
        } else if (attempts < MAX_ATTEMPTS) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (!bestDescriptor) {
        setFaceError('No se detectó ningún rostro. Asegúrese de estar bien iluminado, mirando directamente a la cámara, y que su rostro esté cerca.')
        return
      }

      // Convert descriptor to string for storage
      const encodingString = descriptorToString(bestDescriptor)

      setFormData(prev => ({
        ...prev,
        faceEncoding: encodingString,
        faceRegistered: true
      }))

      setFaceDetected(true)
      stopCamera()

    } catch (err: any) {
      console.error('Error capturing face:', err)
      setFaceError('Error al capturar el rostro: ' + err.message)
    } finally {
      setCapturingFace(false)
    }
  }

  const resetFaceRegistration = () => {
    setFormData(prev => ({
      ...prev,
      faceEncoding: null,
      faceRegistered: false
    }))
    setFaceDetected(false)
    setSkippedFaceRegistration(false)
    setFaceError(null)
    startCamera()
  }

  const skipFaceRegistration = () => {
    setSkippedFaceRegistration(true)
    stopCamera()
  }

  const fetchData = async () => {
    try {
      // Fetch employees
      const empRes = await fetch('/api/market/hr/employees?status=active')
      if (empRes.ok) {
        const data = await empRes.json()
        if (data.success) {
          setEmployees(data.data.employees.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            firstName: e.firstName || '',
            lastName: e.lastName || '',
            status: e.status
          })))
        }
      }

      // Fetch departments
      const deptRes = await fetch('/api/market/hr/departments?status=active')
      if (deptRes.ok) {
        const data = await deptRes.json()
        if (data.success) {
          setDepartments(data.data)
        }
      }

      // Fetch schedules
      const schedRes = await fetch('/api/market/hr/schedules?status=active')
      if (schedRes.ok) {
        const data = await schedRes.json()
        if (data.success) {
          setSchedules(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchContract = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/hr/contracts/${id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const c = result.data
          setFormData({
            employeeId: c.employeeId.toString(),
            position: c.position || '',
            contractType: c.contractType,
            startDate: c.startDate?.split('T')[0] || '',
            endDate: c.endDate?.split('T')[0] || '',
            departmentId: c.departmentId?.toString() || '',
            scheduleId: c.scheduleId?.toString() || '',
            payType: c.payType,
            payRate: c.payRate.toString(),
            currency: c.currency,
            commissionRate: c.commissionRate.toString(),
            notes: c.notes || '',
            photoOriginalPath: c.photoOriginalUrl || '',
            photoProcessedPath: c.photoUrl || '',
            employeeGender: null,
            faceEncoding: null,
            faceRegistered: false
          })
        }
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'employee':
        if (!formData.employeeId) {
          setError('Selecciona un empleado')
          return false
        }
        return true

      case 'contract':
        if (!formData.startDate) {
          setError('La fecha de inicio es requerida')
          return false
        }
        if (formData.contractType === 'temporal' && !formData.endDate) {
          setError('Para contratos temporales, la fecha de fin es requerida')
          return false
        }
        return true

      case 'compensation':
        if (!formData.payRate || parseFloat(formData.payRate) <= 0) {
          setError('El salario debe ser mayor a 0')
          return false
        }
        return true

      case 'photo':
        // Photo is optional
        return true

      case 'face-register':
        // Face registration is optional
        return true

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const saveContract = async () => {
    setSaving(true)
    setError('')

    try {
      const url = editId
        ? `/api/market/hr/contracts/${editId}`
        : '/api/market/hr/contracts'

      const response = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(formData.employeeId),
          contractType: formData.contractType,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          payType: formData.payType,
          payRate: parseFloat(formData.payRate),
          currency: formData.currency,
          commissionRate: parseFloat(formData.commissionRate) || 0,
          departmentId: formData.departmentId ? parseInt(formData.departmentId) : null,
          scheduleId: formData.scheduleId ? parseInt(formData.scheduleId) : null,
          position: formData.position || null,
          notes: formData.notes || null,
          photoUrl: formData.photoProcessedPath || null,
          photoOriginalUrl: formData.photoOriginalPath || null
        })
      })

      const result = await response.json()

      if (result.success) {
        // If face encoding was captured, register it
        if (formData.faceEncoding && formData.employeeId) {
          try {
            await fetch(`/api/market/hr/employees/${formData.employeeId}/register-face`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                faceEncoding: formData.faceEncoding,
                photoUrl: formData.photoProcessedPath || null
              })
            })
          } catch (faceError) {
            console.error('Error registering face (contract saved):', faceError)
            // Don't fail the whole operation if face registration fails
          }
        }

        router.push('/dashboard/market/hr/contracts')
      } else {
        setError(result.error || 'Error al guardar contrato')
      }
    } catch (error) {
      console.error('Error saving contract:', error)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getContractTypeLabel = (value: string) => {
    return CONTRACT_TYPES.find(t => t.value === value)?.label || value
  }

  const getPayTypeLabel = (value: string) => {
    return PAY_TYPES.find(p => p.value === value)?.label || value
  }

  const getDepartmentName = (id: string) => {
    return departments.find(d => d.id.toString() === id)?.name || 'No asignado'
  }

  const getScheduleName = (id: string) => {
    return schedules.find(s => s.id.toString() === id)?.name || 'No asignado'
  }

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen pt-16 pb-20 px-4 flex items-center justify-center",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Cargando datos...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">
        {/* Close Button */}
        <motion.button
          onClick={() => setShowCancelModal(true)}
          className={cn(
            "absolute -top-2 right-0 sm:right-0 p-2 rounded-full transition-colors z-10",
            theme === 'dark'
              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 shadow-sm'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="text-center">
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {isEditMode ? 'Editar Contrato' : 'Nuevo Contrato'}
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {isEditMode ? 'Modifique los datos del contrato' : 'Complete los datos del nuevo contrato de trabajo'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStepIndex > index

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {/* Pulsing ring for active step */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-amber-500"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "relative w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-amber-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#22c55e'
                          : isActive
                            ? '#d97706'
                            : theme === 'dark'
                              ? '#1f2937'
                              : '#e5e7eb'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block text-center font-medium",
                    isActive
                      ? 'text-amber-600'
                      : isCompleted
                        ? 'text-green-600'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="relative w-8 sm:w-16 lg:w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
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
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className={cn(
          "rounded-2xl shadow-lg p-6",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <AnimatePresence mode="wait">
            {/* Step 1: Employee */}
            {currentStep === 'employee' && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Seleccionar Empleado
                </h2>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-3",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Empleado *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employees.map(emp => (
                      <div
                        key={emp.id}
                        onClick={() => !isEditMode && updateFormData('employeeId', emp.id.toString())}
                        className={cn(
                          "p-4 border-2 rounded-xl transition-all",
                          isEditMode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                          formData.employeeId === emp.id.toString()
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            formData.employeeId === emp.id.toString()
                              ? 'bg-amber-100 dark:bg-amber-800'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <User className={cn(
                              "w-5 h-5",
                              formData.employeeId === emp.id.toString()
                                ? 'text-amber-600'
                                : 'text-gray-400'
                            )} />
                          </div>
                          <div>
                            <h4 className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {emp.fullName}
                            </h4>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              {emp.employeeCode}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {employees.length === 0 && (
                    <div className="text-center py-8">
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        No hay empleados activos disponibles
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Cargo / Posición
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => updateFormData('position', e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl",
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                    placeholder="Ej: Vendedor, Cajero, Gerente"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Contract Details */}
            {currentStep === 'contract' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Detalles del Contrato
                </h2>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-3",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Tipo de Contrato *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {CONTRACT_TYPES.map(type => (
                      <div
                        key={type.value}
                        onClick={() => updateFormData('contractType', type.value)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          formData.contractType === type.value
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        )}
                      >
                        <h4 className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {type.label}
                        </h4>
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {type.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Fecha de Inicio *
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData('startDate', e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Fecha de Fin {formData.contractType === 'temporal' && '*'}
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData('endDate', e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                    {formData.contractType === 'indefinido' && (
                      <p className={cn(
                        "text-xs mt-1",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        Dejar vacío para contrato indefinido
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "flex items-center gap-2 text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Building2 className="w-4 h-4" />
                      Departamento
                    </label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => updateFormData('departmentId', e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    >
                      <option value="">Sin asignar</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} {dept.code && `(${dept.code})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cn(
                      "flex items-center gap-2 text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Clock className="w-4 h-4" />
                      Horario
                    </label>
                    <select
                      value={formData.scheduleId}
                      onChange={(e) => updateFormData('scheduleId', e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    >
                      <option value="">Sin asignar</option>
                      {schedules.map(sched => (
                        <option key={sched.id} value={sched.id}>
                          {sched.name} ({sched.weeklyHours}h/semana)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Compensation */}
            {currentStep === 'compensation' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Compensación
                </h2>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-3",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Tipo de Pago *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PAY_TYPES.map(payType => (
                      <div
                        key={payType.value}
                        onClick={() => updateFormData('payType', payType.value)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          formData.payType === payType.value
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        )}
                      >
                        <h4 className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {payType.label}
                        </h4>
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {payType.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Salario *
                    </label>
                    <input
                      type="number"
                      value={formData.payRate}
                      onChange={(e) => updateFormData('payRate', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Moneda
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => updateFormData('currency', e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    >
                      <option value="USD">USD</option>
                      <option value="CUP">CUP</option>
                      <option value="MLC">MLC</option>
                    </select>
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Comisión (%)
                    </label>
                    <input
                      type="number"
                      value={formData.commissionRate}
                      onChange={(e) => updateFormData('commissionRate', e.target.value)}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateFormData('notes', e.target.value)}
                    rows={3}
                    placeholder="Notas adicionales sobre el contrato..."
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl resize-none",
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4: Photo */}
            {currentStep === 'photo' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Foto del Empleado
                </h2>
                <p className={cn(
                  "text-sm mb-6",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Opcional: Sube una foto del empleado para procesarla con IA (remover fondo, agregar traje formal)
                </p>

                <EmployeePhotoUpload
                  employeeId={parseInt(formData.employeeId) || 0}
                  employeeName={selectedEmployee?.fullName || ''}
                  employeeGender={formData.employeeGender}
                  currentPhotoUrl={formData.photoProcessedPath}
                  onPhotoProcessed={(originalPath, processedPath, processedBase64) => {
                    setFormData(prev => ({
                      ...prev,
                      photoOriginalPath: originalPath,
                      photoProcessedPath: processedPath
                    }))
                  }}
                  onGenderChange={(gender) => updateFormData('employeeGender', gender)}
                />
              </motion.div>
            )}

            {/* Step 5: Face Registration for Kiosk */}
            {currentStep === 'face-register' && (
              <motion.div
                key="step5-face"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Registro Facial para Kiosco
                </h2>
                <p className={cn(
                  "text-sm mb-6",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Opcional: Registre el rostro del empleado para que pueda usar el kiosco de asistencia
                </p>

                {/* Already registered state */}
                {formData.faceRegistered && (
                  <div className={cn(
                    "rounded-xl p-6 text-center",
                    theme === 'dark' ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                  )}>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className={cn(
                      "font-bold text-lg mb-2",
                      theme === 'dark' ? 'text-green-400' : 'text-green-700'
                    )}>
                      Rostro Registrado
                    </h3>
                    <p className={cn(
                      "text-sm mb-4",
                      theme === 'dark' ? 'text-green-300' : 'text-green-600'
                    )}>
                      El empleado podrá usar el kiosco con reconocimiento facial
                    </p>
                    <button
                      onClick={resetFaceRegistration}
                      className="text-sm text-green-600 hover:text-green-700 underline"
                    >
                      Volver a capturar
                    </button>
                  </div>
                )}

                {/* Skipped state */}
                {skippedFaceRegistration && !formData.faceRegistered && (
                  <div className={cn(
                    "rounded-xl p-6 text-center",
                    theme === 'dark' ? 'bg-amber-900/30 border border-amber-700' : 'bg-amber-50 border border-amber-200'
                  )}>
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className={cn(
                      "font-bold text-lg mb-2",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                    )}>
                      Registro Omitido
                    </h3>
                    <p className={cn(
                      "text-sm mb-4",
                      theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
                    )}>
                      Sin registro facial, el empleado no podrá usar el kiosco de asistencia.
                      Un manager deberá marcar su asistencia manualmente.
                    </p>
                    <button
                      onClick={resetFaceRegistration}
                      className="text-sm text-amber-600 hover:text-amber-700 underline"
                    >
                      Registrar ahora
                    </button>
                  </div>
                )}

                {/* Camera capture state */}
                {!formData.faceRegistered && !skippedFaceRegistration && (
                  <div className="space-y-4">
                    {/* Loading models */}
                    {modelsLoading && (
                      <div className={cn(
                        "rounded-xl p-6 text-center",
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                      )}>
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-amber-600" />
                        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Cargando modelo de reconocimiento facial...
                        </p>
                      </div>
                    )}

                    {/* Model error */}
                    {modelError && !modelsLoading && (
                      <div className={cn(
                        "rounded-xl p-4 border",
                        theme === 'dark' ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                      )}>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )}>
                          {modelError}
                        </p>
                      </div>
                    )}

                    {/* Camera view - iPhone style face registration */}
                    {isModelLoaded && (
                      <>
                        <div className={cn(
                          "relative rounded-2xl overflow-hidden aspect-[3/4] max-w-sm mx-auto",
                          theme === 'dark' ? 'bg-gray-900' : 'bg-black'
                        )}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover transform -scale-x-100"
                          />

                          {/* iPhone-style face frame overlay */}
                          {cameraActive && !capturingFace && (
                            <div className="absolute inset-0 pointer-events-none">
                              {/* Dark overlay with cutout */}
                              <svg className="absolute inset-0 w-full h-full">
                                <defs>
                                  <mask id="faceMask">
                                    <rect width="100%" height="100%" fill="white" />
                                    <ellipse
                                      cx="50%"
                                      cy="42%"
                                      rx="35%"
                                      ry="32%"
                                      fill="black"
                                    />
                                  </mask>
                                </defs>
                                <rect
                                  width="100%"
                                  height="100%"
                                  fill="rgba(0,0,0,0.6)"
                                  mask="url(#faceMask)"
                                />
                                {/* Animated border around face area */}
                                <ellipse
                                  cx="50%"
                                  cy="42%"
                                  rx="35%"
                                  ry="32%"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.8)"
                                  strokeWidth="3"
                                  strokeDasharray="8 4"
                                  className="animate-pulse"
                                />
                              </svg>

                              {/* Instructions */}
                              <div className="absolute bottom-8 left-0 right-0 text-center">
                                <p className="text-white text-sm font-medium px-4 py-2 bg-black/50 rounded-full mx-auto inline-block">
                                  Coloque su rostro dentro del marco
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Camera not active overlay */}
                          {!cameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                              <div className="text-center">
                                <Camera className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                                <p className="text-gray-400">Iniciando cámara...</p>
                              </div>
                            </div>
                          )}

                          {/* Capture indicator */}
                          {capturingFace && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                              <div className="text-center">
                                <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-white font-medium text-lg">Analizando rostro...</p>
                                <p className="text-white/70 text-sm mt-1">No se mueva</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Error message */}
                        {faceError && (
                          <div className={cn(
                            "rounded-xl p-4 border",
                            theme === 'dark' ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                          )}>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-red-400' : 'text-red-600'
                            )}>
                              {faceError}
                            </p>
                          </div>
                        )}

                        {/* Capture button */}
                        <div className="flex gap-3">
                          <button
                            onClick={captureFace}
                            disabled={!cameraActive || capturingFace}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors",
                              "bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            <Scan className="w-5 h-5" />
                            Capturar Rostro
                          </button>
                          <button
                            onClick={skipFaceRegistration}
                            className={cn(
                              "px-4 py-3 rounded-xl font-medium transition-colors",
                              theme === 'dark'
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                          >
                            Omitir
                          </button>
                        </div>

                        <p className={cn(
                          "text-xs text-center",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Asegúrese de que el empleado esté bien iluminado y mirando directamente a la cámara
                        </p>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === 'confirm' && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Confirmar Datos
                </h2>

                <div className="space-y-6">
                  {/* Employee Summary */}
                  <div className={cn(
                    "rounded-xl p-4",
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      "font-medium mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <User className="w-5 h-5 text-amber-600" />
                      Empleado
                    </h3>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Nombre
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedEmployee?.fullName || '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Cargo
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.position || 'No especificado'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Contract Summary */}
                  <div className={cn(
                    "rounded-xl p-4",
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      "font-medium mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <FileText className="w-5 h-5 text-amber-600" />
                      Contrato
                    </h3>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Tipo
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {getContractTypeLabel(formData.contractType)}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Inicio
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.startDate ? new Date(formData.startDate).toLocaleDateString('es-ES') : '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Fin
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.endDate ? new Date(formData.endDate).toLocaleDateString('es-ES') : 'Indefinido'}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Departamento
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {getDepartmentName(formData.departmentId)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Compensation Summary */}
                  <div className={cn(
                    "rounded-xl p-4",
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      "font-medium mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <DollarSign className="w-5 h-5 text-amber-600" />
                      Compensación
                    </h3>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Tipo de Pago
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {getPayTypeLabel(formData.payType)}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Salario
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.currency} {parseFloat(formData.payRate || '0').toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Comisión
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.commissionRate ? `${formData.commissionRate}%` : 'Sin comisión'}
                        </dd>
                      </div>
                      <div>
                        <dt className={cn(theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Horario
                        </dt>
                        <dd className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {getScheduleName(formData.scheduleId)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Photo Summary */}
                  <div className={cn(
                    "rounded-xl p-4",
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      "font-medium mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <Camera className="w-5 h-5 text-amber-600" />
                      Foto
                    </h3>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {formData.photoProcessedPath
                        ? 'Foto procesada con IA incluida'
                        : 'Sin foto adjunta'}
                    </p>
                  </div>

                  {/* Face Registration Summary */}
                  <div className={cn(
                    "rounded-xl p-4",
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      "font-medium mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <Scan className="w-5 h-5 text-amber-600" />
                      Registro Facial (Kiosco)
                    </h3>
                    <p className={cn(
                      "text-sm",
                      formData.faceRegistered
                        ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        : theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>
                      {formData.faceRegistered
                        ? 'Rostro registrado - Puede usar el kiosco'
                        : 'Sin registro facial - Solo asistencia manual por manager'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={cn(
            "flex items-center justify-between mt-8 pt-6 border-t",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <motion.button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
              )}
              whileHover={currentStepIndex > 0 ? { scale: 1.02 } : {}}
              whileTap={currentStepIndex > 0 ? { scale: 0.98 } : {}}
            >
              <ArrowLeft className="w-5 h-5" />
              Anterior
            </motion.button>

            {currentStepIndex < STEPS.length - 1 ? (
              <motion.button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                onClick={saveContract}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                whileHover={!saving ? { scale: 1.02 } : {}}
                whileTap={!saving ? { scale: 0.98 } : {}}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isEditMode ? 'Guardando...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {isEditMode ? 'Guardar Cambios' : 'Crear Contrato'}
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn(
                "text-lg font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {isEditMode ? '¿Cancelar edición?' : '¿Cancelar creación?'}
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {isEditMode
                  ? 'Perderás los cambios realizados. ¿Estás seguro?'
                  : 'Perderás todos los datos ingresados. ¿Estás seguro?'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/hr/contracts')}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
