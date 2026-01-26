'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { Search, Plus, User, Users, Megaphone, Loader2 } from 'lucide-react'
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
    if (!conv.lastMessage) return 'Sin mensajes'
    const msg = conv.lastMessage
    switch (msg.message_type) {
      case 'image':
        return '📷 Imagen'
      case 'audio':
        return '🎵 Audio'
      case 'file':
        return '📎 Archivo'
      default:
        return msg.content?.substring(0, 50) || ''
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

  return (
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
      {/* Search and new button */}
      <div className="p-3 flex gap-2">
        <div className={cn(
          'flex-1 relative rounded-lg',
          theme === 'dark' ? 'bg-gray-700' : 'bg-white border border-gray-200'
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm bg-transparent rounded-lg outline-none',
              theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            )}
          />
        </div>
        <button
          onClick={() => onNewConversation('private')}
          className={cn(
            'p-2 rounded-lg transition-colors',
            theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn(
              'w-6 h-6 animate-spin',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className={cn(
              'text-sm mb-2',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
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
          conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                'w-full px-4 py-3 flex items-start gap-3 transition-colors text-left border-b',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-100',
                activeConversation?.id === conv.id
                  ? theme === 'dark'
                    ? 'bg-gray-700'
                    : 'bg-blue-50'
                  : theme === 'dark'
                    ? 'hover:bg-gray-700/50'
                    : 'hover:bg-gray-50'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                conv.type === 'channel'
                  ? theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'
                  : conv.type === 'group'
                    ? theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'
                    : theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
              )}>
                {conv.avatarUrl ? (
                  <img src={conv.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : conv.type === 'private' && conv.otherParticipant ? (
                  <span className="text-lg font-semibold">
                    {conv.otherParticipant.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  getConversationIcon(conv.type)
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'font-semibold truncate',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
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
                <div className="flex items-center justify-between">
                  <p className={cn(
                    'text-sm truncate',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    {getLastMessagePreview(conv)}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className={cn(
                      'ml-2 px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0',
                      'bg-blue-500 text-white'
                    )}>
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </span>
                  )}
                </div>
                {conv.type !== 'private' && (
                  <p className={cn(
                    'text-xs mt-1',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {conv.participantCount} {conv.participantCount === 1 ? 'miembro' : 'miembros'}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
