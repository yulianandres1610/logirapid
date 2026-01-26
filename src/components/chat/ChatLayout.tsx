'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { ConversationList } from './ConversationList'
import { ChatThread } from './ChatThread'
import { PendingChatThread } from './PendingChatThread'
import { PresenceList } from './PresenceList'
import { NewConversationModal } from './NewConversationModal'
import { MessageSquare, Users, ArrowLeft } from 'lucide-react'

type MobileView = 'users' | 'conversations' | 'chat'

export function ChatLayout() {
  const { theme } = useTheme()
  const { activeConversation, pendingChat, fetchCompanyUsers, updatePresence } = useChatContext()
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConversationType, setNewConversationType] = useState<'private' | 'group' | 'channel'>('private')
  const [mobileView, setMobileView] = useState<MobileView>('conversations')

  // Fetch users on mount and set up presence
  useEffect(() => {
    fetchCompanyUsers()
    updatePresence()

    const presenceInterval = setInterval(updatePresence, 30000)
    return () => clearInterval(presenceInterval)
  }, [fetchCompanyUsers, updatePresence])

  // Switch to chat view when conversation is selected
  useEffect(() => {
    if (activeConversation || pendingChat) {
      setMobileView('chat')
    }
  }, [activeConversation, pendingChat])

  const handleNewConversation = (type: 'private' | 'group' | 'channel') => {
    setNewConversationType(type)
    setShowNewConversation(true)
  }

  const handleBackToList = () => {
    setMobileView('conversations')
  }

  return (
    <div className={cn(
      'flex h-full overflow-hidden',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      {/* Left sidebar - Presence list (hidden on mobile) */}
      <div className={cn(
        'hidden lg:flex w-60 flex-shrink-0 border-r flex-col',
        theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
      )}>
        {/* Header */}
        <div className={cn(
          'h-12 px-3 flex items-center gap-2 border-b flex-shrink-0',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500 flex-shrink-0">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className={cn(
              'font-semibold text-sm truncate',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Equipo
            </h2>
          </div>
        </div>
        <PresenceList onStartChat={handleNewConversation} />
      </div>

      {/* Middle - Conversation list */}
      <div className={cn(
        'w-full md:w-72 flex-shrink-0 border-r flex-col',
        mobileView === 'conversations' ? 'flex' : 'hidden md:flex',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        {/* Header */}
        <div className={cn(
          'h-12 px-3 flex items-center gap-2 border-b flex-shrink-0',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500 flex-shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className={cn(
              'font-semibold text-sm truncate',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Conversaciones
            </h2>
          </div>
        </div>
        <ConversationList onNewConversation={handleNewConversation} />
      </div>

      {/* Right - Chat thread */}
      <div className={cn(
        'flex-1 flex-col min-w-0',
        mobileView === 'chat' || (!activeConversation && !pendingChat) ? 'flex' : 'hidden md:flex',
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      )}>
        {activeConversation ? (
          <ChatThread onBack={handleBackToList} />
        ) : pendingChat ? (
          <PendingChatThread onBack={handleBackToList} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className={cn(
                'w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <MessageSquare className={cn(
                  'w-7 h-7',
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
              </div>
              <h3 className={cn(
                'text-base font-semibold mb-1',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Bienvenido al Chat
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Selecciona una conversacion para comenzar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      <NewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        initialType={newConversationType}
      />
    </div>
  )
}
