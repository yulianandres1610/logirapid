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

  // Create user form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
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
        setUsers(data.data.users)
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
    const matchesSearch = user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm) ||
                         user.city.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || user.role === selectedFilter
    return matchesSearch && matchesFilter
  })

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      role: 'user',
      assignedCompanies: [],
      password: '',
      confirmPassword: '',
      isActive: true,
      sendEmail: true
    })
    setCurrentStep(1)
  }

  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            country: formData.country,
            role: formData.role,
            password: formData.password,
            isActive: formData.isActive,
            sendEmail: formData.sendEmail
          },
          assignedCompanies: formData.assignedCompanies
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Reload data
        await loadData()

        setShowCreateForm(false)
        resetForm()

        alert(`Usuario creado exitosamente!${data.data.message ? '\n' + data.data.message : ''}`)
      } else {
        alert('Error al crear usuario: ' + data.error)
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Error al crear usuario. Intente nuevamente.')
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
                  Crear Nuevo Usuario
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Completa el formulario para registrar un nuevo usuario en el sistema
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

                    <div className="md:col-span-2">
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Dirección *
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Calle 23 #456, Vedado"
                      />
                    </div>

                    <div className="md:col-span-2">
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
                onClick={handleCreateUser}
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
                Crear Usuario
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
        <div className="max-w-7xl mx-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className={cn(
                  "w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4",
                  theme === 'dark' ? "border-blue-400" : "border-blue-600"
                )}></div>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Cargando usuarios...
                </p>
              </div>
            </div>
          ) : (
          <>
          {/* Header */}
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
                  Usuarios Registrados
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Gestiona todos los usuarios del sistema
                </p>
              </div>

              <Button
                onClick={() => setShowCreateForm(true)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark' ? "bg-exa-secondary text-white hover:bg-exa-secondary/90" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                )}
              >
                <Plus className="w-5 h-5" />
                Nuevo Usuario
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    theme === 'dark' ? "bg-blue-600/20" : "bg-blue-500/20"
                  )}>
                    <Users className={cn(
                      "w-6 h-6",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      {users.length}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Total Usuarios
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    theme === 'dark' ? "bg-green-500/20" : "bg-green-500/20"
                  )}>
                    <Activity className={cn(
                      "w-6 h-6",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      {users.filter(u => u.status === 'active').length}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Activos
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? "bg-blue-500/20" : "bg-blue-500/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                  )}>
                    <Building2 className={cn(
                      "w-6 h-6",
                      theme === 'dark' ? "text-purple-400" : "text-purple-600"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      {users.reduce((sum, u) => sum + u.companies.length, 0)}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Asignaciones
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                  )}>
                    <TrendingUp className={cn(
                      "w-6 h-6",
                      theme === 'dark' ? "text-purple-400" : "text-purple-600"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      {users.reduce((sum, u) => sum + u.transactionsCount, 0)}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Transacciones
                    </p>
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
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFilter('all')}
                  className={cn(
                    selectedFilter === 'all'
                      ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                      : theme === 'dark' ? "border-gray-700 text-gray-300" : "border-gray-300 text-gray-700"
                  )}
                >
                  Todos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedFilter('user')}
                  className={cn(
                    selectedFilter === 'user'
                      ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                      : theme === 'dark' ? "border-gray-700 text-gray-300" : "border-gray-300 text-gray-700"
                  )}
                >
                  Usuarios
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedFilter('admin')}
                  className={cn(
                    selectedFilter === 'admin'
                      ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                      : theme === 'dark' ? "border-gray-700 text-gray-300" : "border-gray-300 text-gray-700"
                  )}
                >
                  Admins
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={cn(
                  "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}
                onClick={() => setSelectedUser(user)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-blue-600/20" : "bg-blue-500/20"
                    )}>
                      <User className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-blue-400" : "text-blue-600"
                      )} />
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-bold text-lg",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {user.firstName} {user.lastName}
                      </h3>
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          user.status === 'active' ? "bg-green-500" : "bg-red-500"
                        )} />
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Shield className={cn(
                      "w-4 h-4",
                      user.role === 'super_admin' ? "text-purple-500" : user.role === 'admin' ? "text-blue-500" : "text-gray-500"
                    )} />
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-lg",
                      user.role === 'super_admin' ? theme === 'dark' ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-800" :
                      user.role === 'admin' ? theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-800" :
                      theme === 'dark' ? "bg-gray-700/20 text-gray-400" : "bg-gray-100 text-gray-800"
                    )}>
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Usuario'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {user.email}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {user.phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className={cn(
                      "w-4 h-4",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )} />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {user.city}, {user.country}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className={cn(
                    "p-2 rounded-lg text-center",
                    theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
                  )}>
                    <p className={cn(
                      "text-xs font-bold",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )}>
                      {user.transactionsCount}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Transacciones
                    </p>
                  </div>
                  <div className={cn(
                    "p-2 rounded-lg text-center",
                    theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
                  )}>
                    <p className={cn(
                      "text-xs font-bold",
                      theme === 'dark' ? "text-purple-400" : "text-purple-600"
                    )}>
                      {user.companies.length}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Empresas
                    </p>
                  </div>
                </div>

                {/* Companies */}
                <div className="flex flex-wrap gap-1">
                  {user.companies.slice(0, 2).map((company: any, idx: number) => (
                    <span
                      key={idx}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs",
                        theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/10 text-exa-primary"
                      )}
                    >
                      {company}
                    </span>
                  ))}
                  {user.companies.length > 2 && (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs",
                      theme === 'dark' ? "bg-gray-700/20 text-gray-400" : "bg-gray-100 text-gray-600"
                    )}>
                      +{user.companies.length - 2}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
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
                              selectedUser.role === 'super_admin' ? theme === 'dark' ? "bg-purple-500/20" : "bg-purple-100" :
                              selectedUser.role === 'admin' ? theme === 'dark' ? "bg-blue-500/20" : "bg-blue-100" :
                              theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                            )}>
                              {selectedUser.role === 'super_admin' ? 'Super Admin' : selectedUser.role === 'admin' ? 'Administrador' : 'Usuario'}
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
                              {selectedUser.address}, {selectedUser.city}, {selectedUser.country}
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
          </>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}