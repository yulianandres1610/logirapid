'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { Search, Plus, Users, Megaphone } from 'lucide-react'

interface PresenceListProps {
  onStartChat: (type: 'private' | 'group' | 'channel') => void
}

export function PresenceList({ onStartChat }: PresenceListProps) {
  const { theme } = useTheme()
  const { presenceUsers, selectConversation, createConversation, conversations } = useChatContext()
  const [search, setSearch] = useState('')

  const filteredUsers = presenceUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  const onlineUsers = filteredUsers.filter(u => u.presence.status === 'online')
  const awayUsers = filteredUsers.filter(u => u.presence.status === 'away')
  const offlineUsers = filteredUsers.filter(u => u.presence.status === 'offline')

  const handleUserClick = async (userId: number) => {
    // Check if private conversation already exists
    const existingConv = conversations.find(c =>
      c.type === 'private' && c.otherParticipant?.id === userId
    )

    if (existingConv) {
      selectConversation(existingConv.id)
    } else {
      // Create new private conversation
      const convId = await createConversation('private', [userId])
      if (convId) {
        selectConversation(convId)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      default:
        return theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'
    }
  }

  const renderUserList = (users: typeof presenceUsers, label: string) => {
    if (users.length === 0) return null

    return (
      <div className="mb-4">
        <p className={cn(
          'text-xs font-semibold uppercase px-4 mb-2',
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        )}>
          {label} ({users.length})
        </p>
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => handleUserClick(user.id)}
            className={cn(
              'w-full px-4 py-2 flex items-center gap-3 transition-colors text-left',
              theme === 'dark'
                ? 'hover:bg-gray-700'
                : 'hover:bg-gray-100'
            )}
          >
            <div className="relative">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-600'
              )}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2',
                theme === 'dark' ? 'border-gray-800' : 'border-white',
                getStatusColor(user.presence.status)
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {user.name}
              </p>
              <p className={cn(
                'text-xs truncate',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {user.role}
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
      {/* Search */}
      <div className="p-3">
        <div className={cn(
          'relative rounded-lg',
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm bg-transparent rounded-lg outline-none',
              theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            )}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3 space-y-1">
        <button
          onClick={() => onStartChat('group')}
          className={cn(
            'w-full px-3 py-2 flex items-center gap-2 text-sm rounded-lg transition-colors',
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Crear grupo</span>
        </button>
        <button
          onClick={() => onStartChat('channel')}
          className={cn(
            'w-full px-3 py-2 flex items-center gap-2 text-sm rounded-lg transition-colors',
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          )}
        >
          <Megaphone className="w-4 h-4" />
          <span>Crear canal</span>
        </button>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {renderUserList(onlineUsers, 'En linea')}
        {renderUserList(awayUsers, 'Ausente')}
        {renderUserList(offlineUsers, 'Desconectado')}

        {filteredUsers.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              No se encontraron usuarios
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
