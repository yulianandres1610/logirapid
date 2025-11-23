'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Building2,
  TrendingUp,
  Settings,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Globe,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Activity,
  Zap,
  Shield,
  Star,
  UserCheck,
  User,
  Lock,
  Key,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'
import Spinner from '@/components/ui/Spinner'
// Las funciones de base de datos ahora se manejan a través de API routes

// Mock data for registered users
const MOCK_USERS = [
  {
    id: 1,
    firstName: 'María',
    lastName: 'García',
    email: 'maria.garcia@ejemplo.com',
    phone: '+53 5 12345678',
    address: 'Calle 23 #456, Vedado',
    city: 'La Habana',
    country: 'Cuba',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2024-01-20',
    companies: ['CubaExpress S.A.'],
    transactionsCount: 142
  },
  {
    id: 2,
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    email: 'carlos.rodriguez@ejemplo.com',
    phone: '+1 809 555 0123',
    address: 'Avenida Churchill #123',
    city: 'Santo Domingo',
    country: 'República Dominicana',
    role: 'user',
    status: 'active',
    createdAt: '2024-02-20',
    lastLogin: '2024-01-19',
    companies: ['CaribbeanMarket Ltd.'],
    transactionsCount: 89
  },
  {
    id: 3,
    firstName: 'Ana',
    lastName: 'Martínez',
    email: 'ana.martinez@ejemplo.com',
    phone: '+1 305 888 9999',
    address: 'Brickell Ave #789',
    city: 'Miami',
    country: 'Estados Unidos',
    role: 'user',
    status: 'active',
    createdAt: '2024-03-10',
    lastLogin: '2024-01-18',
    companies: ['GlobalRemit Corp.'],
    transactionsCount: 234
  },
  {
    id: 4,
    firstName: 'Luis',
    lastName: 'Hernández',
    email: 'luis.hernandez@ejemplo.com',
    phone: '+53 7 456 7890',
    address: 'Calle 8 #234, Centro Habana',
    city: 'La Habana',
    country: 'Cuba',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-05',
    lastLogin: '2024-01-20',
    companies: ['Todas'],
    transactionsCount: 567
  }
]

// Mock companies for user assignment
const MOCK_COMPANIES = [
  { id: 1, name: 'CubaExpress S.A.', type: 'agency' },
  { id: 2, name: 'CaribbeanMarket Ltd.', type: 'market' },
  { id: 3, name: 'GlobalRemit Corp.', type: 'broker' },
  { id: 4, name: 'Todas', type: 'all' }
]

// User creation form steps
const USER_STEPS = [
  { id: 1, title: 'Información Personal', icon: User },
  { id: 2, title: 'Contacto y Ubicación', icon: MapPin },
  { id: 3, title: 'Empresas', icon: Building2 },
  { id: 4, title: 'Credenciales', icon: Key },
  { id: 5, title: 'Revisión', icon: Check }
]

const USER_ROLES = [
  { id: 'user', name: 'Usuario', description: 'Acceso básico al sistema' },
  { id: 'driver', name: 'Driver', description: 'Conduce y gestiona entregas' },
  { id: 'admin', name: 'Administrador', description: 'Acceso completo de gestión' },
  { id: 'super_admin', name: 'Super Admin', description: 'Acceso total al sistema' }
]

