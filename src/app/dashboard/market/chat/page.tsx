'use client'

import React, { useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { ChatProvider, useChatContext } from '@/contexts/ChatContext'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { preloadSounds, requestNotificationPermission } from '@/lib/chat-sounds'

function ChatPageContent() {
  const { theme } = useTheme()
  const { fetchConversations, fetchCompanyUsers } = useChatContext()

  useEffect(() => {
    // Initial data load
    fetchConversations()
    fetchCompanyUsers()

    // Preload sounds
    preloadSounds()

    // Request notification permission
    requestNotificationPermission()
  }, [fetchConversations, fetchCompanyUsers])

  return (
    <div className={`h-[calc(100vh-4rem)] ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <ChatLayout />
    </div>
  )
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  )
}
