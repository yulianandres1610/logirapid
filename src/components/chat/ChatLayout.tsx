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
import { MessageSquare, Users } from 'lucide-react'

export function ChatLayout() {
  const { theme } = useTheme()
  const { activeConversation, pendingChat, fetchCompanyUsers, updatePresence } = useChatContext()
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConversationType, setNewConversationType] = useState<'private' | 'group' | 'channel'>('private')

  // Fetch users on mount and set up presence
  useEffect(() => {
    fetchCompanyUsers()
    updatePresence()

    const presenceInterval = setInterval(updatePresence, 30000)
    return () => clearInterval(presenceInterval)
  }, [fetchCompanyUsers, updatePresence])

  const handleNewConversation = (type: 'private' | 'group' | 'channel') => {
    setNewConversationType(type)
    setShowNewConversation(true)
  }

  return (
    <div className={cn(
      'flex h-full overflow-hidden',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      {/* Left sidebar - Presence list */}
      <div className={cn(
        'w-64 flex-shrink-0 border-r flex flex-col',
        theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
      )}>
        {/* Header */}
        <div className={cn(
          'h-14 px-4 flex items-center gap-3 border-b',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500'
          )}>
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className={cn(
              'font-semibold text-sm',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Equipo
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              Usuarios
            </p>
          </div>
        </div>
        <PresenceList onStartChat={handleNewConversation} />
      </div>

      {/* Middle - Conversation list */}
      <div className={cn(
        'w-72 flex-shrink-0 border-r flex flex-col',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        {/* Header */}
        <div className={cn(
          'h-14 px-4 flex items-center gap-3 border-b',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500'
          )}>
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className={cn(
              'font-semibold text-sm',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Conversaciones
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              Chats activos
            </p>
          </div>
        </div>
        <ConversationList onNewConversation={handleNewConversation} />
      </div>

      {/* Right - Chat thread */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      )}>
        {activeConversation ? (
          <ChatThread />
        ) : pendingChat ? (
          <PendingChatThread />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className={cn(
                'w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <MessageSquare className={cn(
                  'w-8 h-8',
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
              </div>
              <h3 className={cn(
                'text-lg font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Bienvenido al Chat
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Selecciona una conversacion o haz clic en un usuario para iniciar un nuevo chat
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
