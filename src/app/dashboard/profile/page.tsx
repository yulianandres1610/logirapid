'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  Clock,
  Shield,
  Camera,
  Save,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  X
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProfileData {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
  country: string
  zipcode: string
  avatar: string | null
  role: string
  companyId: number
  companyName: string
  companyType: string
  createdAt: string
  lastLogin: string
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  MANAGER: 'Manager',
  USER: 'Usuario',
  DRIVER: 'Conductor',
  MARKET_MANAGER: 'Manager de Market',
  MARKET_COMERCIAL: 'Comercial',
  MARKET_ALMACENERO: 'Almacenero',
  MARKET_VENDEDOR: 'Vendedor'
}

export default function ProfilePage() {
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipcode: ''
  })

  // Password states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/profile')
      const data = await response.json()

      if (data.success) {
        setProfile(data.data)
        setFormData({
          firstName: data.data.firstName || '',
          lastName: data.data.lastName || '',
          phone: data.data.phone || '',
          address: data.data.address || '',
          city: data.data.city || '',
          state: data.data.state || '',
          country: data.data.country || '',
          zipcode: data.data.zipcode || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setErrorMessage('Error al cargar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setProfile(data.data)
        setSuccessMessage('Perfil actualizado exitosamente')
        // Update localStorage
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          const user = JSON.parse(storedUser)
          user.name = `${formData.firstName} ${formData.lastName}`.trim() || user.email
          user.avatar = data.data.avatar
          localStorage.setItem('user', JSON.stringify(user))
        }
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setErrorMessage(data.error || 'Error al actualizar')
      }
    } catch (error) {
      setErrorMessage('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setChangingPassword(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage('Contraseña actualizada exitosamente')
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setErrorMessage(data.error || 'Error al cambiar contraseña')
      }
    } catch (error) {
      setErrorMessage('Error de conexión')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Solo se permiten imágenes JPG, PNG o WEBP')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('La imagen no puede ser mayor a 5MB')
      return
    }

    setUploadingAvatar(true)
    setErrorMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'avatars')

      const uploadResponse = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })

      const uploadData = await uploadResponse.json()

      if (uploadData.success) {
        // Update profile with new avatar URL
        const updateResponse = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: uploadData.url })
        })

        const updateData = await updateResponse.json()

        if (updateData.success) {
          setProfile(updateData.data)
          setSuccessMessage('Avatar actualizado')
          // Update localStorage
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            const user = JSON.parse(storedUser)
            user.avatar = uploadData.url
            localStorage.setItem('user', JSON.stringify(user))
          }
          setTimeout(() => setSuccessMessage(''), 3000)
        }
      } else {
        setErrorMessage(uploadData.error || 'Error al subir imagen')
      }
    } catch (error) {
      setErrorMessage('Error al subir imagen')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return 'Hace unos minutos'
    if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
    if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`
    return formatDate(dateString)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Success/Error Messages */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  <CheckCircle className="w-5 h-5" />
                  {successMessage}
                </motion.div>
              )}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                >
                  <AlertCircle className="w-5 h-5" />
                  {errorMessage}
                  <button onClick={() => setErrorMessage('')} className="ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar & Personal Info Section */}
            <div className={cn(
              'rounded-2xl border shadow-xl overflow-hidden',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Avatar */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className={cn(
                        'w-32 h-32 rounded-2xl overflow-hidden border-4',
                        theme === 'dark' ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-100'
                      )}>
                        {profile?.avatar ? (
                          <img
                            src={profile.avatar}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className={cn(
                          'absolute -bottom-2 -right-2 p-2.5 rounded-xl shadow-lg transition-all',
                          'bg-blue-500 hover:bg-blue-600 text-white',
                          uploadingAvatar && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      JPG, PNG o WEBP<br />Max 5MB
                    </p>
                  </div>

                  {/* Form */}
                  <div className="flex-1 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-500" />
                      Información Personal
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nombre
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          placeholder="Tu nombre"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Apellido
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          placeholder="Tu apellido"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Mail className="w-4 h-4 inline mr-1" />
                          Email
                        </label>
                        <input
                          type="email"
                          value={profile?.email || ''}
                          disabled
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border cursor-not-allowed opacity-60',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-gray-400'
                              : 'bg-gray-100 border-gray-200 text-gray-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 234 567 8900"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Dirección
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Calle, número, apartamento"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ciudad
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="Ciudad"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Estado
                        </label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder="Estado"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          País
                        </label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          placeholder="País"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Código Postal
                        </label>
                        <input
                          type="text"
                          value={formData.zipcode}
                          onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                          placeholder="12345"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className={cn(
                        'mt-4 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all',
                        'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
                        'hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25',
                        saving && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Section */}
            <div className={cn(
              'rounded-2xl border shadow-xl overflow-hidden',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-amber-500" />
                  Cambiar Contraseña
                </h3>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contraseña Actual
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        placeholder="••••••••"
                        className={cn(
                          'w-full px-4 py-2.5 pr-10 rounded-xl border transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-amber-500'
                            : 'bg-gray-50 border-gray-200 focus:border-amber-500'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="••••••••"
                        className={cn(
                          'w-full px-4 py-2.5 pr-10 rounded-xl border transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-amber-500'
                            : 'bg-gray-50 border-gray-200 focus:border-amber-500'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Nueva Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className={cn(
                          'w-full px-4 py-2.5 pr-10 rounded-xl border transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-amber-500'
                            : 'bg-gray-50 border-gray-200 focus:border-amber-500',
                          passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && 'border-red-500'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleChangePassword}
                    disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                    className={cn(
                      'px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all',
                      'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
                      'hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25',
                      (changingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {changingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Account Info Section */}
            <div className={cn(
              'rounded-2xl border shadow-xl overflow-hidden',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Información de Cuenta
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Shield className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rol</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {ROLE_LABELS[profile?.role || ''] || profile?.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Building className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Empresa</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {profile?.companyName || 'Sin empresa'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Calendar className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Miembro desde</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatDate(profile?.createdAt || '')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Último acceso</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatRelativeTime(profile?.lastLogin || '')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
