'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Users, Megaphone, MessageCircle, Loader2 } from 'lucide-react'

interface PresenceListProps {
  onStartChat: (type: 'private' | 'group' | 'channel') => void
}

export function PresenceList({ onStartChat }: PresenceListProps) {
  const { theme } = useTheme()
  const { companyUsers, selectConversation, createConversation, conversations } = useChatContext()
  const [search, setSearch] = useState('')
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null)

  const filteredUsers = companyUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  const onlineUsers = filteredUsers.filter(u => u.presence.status === 'online')
  const awayUsers = filteredUsers.filter(u => u.presence.status === 'away')
  const offlineUsers = filteredUsers.filter(u => u.presence.status === 'offline')

  const handleUserClick = async (userId: number) => {
    setLoadingUserId(userId)
    try {
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
    } finally {
      setLoadingUserId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500 shadow-emerald-500/50'
      case 'away':
        return 'bg-amber-500 shadow-amber-500/50'
      default:
        return theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'
    }
  }

  const getStatusRing = (status: string) => {
    switch (status) {
      case 'online':
        return 'ring-emerald-500/30'
      case 'away':
        return 'ring-amber-500/30'
      default:
        return ''
    }
  }

  const getAvatarGradient = (name: string) => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-violet-500 to-purple-500',
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-amber-500',
      'from-indigo-500 to-blue-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const renderUserList = (users: typeof companyUsers, label: string, statusIcon: string) => {
    if (users.length === 0) return null

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 px-4 mb-3">
          <span className="text-lg">{statusIcon}</span>
          <span className={cn(
            'text-xs font-bold uppercase tracking-wider',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            {label}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-semibold',
            theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'
          )}>
            {users.length}
          </span>
        </div>
        <AnimatePresence>
          {users.map((user, index) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleUserClick(user.id)}
              disabled={loadingUserId === user.id}
              className={cn(
                'w-full px-4 py-3 flex items-center gap-3 transition-all text-left group',
                theme === 'dark'
                  ? 'hover:bg-white/5'
                  : 'hover:bg-gray-100',
                loadingUserId === user.id && 'opacity-50'
              )}
            >
              <div className={cn(
                'relative',
                user.presence.status !== 'offline' && `ring-2 ${getStatusRing(user.presence.status)} rounded-full`
              )}>
                <div className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm',
                  'bg-gradient-to-br shadow-lg',
                  getAvatarGradient(user.name)
                )}>
                  {loadingUserId === user.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 shadow-lg',
                    theme === 'dark' ? 'border-gray-900' : 'border-white',
                    getStatusColor(user.presence.status)
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-semibold truncate transition-colors',
                  theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-gray-900 group-hover:text-blue-600'
                )}>
                  {user.name}
                </p>
                <p className={cn(
                  'text-xs truncate',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  {user.role || user.email}
                </p>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className={cn(
                  'p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all',
                  theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
                )}
              >
                <MessageCircle className="w-4 h-4 text-white" />
              </motion.div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100%-4rem)]">
      {/* Search */}
      <div className="p-4">
        <div className={cn(
          'relative rounded-xl overflow-hidden',
          theme === 'dark'
            ? 'bg-gray-800/50 focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-violet-500/50'
            : 'bg-gray-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/50 focus-within:shadow-lg'
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )} />
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-3 text-sm bg-transparent outline-none transition-colors',
              theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            )}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onStartChat('group')}
          className={cn(
            'flex-1 px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all',
            theme === 'dark'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-600/25'
              : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-500/25'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Grupo</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onStartChat('channel')}
          className={cn(
            'flex-1 px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-medium rounded-xl transition-all',
            theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'
          )}
        >
          <Megaphone className="w-4 h-4" />
          <span>Canal</span>
        </motion.button>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {companyUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}
            >
              <Users className={cn(
                'w-8 h-8',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
            </motion.div>
            <p className={cn(
              'text-sm text-center',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Cargando usuarios...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              No se encontraron usuarios
            </p>
          </div>
        ) : (
          <>
            {renderUserList(onlineUsers, 'En linea', '🟢')}
            {renderUserList(awayUsers, 'Ausente', '🟡')}
            {renderUserList(offlineUsers, 'Desconectado', '⚫')}
          </>
        )}
      </div>
    </div>
  )
}
