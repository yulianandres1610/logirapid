'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { playSound, showNotification as showBrowserNotification } from '@/lib/chat-sounds'
import { useNotifications } from '@/contexts/NotificationContext'

interface ChatMessage {
  id: number
  content: string | null
  conversationId: number
  conversationName: string
  sender: {
    id: number
    name: string
  }
  createdAt: string
}

export function useChatNotifications() {
  const pathname = usePathname()
  const router = useRouter()
  const { showNotification } = useNotifications()

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckedRef = useRef<string>(new Date().toISOString())
  const currentUserIdRef = useRef<number | null>(null)
  const isInChatRef = useRef(false)

  // Check if user is currently in chat page
  useEffect(() => {
    isInChatRef.current = pathname?.includes('/chat') || false
  }, [pathname])

  // Get current user ID
  useEffect(() => {
    const getUserId = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.success && data.user) {
          currentUserIdRef.current = data.user.id
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    getUserId()
  }, [])

  const handleNewMessage = useCallback((message: ChatMessage) => {
    // Don't notify for own messages
    if (message.sender.id === currentUserIdRef.current) return

    // Play sound
    playSound('newMessage')

    // Add to notification center with onClick to navigate to chat
    showNotification(
      'chat',
      `💬 ${message.sender.name}`,
      message.content || 'Nuevo mensaje',
      () => {
        router.push('/dashboard/market/chat')
      }
    )

    // Show browser notification if page is not visible
    if (document.hidden) {
      showBrowserNotification(
        `Nuevo mensaje de ${message.sender.name}`,
        message.content || 'Nuevo mensaje',
        {
          tag: `chat-${message.conversationId}`,
          onClick: () => {
            router.push('/dashboard/market/chat')
          }
        }
      )
    }
  }, [showNotification, router])

  const pollForNewMessages = useCallback(async () => {
    // Don't poll if user is in chat (ChatContext handles notifications there)
    if (isInChatRef.current) return

    try {
      const res = await fetch(`/api/market/chat/notifications?since=${encodeURIComponent(lastCheckedRef.current)}`)
      const data = await res.json()

      if (data.success && data.data.messages.length > 0) {
        // Update last checked time
        lastCheckedRef.current = new Date().toISOString()

        // Process each new message
        data.data.messages.forEach((message: ChatMessage) => {
          handleNewMessage(message)
        })
      }
    } catch (error) {
      console.error('Error polling for chat notifications:', error)
    }
  }, [handleNewMessage])

  // Start polling when not in chat
  useEffect(() => {
    // Initial poll
    if (!isInChatRef.current) {
      pollForNewMessages()
    }

    // Set up polling interval (every 5 seconds when not in chat)
    pollingRef.current = setInterval(() => {
      if (!isInChatRef.current) {
        pollForNewMessages()
      }
    }, 5000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [pollForNewMessages])

  return null
}
