'use client'

import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'

interface PopupNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
}

export default function NotificationPopup() {
  const { notifications } = useNotifications()
  const [popups, setPopups] = useState<PopupNotification[]>([])

  useEffect(() => {
    // Get only the 3 most recent unread notifications for popup display
    const recentNotifications = notifications
      .filter(n => !n.read)
      .slice(0, 3)
      .map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message
      }))

    setPopups(recentNotifications)
  }, [notifications])

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
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-600'
    }
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
      {popups.map((popup, index) => (
        <div
          key={popup.id}
          className={`
            pointer-events-auto
            transform transition-all duration-300 ease-out
            ${index === 0 ? 'translate-x-0' : '-translate-x-full'}
            hover:translate-x-0
            min-w-80 max-w-md
            ${getBgColor(popup.type)}
            border-l-4 ${getBorderColor(popup.type)}
            rounded-lg shadow-lg
            backdrop-blur-sm
          `}
          style={{
            animation: 'slideIn 0.3s ease-out',
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'both'
          }}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getIcon(popup.type)}
              </div>
              <div className="ml-3 flex-1">
                <h4 className={`text-sm font-bold ${
                  popup.type === 'error'
                    ? 'text-white dark:text-white'
                    : popup.type === 'success'
                    ? 'text-green-800 dark:text-green-200'
                    : popup.type === 'warning'
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}>
                  {popup.title}
                </h4>
                <p className={`mt-1 text-sm font-semibold ${
                  popup.type === 'error'
                    ? 'text-white dark:text-white/90'
                    : popup.type === 'success'
                    ? 'text-green-700 dark:text-green-300'
                    : popup.type === 'warning'
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {popup.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => removePopup(popup.id)}
                  className={`inline-flex rounded-md p-1.5 hover:bg-opacity-30 transition-all ${
                    popup.type === 'error'
                      ? 'hover:bg-red-700 dark:hover:bg-red-800 text-white hover:scale-110'
                      : popup.type === 'success'
                      ? 'hover:bg-green-100 dark:hover:bg-green-800 text-green-600 dark:text-green-400'
                      : popup.type === 'warning'
                      ? 'hover:bg-yellow-100 dark:hover:bg-yellow-800 text-yellow-600 dark:text-yellow-400'
                      : 'hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <X className="w-4 h-4 font-bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}