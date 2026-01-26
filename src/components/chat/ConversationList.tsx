'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { Search, User, Users, Megaphone, Loader2, Plus } from 'lucide-react'
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
        return <User className="w-4 h-4" />
      case 'group':
        return <Users className="w-4 h-4" />
      case 'channel':
        return <Megaphone className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
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
        return msg.content?.substring(0, 35) + (msg.content && msg.content.length > 35 ? '...' : '') || ''
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

  const getAvatarBg = (name: string, type: string) => {
    if (type === 'channel') return 'bg-purple-500'
    if (type === 'group') return 'bg-blue-500'

    const colors = [
      'bg-pink-500',
      'bg-violet-500',
      'bg-blue-500',
      'bg-emerald-500',
      'bg-orange-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
      {/* Search and new button */}
      <div className="p-3 flex gap-2">
        <div className={cn(
          'flex-1 relative rounded-lg',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm bg-transparent outline-none',
              theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            )}
          />
        </div>
        <button
          onClick={() => onNewConversation('private')}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn(
              'w-6 h-6 animate-spin',
              theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
            )} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className={cn('text-sm mb-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              No hay conversaciones
            </p>
            <button
              onClick={() => onNewConversation('private')}
              className={cn(
                'text-sm font-medium',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
              )}
            >
              Iniciar una conversacion
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                'w-full px-3 py-2.5 flex items-center gap-3 transition-colors text-left',
                activeConversation?.id === conv.id
                  ? theme === 'dark'
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'bg-blue-50 border-l-2 border-blue-500'
                  : theme === 'dark'
                    ? 'hover:bg-gray-800'
                    : 'hover:bg-gray-50'
              )}
            >
              {/* Avatar */}
              <div className="relative">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                  getAvatarBg(getConversationName(conv), conv.type)
                )}>
                  {conv.avatarUrl ? (
                    <img src={conv.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : conv.type === 'private' && conv.otherParticipant ? (
                    <span className="text-sm">
                      {conv.otherParticipant.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    getConversationIcon(conv.type)
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full flex items-center justify-center bg-red-500 text-white text-xs font-medium">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    'font-medium text-sm truncate',
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
                  'text-xs truncate',
                  conv.unreadCount > 0
                    ? theme === 'dark' ? 'text-gray-300 font-medium' : 'text-gray-700 font-medium'
                    : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  {getLastMessagePreview(conv)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
