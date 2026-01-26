'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { ConversationList } from './ConversationList'
import { ChatThread } from './ChatThread'
import { PresenceList } from './PresenceList'
import { NewConversationModal } from './NewConversationModal'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Users, Sparkles } from 'lucide-react'

export function ChatLayout() {
  const { theme } = useTheme()
  const { activeConversation, fetchCompanyUsers, updatePresence } = useChatContext()
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
      'flex h-full overflow-hidden rounded-2xl',
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    )}>
      {/* Left sidebar - Presence list */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'w-72 flex-shrink-0 border-r flex flex-col',
          theme === 'dark'
            ? 'border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950'
            : 'border-gray-100 bg-gradient-to-b from-white to-gray-50'
        )}
      >
        {/* Header */}
        <div className={cn(
          'h-16 px-5 flex items-center gap-3 border-b',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25'
          )}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={cn(
              'font-bold text-lg',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Equipo
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Usuarios conectados
            </p>
          </div>
        </div>
        <PresenceList onStartChat={handleNewConversation} />
      </motion.div>

      {/* Middle - Conversation list */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={cn(
          'w-80 flex-shrink-0 border-r flex flex-col',
          theme === 'dark'
            ? 'border-gray-800 bg-gray-900/50'
            : 'border-gray-100 bg-gray-50/50'
        )}
      >
        {/* Header */}
        <div className={cn(
          'h-16 px-5 flex items-center gap-3 border-b',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25'
          )}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={cn(
              'font-bold text-lg',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Chats
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Conversaciones activas
            </p>
          </div>
        </div>
        <ConversationList onNewConversation={handleNewConversation} />
      </motion.div>

      {/* Right - Chat thread */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className={cn(
          'flex-1 flex flex-col min-w-0',
          theme === 'dark' ? 'bg-gray-950' : 'bg-white'
        )}
      >
        <AnimatePresence mode="wait">
          {activeConversation ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <ChatThread />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center max-w-md px-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className={cn(
                    'w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center',
                    'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                  )}
                >
                  <Sparkles className={cn(
                    'w-12 h-12',
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                  )} />
                </motion.div>
                <motion.h3
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'text-2xl font-bold mb-3',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  Bienvenido al Chat
                </motion.h3>
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'text-base',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}
                >
                  Selecciona una conversacion de la lista o haz clic en un usuario para iniciar un nuevo chat
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* New conversation modal */}
      <NewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        initialType={newConversationType}
      />
    </div>
  )
}
