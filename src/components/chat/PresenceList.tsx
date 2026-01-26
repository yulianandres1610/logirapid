'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { Search, Users, Megaphone } from 'lucide-react'

interface PresenceListProps {
  onStartChat: (type: 'private' | 'group' | 'channel') => void
}

export function PresenceList({ onStartChat }: PresenceListProps) {
  const { theme } = useTheme()
  const { companyUsers, selectConversation, startPendingChat, conversations } = useChatContext()
  const [search, setSearch] = useState('')

  const filteredUsers = companyUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  const onlineUsers = filteredUsers.filter(u => u.presence.status === 'online')
  const awayUsers = filteredUsers.filter(u => u.presence.status === 'away')
  const offlineUsers = filteredUsers.filter(u => u.presence.status === 'offline')

  const handleUserClick = (user: typeof companyUsers[0]) => {
    // Check if private conversation already exists
    const existingConv = conversations.find(c =>
      c.type === 'private' && c.otherParticipant?.id === user.id
    )

    if (existingConv) {
      selectConversation(existingConv.id)
    } else {
      // Start pending chat - conversation will be created when first message is sent
      startPendingChat(user)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500'
      case 'away':
        return 'bg-amber-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getAvatarBg = (name: string) => {
    const colors = [
      'bg-pink-500',
      'bg-violet-500',
      'bg-blue-500',
      'bg-emerald-500',
      'bg-orange-500',
      'bg-indigo-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const renderUserList = (users: typeof companyUsers, label: string) => {
    if (users.length === 0) return null

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 mb-2">
          <span className={cn(
            'text-xs font-medium uppercase tracking-wide',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            {label}
          </span>
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'
          )}>
            {users.length}
          </span>
        </div>
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => handleUserClick(user)}
            className={cn(
              'w-full px-3 py-2 flex items-center gap-3 transition-colors text-left',
              theme === 'dark'
                ? 'hover:bg-gray-800'
                : 'hover:bg-gray-100'
            )}
          >
            <div className="relative">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm',
                getAvatarBg(user.name)
              )}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2',
                theme === 'dark' ? 'border-gray-900' : 'border-white',
                getStatusColor(user.presence.status)
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'font-medium text-sm truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {user.name}
              </p>
              <p className={cn(
                'text-xs truncate',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                {user.role || user.email}
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="p-3">
        <div className={cn(
          'relative rounded-lg',
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
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={() => onStartChat('group')}
          className={cn(
            'flex-1 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors',
            theme === 'dark'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Grupo</span>
        </button>
        <button
          onClick={() => onStartChat('channel')}
          className={cn(
            'flex-1 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg transition-colors',
            theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          )}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Canal</span>
        </button>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {companyUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center mb-3',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <Users className={cn(
                'w-6 h-6',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
            </div>
            <p className={cn(
              'text-sm text-center',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Cargando usuarios...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              No se encontraron usuarios
            </p>
          </div>
        ) : (
          <>
            {renderUserList(onlineUsers, 'En linea')}
            {renderUserList(awayUsers, 'Ausente')}
            {renderUserList(offlineUsers, 'Desconectado')}
          </>
        )}
      </div>
    </div>
  )
}
