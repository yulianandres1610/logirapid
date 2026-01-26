'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, User, Users, Megaphone, Loader2, MessageSquarePlus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ConversationListProps {
  onNewConversation: (type: 'private' | 'group' | 'channel') => void
}

export function ConversationList({ onNewConversation }: ConversationListProps) {
  const { theme } = useTheme()
  const {
    conversations,
    activeConversation,
    selectConversation,
    fetchConversations,
    isLoadingConversations
  } = useChatContext()
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchConversations])

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'private':
        return <User className="w-5 h-5" />
      case 'group':
        return <Users className="w-5 h-5" />
      case 'channel':
        return <Megaphone className="w-5 h-5" />
      default:
        return <User className="w-5 h-5" />
    }
  }

  const getConversationName = (conv: typeof conversations[0]) => {
    if (conv.type === 'private' && conv.otherParticipant) {
      return conv.otherParticipant.name
    }
    return conv.name || 'Sin nombre'
  }

  const getLastMessagePreview = (conv: typeof conversations[0]) => {
    if (!conv.lastMessage) return 'Sin mensajes aun'
    const msg = conv.lastMessage
    switch (msg.message_type) {
      case 'image':
        return '📷 Imagen'
      case 'audio':
        return '🎵 Audio'
      case 'file':
        return '📎 Archivo'
      default:
        return msg.content?.substring(0, 40) + (msg.content && msg.content.length > 40 ? '...' : '') || ''
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: false,
        locale: es
      })
    } catch {
      return ''
    }
  }

  const getAvatarGradient = (name: string, type: string) => {
    if (type === 'channel') return 'from-purple-500 to-pink-500'
    if (type === 'group') return 'from-blue-500 to-cyan-500'

    const colors = [
      'from-pink-500 to-rose-500',
      'from-violet-500 to-purple-500',
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-amber-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="flex flex-col h-[calc(100%-4rem)]">
      {/* Search and new button */}
      <div className="p-4 flex gap-2">
        <div className={cn(
          'flex-1 relative rounded-xl overflow-hidden',
          theme === 'dark'
            ? 'bg-gray-800/50 focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500/50'
            : 'bg-white focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:shadow-lg border border-gray-200'
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )} />
          <input
            type="text"
            placeholder="Buscar chat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-3 text-sm bg-transparent outline-none',
              theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            )}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNewConversation('private')}
          className={cn(
            'p-3 rounded-xl transition-all',
            'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
            'text-white shadow-lg shadow-blue-500/25'
          )}
        >
          <MessageSquarePlus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className={cn(
                'w-8 h-8',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
              )} />
            </motion.div>
          </div>
        ) : conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-12 text-center"
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <MessageSquarePlus className={cn(
                'w-8 h-8',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
            </div>
            <p className={cn(
              'text-sm mb-3',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              No hay conversaciones
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNewConversation('private')}
              className={cn(
                'text-sm font-semibold px-4 py-2 rounded-lg',
                theme === 'dark'
                  ? 'text-blue-400 hover:bg-blue-500/10'
                  : 'text-blue-500 hover:bg-blue-50'
              )}
            >
              Iniciar una conversacion
            </motion.button>
          </motion.div>
        ) : (
          <AnimatePresence>
            {conversations.map((conv, index) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => selectConversation(conv.id)}
                className={cn(
                  'w-full p-3 flex items-center gap-3 transition-all text-left rounded-xl mb-1 group',
                  activeConversation?.id === conv.id
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30'
                      : 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200'
                    : theme === 'dark'
                      ? 'hover:bg-white/5'
                      : 'hover:bg-gray-50'
                )}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg',
                    'bg-gradient-to-br',
                    getAvatarGradient(getConversationName(conv), conv.type)
                  )}>
                    {conv.avatarUrl ? (
                      <img src={conv.avatarUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : conv.type === 'private' && conv.otherParticipant ? (
                      <span className="text-lg">
                        {conv.otherParticipant.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      getConversationIcon(conv.type)
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        'absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center',
                        'bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold shadow-lg'
                      )}
                    >
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </motion.div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'font-semibold truncate',
                      activeConversation?.id === conv.id
                        ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {getConversationName(conv)}
                    </span>
                    {conv.lastMessage && (
                      <span className={cn(
                        'text-xs flex-shrink-0 ml-2',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {formatTime(conv.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm truncate',
                    conv.unreadCount > 0
                      ? theme === 'dark' ? 'text-gray-300 font-medium' : 'text-gray-700 font-medium'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {getLastMessagePreview(conv)}
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