export default function UsersPage() {
  const { theme } = useTheme()
  const [users, setUsers] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '', submitting: false })

  // Create user form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    id: null,
    editMode: false,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    addressData: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    latitude: null,
    longitude: null,
    role: 'user',
    assignedCompanies: [],
    password: '',
    confirmPassword: '',
    isActive: true,
    sendEmail: true
  })

  // Load users and companies on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch('/api/users?includeCompanies=true')
      const data = await response.json()

      if (data.success) {
        const normalizedUsers = (data.data.users || []).map((u: any) => ({
          ...u,
          companies: u.companies || [],
          transactionsCount: u.transactionsCount || 0
        }))
        setUsers(normalizedUsers)
        setCompanies(data.data.companies || [])
      } else {
        console.error('Error loading data:', data.error)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }


  const filteredUsers = users.filter(user => {
    const role = (user.role || '').toLowerCase()
    const matchesSearch = (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.phone || '').includes(searchTerm) ||
                         (user.city || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || role === selectedFilter
    return matchesSearch && matchesFilter
  })

  const resetForm = () => {
    setFormData({
      id: null,
      editMode: false,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      addressData: {
        street: '',
        apartment: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      latitude: null,
      longitude: null,
      role: 'user',
      assignedCompanies: [],
      password: '',
      confirmPassword: '',
      isActive: true,
      sendEmail: true
    })
    setCurrentStep(1)
  }

  const handleAddressChange = (addressData: any) => {
    setFormData((prev: any) => ({
      ...prev,
      addressData,
      address: addressData.street || '',
      apartment: addressData.apartment || '',
      city: addressData.city || '',
      state: addressData.state || '',
      zipCode: addressData.zipCode || '',
      country: addressData.country || ''
    }))
  }

  const handleCoordinatesChange = (coordinates: { latitude: number; longitude: number } | null) => {
    setFormData((prev: any) => ({
      ...prev,
      latitude: coordinates?.latitude || null,
      longitude: coordinates?.longitude || null
    }))
  }

  const handleEditUser = (user: any) => {
    setFormData({
      id: user.id,
      editMode: true,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      apartment: user.apartment || '',
      city: user.city || '',
      state: user.state || '',
      zipCode: user.zipCode || '',
      country: user.country || '',
      addressData: {
        street: user.address || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        country: user.country || ''
      },
      latitude: user.latitude || null,
      longitude: user.longitude || null,
      role: (user.role || 'user').toLowerCase(),
      assignedCompanies: user.companyIds || [],
      password: '',
      confirmPassword: '',
      isActive: user.status === 'active' || user.isActive,
      sendEmail: false
    })
    setShowCreateForm(true)
    setCurrentStep(1)
  }

  const handleDeleteUser = async (user: any) => {
    const confirmed = confirm(`¿Eliminar a ${user.firstName} ${user.lastName}? Esta acción es permanente.`)
    if (!confirmed) return

    try {
      setLoading(true)
      const response = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' })
      const data = await response.json()

      if (!data.success) {
        alert(data.error || 'No se pudo eliminar el usuario')
      } else {
        await loadData()
        setSelectedUser(null)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error al eliminar usuario.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUser = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      alert('Nombre, apellido y correo son obligatorios.')
      return
    }

    if (!formData.editMode) {
      if (!formData.password || formData.password !== formData.confirmPassword) {
        alert('Las contraseñas no coinciden o están vacías.')
        return
      }
    }

    const addressLine = formData.addressData?.street || formData.address || ''
    const cityValue = formData.city || formData.addressData?.city || ''
    const countryValue = formData.country || formData.addressData?.country || ''

    const payloadUser = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: addressLine,
      city: cityValue,
      country: countryValue,
      role: (formData.role || 'user').toUpperCase(),
      password: formData.editMode ? undefined : formData.password,
      isActive: formData.isActive,
      sendEmail: formData.sendEmail
    }

    try {
      const response = await fetch('/api/users', {
        method: formData.editMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          formData.editMode
            ? { id: formData.id, ...payloadUser, assignedCompanies: formData.assignedCompanies }
            : { user: payloadUser, assignedCompanies: formData.assignedCompanies }
        ),
      })

      const data = await response.json()

      if (data.success) {
        await loadData()
        setShowCreateForm(false)
        resetForm()
        alert(`Usuario ${formData.editMode ? 'actualizado' : 'creado'} exitosamente!${data.data?.message ? '\n' + data.data.message : ''}`)
      } else {
        alert('Error al guardar usuario: ' + data.error)
      }
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Error al guardar usuario. Intente nuevamente.')
    }
  }

  const openPasswordModal = (user: any) => {
    setSelectedUser(user)
    setPasswordForm({ newPassword: '', confirmPassword: '', submitting: false })
    setShowPasswordModal(true)
  }

  const handleChangePassword = async () => {
    if (!selectedUser) return
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Las contraseñas no coinciden.')
      return
    }

    try {
      setPasswordForm(prev => ({ ...prev, submitting: true }))
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id, password: passwordForm.newPassword })
      })
      const data = await response.json()
      if (!data.success) {
        alert(data.error || 'No se pudo actualizar la contraseña')
      } else {
        alert('Contraseña actualizada correctamente')
        setShowPasswordModal(false)
        setPasswordForm({ newPassword: '', confirmPassword: '', submitting: false })
      }
    } catch (error) {
      console.error('Error cambiando contraseña:', error)
      alert('Error al cambiar la contraseña.')
    } finally {
      setPasswordForm(prev => ({ ...prev, submitting: false }))
    }
  }

  return (
    <DashboardLayout>
      {showCreateForm ? (
        // User Creation Form View
        <div className="max-w-6xl mx-auto p-6">
          {/* Form Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  {formData.editMode ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {formData.editMode
                    ? 'Actualiza la información del usuario seleccionado'
                    : 'Completa el formulario para registrar un nuevo usuario en el sistema'}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                }}
                className={cn(
                  theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {USER_STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex items-center">
                      <motion.div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                          currentStep === step.id
                            ? theme === 'dark' ? "bg-exa-secondary text-white" : "bg-exa-primary text-white"
                            : currentStep > step.id
                              ? theme === 'dark' ? "bg-green-500 text-white" : "bg-green-500 text-white"
                              : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
                        )}
                        whileHover={{ scale: 1.1 }}
                      >
                        {currentStep > step.id ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <step.icon className="w-5 h-5" />
                        )}
                      </motion.div>
                      <div className="ml-3 hidden sm:block">
                        <p className={cn(
                          "text-xs font-medium",
                          currentStep === step.id
                            ? theme === 'dark' ? "text-white" : "text-black"
                            : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {step.title}
                        </p>
                      </div>
                    </div>
                    {index < USER_STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-1 mx-4",
                        currentStep > step.id
                          ? theme === 'dark' ? "bg-blue-600" : "bg-blue-500"
                          : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Información Personal
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Juan"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Apellido *
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Pérez"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="juan@ejemplo.com"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Rol de Usuario *
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                      >
                        {USER_ROLES.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact and Location */}
              {currentStep === 2 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                )}>
                  Contacto y Ubicación
                </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="+53 5 12345678"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Dirección con Mapbox *
                      </label>
                      <MapboxAddressAutofill
                        value={formData.addressData}
                        onChange={handleAddressChange}
                        onCoordinatesChange={handleCoordinatesChange}
                        required
                        className={cn(
                          "rounded-xl border",
                          theme === 'dark' ? "border-white/10" : "border-gray-200"
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Ciudad *
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="La Habana"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Estado/Provincia
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Provincia"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Código Postal
                      </label>
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="00000"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        País *
                      </label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Cuba"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Companies Assignment */}
              {currentStep === 3 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Asignación de Empresas
                  </h2>

                  {formData.role === 'super_admin' ? (
                    <div className={cn(
                      "p-6 rounded-xl border",
                      theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-300 bg-gray-50"
                    )}>
                      <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className={cn(
                          "w-6 h-6",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )} />
                        <div>
                          <p className={cn(
                            "font-semibold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Acceso Super Admin
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Este rol tiene acceso a todas las empresas por defecto
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Selecciona las empresas a las que este usuario tendrá acceso:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {companies.map((company: any) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              const newCompanies = formData.assignedCompanies.includes(company.id)
                                ? formData.assignedCompanies.filter((c: number) => c !== company.id)
                                : [...formData.assignedCompanies, company.id]
                              setFormData({...formData, assignedCompanies: newCompanies})
                            }}
                            className={cn(
                              "p-4 rounded-xl border transition-all duration-300 text-left",
                              formData.assignedCompanies.includes(company.id)
                                ? theme === 'dark' ? "border-blue-500 bg-blue-500/20" : "border-blue-500 bg-blue-50"
                                : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                formData.assignedCompanies.includes(company.id)
                                  ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                                  : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                              )}>
                                <Building2 className={cn(
                                  "w-5 h-5",
                                  formData.assignedCompanies.includes(company.id) ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )} />
                              </div>
                              <div>
                                <h3 className={cn(
                                  "font-bold",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {company.legalName}
                                </h3>
                                <p className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {company.type === 'agency' ? 'Agencia' : company.type === 'market' ? 'Mercado' : company.type === 'broker' ? 'Broker' : 'Todas'}
                                </p>
                              </div>
                            </div>
                            {formData.assignedCompanies.includes(company.id) && (
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary")}>
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Credentials */}
              {currentStep === 4 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Credenciales de Acceso
                  </h2>

                  <div className="space-y-6">
                    {formData.editMode && (
                      <div className={cn(
                        "p-4 rounded-xl border",
                        theme === 'dark' ? "border-yellow-600/40 bg-yellow-500/5 text-yellow-200" : "border-yellow-200 bg-yellow-50 text-yellow-700"
                      )}>
                        Este usuario ya existe. Para cambiar contraseña usa la opción "Cambiar contraseña" en el detalle.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Contraseña *
                        </label>
                        <div className="relative">
                          <Lock className={cn(
                            "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )} />
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            disabled={formData.editMode}
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                            )}
                            placeholder="********"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Confirmar Contraseña *
                        </label>
                        <div className="relative">
                          <Lock className={cn(
                            "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )} />
                          <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                            disabled={formData.editMode}
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                            )}
                            placeholder="********"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setFormData({...formData, sendEmail: !formData.sendEmail})}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                          formData.sendEmail ? (theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary") : "bg-gray-300"
                        )}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.sendEmail ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                      <div>
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Enviar credenciales por correo
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Se enviará un email con las credenciales de acceso
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Revisión Final
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información Personal
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Nombre Completo:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.firstName} {formData.lastName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Correo:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.email}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Rol:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {USER_ROLES.find(r => r.id === formData.role)?.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de Contacto
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Teléfono:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.phone}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Ubicación:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.city}, {formData.country}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Empresas Asignadas
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {formData.role === 'super_admin' ? (
                          <span className={cn(
                            "px-3 py-1 rounded-full text-sm",
                            theme === 'dark' ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-800"
                          )}>
                            Todas las empresas (Super Admin)
                          </span>
                        ) : (
                          <>
                            {formData.assignedCompanies.map((companyId: number) => {
                              const company = companies.find(c => c.id === companyId)
                              return company ? (
                                <span
                                  key={companyId}
                                  className={cn(
                                    "px-3 py-1 rounded-full text-sm",
                                    theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/10 text-exa-primary"
                                  )}
                                >
                                  {company.legalName}
                                </span>
                              ) : null
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <motion.button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={currentStep === 1}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                currentStep === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : theme === 'dark'
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </motion.button>

            {currentStep === USER_STEPS.length ? (
              <motion.button
                onClick={handleSaveUser}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                <Check className="w-4 h-4" />
                {formData.editMode ? 'Guardar Cambios' : 'Crear Usuario'}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setCurrentStep(Math.min(USER_STEPS.length, currentStep + 1))}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      ) : (
        // Users List View
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" text="Cargando usuarios..." />
            </div>
          ) : (
          <>
          {/* Stats Cards with Gradients */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="grid grid-cols-4 gap-5">
            {/* Total Usuarios */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Usuarios</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{users.length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Registrados</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Activos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Activity className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Activos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{users.filter(u => u.status === 'active').length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En línea</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Super Admins */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <Shield className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Super Admins</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{users.filter(u => (u.role || '').toLowerCase() === 'super_admin').length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Máximos privilegios</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Administradores */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-violet-900/30 border border-violet-800/50'
                        : 'bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200'
                    )}>
                      <UserCheck className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Administradores</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{users.filter(u => (u.role || '').toLowerCase() === 'admin').length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Gestión completa</span>
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "backdrop-blur-sm border rounded-2xl p-6 mb-6",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
            )}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className={cn(
                  "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-exa-secondary focus:ring-exa-secondary/20"
                      : "bg-white border-gray-300 text-black focus:border-exa-primary focus:ring-exa-primary/20"
                  )}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'all'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedFilter('super_admin')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'super_admin'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  SUPER_ADMIN
                </button>
                <button
                  onClick={() => setSelectedFilter('admin')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'admin'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  ADMIN
                </button>
                <button
                  onClick={() => setSelectedFilter('manager')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'manager'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  MANAGER
                </button>
                <button
                  onClick={() => setSelectedFilter('user')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'user'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  USER
                </button>
                <button
                  onClick={() => {
                    resetForm()
                    setShowCreateForm(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                  Crear Usuario
                </button>
              </div>
            </div>
          </motion.div>

          {/* Users Grid */}
          <div className="max-w-[1400px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUsers.map((user, index) => {
                const role = (user.role || '').toLowerCase()
                const borderColor = role === 'super_admin' ? 'border-l-purple-500' :
                                   role === 'admin' ? 'border-l-blue-500' :
                                   role === 'manager' ? 'border-l-green-500' :
                                   'border-l-gray-500'
                const badgeBorderColor = role === 'super_admin' ? 'border-purple-500 text-purple-600 dark:text-purple-400' :
                                        role === 'admin' ? 'border-blue-500 text-blue-600 dark:text-blue-400' :
                                        role === 'manager' ? 'border-green-500 text-green-600 dark:text-green-400' :
                                        'border-gray-500 text-gray-600 dark:text-gray-400'
                const iconColor = role === 'super_admin' ? 'text-purple-500' :
                                 role === 'admin' ? 'text-blue-500' :
                                 role === 'manager' ? 'text-green-500' :
                                 'text-gray-500'
                const roleLabel = role === 'super_admin' ? 'Super Admin' :
                                 role === 'admin' ? 'Admin' :
                                 role === 'manager' ? 'Manager' :
                                 role === 'driver' ? 'Driver' :
                                 'Usuario'

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border-l-4',
                      borderColor
                    )}
                  >
                    {/* Header */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Users className={cn("w-5 h-5 flex-shrink-0", iconColor)} />
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                          {user.firstName} {user.lastName}
                        </h3>
                      </div>
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                        badgeBorderColor
                      )}>
                        {roleLabel}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      {/* Email */}
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 text-xs">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Empresa */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Empresa</div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {user.companies && user.companies.length > 0 ? user.companies[0] : 'N/A'}
                          </div>
                        </div>

                        {/* Estado */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Estado</div>
                          <div className={cn(
                            "text-xs font-bold",
                            user.status === 'active' ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                          )}>
                            {user.status === 'active' ? 'Activo' : 'Inactivo'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer - Actions */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                      {/* Action Buttons */}
                      <div className="flex gap-1.5 w-full">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          disabled={loading}
                          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={loading}
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* User Detail Modal */}
          <AnimatePresence>
            {selectedUser && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedUser(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  {/* Detail Modal Content */}
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? "bg-blue-500/20" : "bg-blue-500/20"
                        )}>
                          <User className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                          )} />
                        </div>
                        <div>
                          <h2 className={cn(
                            "text-2xl font-bold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            {selectedUser.firstName} {selectedUser.lastName}
                          </h2>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              selectedUser.status === 'active' ? "bg-green-500" : "bg-red-500"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {selectedUser.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className={cn(
                              "text-sm px-2 py-1 rounded-lg",
                              (selectedUser.role || '').toLowerCase() === 'super_admin' ? theme === 'dark' ? "bg-purple-500/20" : "bg-purple-100" :
                              (selectedUser.role || '').toLowerCase() === 'admin' ? theme === 'dark' ? "bg-blue-500/20" : "bg-blue-100" :
                              (selectedUser.role || '').toLowerCase() === 'driver' ? theme === 'dark' ? "bg-amber-500/20" : "bg-amber-100" :
                              theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                            )}>
                              {(selectedUser.role || '').toLowerCase() === 'super_admin'
                                ? 'Super Admin'
                                : (selectedUser.role || '').toLowerCase() === 'admin'
                                  ? 'Administrador'
                                  : (selectedUser.role || '').toLowerCase() === 'driver'
                                    ? 'Driver'
                                    : 'Usuario'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedUser(null)}
                        className={cn(
                          "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        )}
                      >
                        <X className={cn(
                          "w-5 h-5",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleEditUser(selectedUser)
                          setSelectedUser(null)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openPasswordModal(selectedUser)}
                        className="flex items-center gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Cambiar contraseña
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteUser(selectedUser)}
                        className={cn(
                          "flex items-center gap-2",
                          theme === 'dark' ? "border-red-400 text-red-300" : "border-red-500 text-red-600"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de Contacto
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Mail className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedUser.email}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Phone className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedUser.phone}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <MapPin className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedUser.address}{selectedUser.apartment ? `, ${selectedUser.apartment}` : ''}{selectedUser.city ? `, ${selectedUser.city}` : ''}{selectedUser.state ? `, ${selectedUser.state}` : ''}{selectedUser.zipCode ? ` ${selectedUser.zipCode}` : ''}{selectedUser.country ? `, ${selectedUser.country}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Calendar className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Creado el {selectedUser.createdAt}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Activity className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Último login: {selectedUser.lastLogin}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Estadísticas
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          <div className={cn(
                            "p-4 rounded-xl text-center",
                            theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                          )}>
                            <Activity className={cn(
                              "w-6 h-6 mx-auto mb-2",
                              theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                            )} />
                            <p className={cn(
                              "text-xl font-bold",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {selectedUser.transactionsCount}
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Transacciones
                            </p>
                          </div>

                          <div className={cn(
                            "p-4 rounded-xl text-center",
                            theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                          )}>
                            <Building2 className={cn(
                              "w-6 h-6 mx-auto mb-2",
                              theme === 'dark' ? "text-purple-400" : "text-purple-600"
                            )} />
                            <p className={cn(
                              "text-xl font-bold",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {selectedUser.companies.length}
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Empresas
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Companies */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Empresas Asignadas
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.companies.map((company: any, index: number) => (
                          <div
                            key={index}
                            className={cn(
                              "px-4 py-2 rounded-xl border flex items-center gap-2",
                              theme === 'dark' ? "border-gray-700" : "border-gray-200"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center",
                              theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/10"
                            )}>
                              <Building2 className={cn(
                                "w-3 h-3",
                                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {company}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Change Password Modal */}
          <AnimatePresence>
            {showPasswordModal && selectedUser && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowPasswordModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-md rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-black")}>Cambiar contraseña</h2>
                      <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        Usuario: {selectedUser.firstName} {selectedUser.lastName}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-600")} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="********"
                      />
                    </div>

                    <div>
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                        Confirmar contraseña
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="********"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleChangePassword} loading={passwordForm.submitting}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
