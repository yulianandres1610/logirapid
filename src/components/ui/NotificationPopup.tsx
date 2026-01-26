'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, MessageSquare } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { motion, AnimatePresence } from 'framer-motion'

interface PopupNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'chat'
  title: string
  message: string
  autoHideTime: number
}

export default function NotificationPopup() {
  const { notifications, markAsRead } = useNotifications()
  const [popups, setPopups] = useState<PopupNotification[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Solo procesar notificaciones nuevas que no hayan sido procesadas antes
    const newNotifications = notifications.filter(n =>
      !n.read && !processedIdsRef.current.has(n.id)
    )

    if (newNotifications.length > 0) {
      // Agregar las nuevas notificaciones a los popups
      const newPopups = newNotifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        autoHideTime: n.type === 'error' ? 7000 : 5000
      }))

      // Marcar como procesadas Y como leídas inmediatamente
      newNotifications.forEach(n => {
        processedIdsRef.current.add(n.id)
        markAsRead(n.id) // Marcar como leída para que no vuelva a aparecer al navegar
      })

      setPopups(prev => [...newPopups, ...prev].slice(0, 3))
    }
  }, [notifications, markAsRead])

  // Remover popup del estado local (ya está marcada como leída)
  const removePopup = (id: string) => {
    setPopups(prev => prev.filter(popup => popup.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-emerald-500" />
      default:
        return <Info className="w-5 h-5 text-gray-500" />
    }
  }

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500'
      case 'error':
        return 'border-l-red-500'
      case 'warning':
        return 'border-l-yellow-500'
      case 'info':
        return 'border-l-blue-500'
      case 'chat':
        return 'border-l-emerald-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'error':
        return 'bg-red-600 dark:bg-red-700 border border-red-500 dark:border-red-600'
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-500'
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-500'
      case 'chat':
        return 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-400 dark:border-emerald-500'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-600'
    }
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 pointer-events-none">
      <AnimatePresence>
        {popups.map((popup) => (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="pointer-events-auto"
          >
            <div
              className={`
                relative overflow-hidden
                min-w-80 max-w-md
                ${getBgColor(popup.type)}
                border-l-4 ${getBorderColor(popup.type)}
                rounded-xl shadow-2xl
                backdrop-blur-md
              `}
            >
              {/* Progress bar - se remueve automáticamente cuando termina */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 dark:bg-white/10">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: popup.autoHideTime / 1000, ease: 'linear' }}
                  onAnimationComplete={() => removePopup(popup.id)}
                  className={`h-full ${
                    popup.type === 'error'
                      ? 'bg-red-400'
                      : popup.type === 'success'
                      ? 'bg-green-500'
                      : popup.type === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                />
              </div>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(popup.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold mb-1 ${
                        popup.type === 'error'
                          ? 'text-white'
                          : popup.type === 'success'
                          ? 'text-green-900 dark:text-green-100'
                          : popup.type === 'warning'
                          ? 'text-yellow-900 dark:text-yellow-100'
                          : 'text-blue-900 dark:text-blue-100'
                      }`}>
                        {popup.title}
                      </h4>
                      <p className={`text-sm ${
                        popup.type === 'error'
                          ? 'text-white/95'
                          : popup.type === 'success'
                          ? 'text-green-800 dark:text-green-200'
                          : popup.type === 'warning'
                          ? 'text-yellow-800 dark:text-yellow-200'
                          : 'text-blue-800 dark:text-blue-200'
                      }`}>
                        {popup.message}
                      </p>
                    </div>
                    <button
                      onClick={() => removePopup(popup.id)}
                      className={`flex-shrink-0 rounded-lg p-1.5 transition-all hover:scale-110 ${
                        popup.type === 'error'
                          ? 'hover:bg-red-700 text-white'
                          : popup.type === 'success'
                          ? 'hover:bg-green-200 dark:hover:bg-green-800 text-green-700 dark:text-green-300'
                          : popup.type === 'warning'
                          ? 'hover:bg-yellow-200 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
                          : 'hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
    </div>
  )
}