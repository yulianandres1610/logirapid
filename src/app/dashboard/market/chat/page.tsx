'use client'

import React, { useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { ChatProvider, useChatContext } from '@/contexts/ChatContext'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
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
    <div className="h-[calc(100vh-4rem-1.5rem)] md:h-[calc(100vh-4rem-3rem)] -m-3 md:-m-6">
      <ChatLayout />
    </div>
  )
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ChatProvider>
          <ChatPageContent />
        </ChatProvider>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
