'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void
  getUnreadCount: () => number
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback((
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    const newNotification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false
    }

    setNotifications(prev => [newNotification, ...prev])

    // Auto-remove popup notifications after 5 seconds (except errors which stay 7 seconds)
    const autoHideTime = type === 'error' ? 7000 : 5000
    setTimeout(() => {
      // Don't remove from header notifications, just mark as read
      // The popup will be handled by the popup component
    }, autoHideTime)
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    )
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  return (
    <NotificationContext.Provider value={{
      notifications,
      showNotification,
      markAsRead,
      clearNotifications,
      getUnreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}