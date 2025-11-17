'use client'

import React from 'react'
import { User, Phone, Mail, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface PersonInfoCardProps {
  title: string
  name: string
  phone?: string
  email?: string
  address?: string
  icon?: React.ReactNode
  iconColor?: string
}

export default function PersonInfoCard({
  title,
  name,
  phone,
  email,
  address,
  icon,
  iconColor = 'blue'
}: PersonInfoCardProps) {
  const { theme } = useTheme()

  const iconColorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
          `bg-gradient-to-br ${iconColorClasses[iconColor as keyof typeof iconColorClasses] || iconColorClasses.blue}`
        )}>
          {icon || <User className="w-6 h-6 text-white" />}
        </div>
        <h3 className={cn(
          'text-xl font-bold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {title}
        </h3>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Name */}
        <div className="flex items-start gap-3">
          <User className={cn(
            'w-5 h-5 mt-0.5 flex-shrink-0',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
          <div>
            <p className={cn(
              'text-sm font-medium',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Nombre Completo
            </p>
            <p className={cn(
              'text-base font-semibold mt-1',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {name}
            </p>
          </div>
        </div>

        {/* Phone */}
        {phone && (
          <div className="flex items-start gap-3">
            <Phone className={cn(
              'w-5 h-5 mt-0.5 flex-shrink-0',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
            <div>
              <p className={cn(
                'text-sm font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Teléfono
              </p>
              <p className={cn(
                'text-base font-semibold mt-1',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {phone}
              </p>
            </div>
          </div>
        )}

        {/* Email */}
        {email && (
          <div className="flex items-start gap-3">
            <Mail className={cn(
              'w-5 h-5 mt-0.5 flex-shrink-0',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
            <div>
              <p className={cn(
                'text-sm font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Email
              </p>
              <p className={cn(
                'text-base font-semibold mt-1',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {email}
              </p>
            </div>
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="flex items-start gap-3">
            <MapPin className={cn(
              'w-5 h-5 mt-0.5 flex-shrink-0',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
            <div>
              <p className={cn(
                'text-sm font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Dirección
              </p>
              <p className={cn(
                'text-base font-semibold mt-1',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {address}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
