'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { ConversationList } from './ConversationList'
import { ChatThread } from './ChatThread'
import { PresenceList } from './PresenceList'
import { NewConversationModal } from './NewConversationModal'
import { MessageSquare, Users, PanelLeftClose, PanelLeft } from 'lucide-react'

export function ChatLayout() {
  const { theme } = useTheme()
  const { activeConversation } = useChatContext()
  const [showSidebar, setShowSidebar] = useState(true)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConversationType, setNewConversationType] = useState<'private' | 'group' | 'channel'>('private')

  const handleNewConversation = (type: 'private' | 'group' | 'channel') => {
    setNewConversationType(type)
    setShowNewConversation(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar - Presence list */}
      {showSidebar && (
        <div className={cn(
          'w-64 flex-shrink-0 border-r',
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        )}>
          <div className={cn(
            'h-14 px-4 flex items-center justify-between border-b',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div className="flex items-center gap-2">
              <Users className={cn(
                'w-5 h-5',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
              <span className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Usuarios
              </span>
            </div>
          </div>
          <PresenceList onStartChat={handleNewConversation} />
        </div>
      )}

      {/* Middle - Conversation list */}
      <div className={cn(
        'w-80 flex-shrink-0 border-r flex flex-col',
        theme === 'dark' ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'
      )}>
        <div className={cn(
          'h-14 px-4 flex items-center justify-between border-b',
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        )}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              {showSidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <MessageSquare className={cn(
              'w-5 h-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
            <span className={cn(
              'font-semibold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Conversaciones
            </span>
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
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className={cn(
                'w-16 h-16 mx-auto mb-4',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
              )} />
              <h3 className={cn(
                'text-lg font-semibold mb-2',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Selecciona una conversacion
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Elige una conversacion de la lista o inicia una nueva
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
