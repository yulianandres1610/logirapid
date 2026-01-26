'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Users, Megaphone, User, Check, Loader2, MessageCircle } from 'lucide-react'

interface NewConversationModalProps {
  isOpen: boolean
  onClose: () => void
  initialType: 'private' | 'group' | 'channel'
}

export function NewConversationModal({ isOpen, onClose, initialType }: NewConversationModalProps) {
  const { theme } = useTheme()
  const { companyUsers, fetchCompanyUsers, createConversation, selectConversation } = useChatContext()

  const [type, setType] = useState(initialType)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setType(initialType)
      setName('')
      setDescription('')
      setSelectedUsers([])
      setSearch('')
      fetchCompanyUsers()
    }
  }, [isOpen, initialType, fetchCompanyUsers])

  const filteredUsers = companyUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggleUser = (userId: number) => {
    if (type === 'private') {
      setSelectedUsers([userId])
    } else {
      setSelectedUsers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      )
    }
  }

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return

    if ((type === 'group' || type === 'channel') && !name.trim()) {
      return
    }

    setIsCreating(true)
    try {
      const convId = await createConversation(
        type,
        selectedUsers,
        type !== 'private' ? name.trim() : undefined,
        type !== 'private' ? description.trim() || undefined : undefined
      )

      if (convId) {
        selectConversation(convId)
        onClose()
      }
    } finally {
      setIsCreating(false)
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

  const getTypeGradient = () => {
    switch (type) {
      case 'private':
        return 'from-emerald-500 to-teal-500'
      case 'group':
        return 'from-blue-500 to-cyan-500'
      case 'channel':
        return 'from-purple-500 to-pink-500'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'relative w-full max-w-lg rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden',
            theme === 'dark' ? 'bg-gray-900' : 'bg-white'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-5 border-b flex items-center justify-between',
            theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-white',
                'bg-gradient-to-br',
                getTypeGradient()
              )}>
                <MessageCircle className="w-5 h-5" />
              </div>
              <h2 className={cn(
                'text-xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva conversacion
              </h2>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={cn(
                'p-2 rounded-xl transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Type selector */}
          <div className="px-6 py-4 flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setType('private'); setSelectedUsers([]) }}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-medium',
                type === 'private'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <User className="w-4 h-4" />
              <span className="text-sm">Privado</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setType('group'); setSelectedUsers([]) }}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-medium',
                type === 'group'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm">Grupo</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setType('channel'); setSelectedUsers([]) }}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-medium',
                type === 'channel'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Megaphone className="w-4 h-4" />
              <span className="text-sm">Canal</span>
            </motion.button>
          </div>

          {/* Name & description for groups/channels */}
          <AnimatePresence>
            {type !== 'private' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-6 pb-4 space-y-3 overflow-hidden"
              >
                <div>
                  <label className={cn(
                    'block text-sm font-semibold mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={type === 'group' ? 'Nombre del grupo' : 'Nombre del canal'}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 outline-none transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:shadow-lg'
                    )}
                  />
                </div>
                <div>
                  <label className={cn(
                    'block text-sm font-semibold mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Descripcion
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripcion opcional"
                    rows={2}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 outline-none resize-none transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:shadow-lg'
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search users */}
          <div className={cn(
            'px-6 py-3 border-t',
            theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
          )}>
            <div className={cn(
              'relative rounded-xl overflow-hidden transition-all',
              theme === 'dark'
                ? 'bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500/50'
                : 'bg-gray-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:shadow-lg'
            )}>
              <Search className={cn(
                'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar usuarios..."
                className={cn(
                  'w-full pl-11 pr-4 py-3 bg-transparent outline-none',
                  theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                )}
              />
            </div>
          </div>

          {/* Selected users count */}
          {selectedUsers.length > 0 && type !== 'private' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'px-6 py-2 flex items-center gap-2',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                {selectedUsers.length}
              </div>
              <span className="text-sm font-medium">seleccionado(s)</span>
            </motion.div>
          )}

          {/* User list */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <AnimatePresence>
              {filteredUsers.map((user, index) => (
                <motion.button
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => toggleUser(user.id)}
                  className={cn(
                    'w-full px-3 py-3 rounded-xl flex items-center gap-3 transition-all mb-2',
                    selectedUsers.includes(user.id)
                      ? theme === 'dark'
                        ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30'
                        : 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200'
                      : theme === 'dark'
                        ? 'hover:bg-gray-800 border border-transparent'
                        : 'hover:bg-gray-50 border border-transparent'
                  )}
                >
                  <div className="relative">
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-lg',
                      'bg-gradient-to-br',
                      getAvatarGradient(user.name)
                    )}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm',
                        theme === 'dark' ? 'border-gray-900' : 'border-white',
                        getStatusColor(user.presence.status)
                      )}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={cn(
                      'font-semibold',
                      selectedUsers.includes(user.id)
                        ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {user.name}
                    </p>
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {user.email}
                    </p>
                  </div>
                  {selectedUsers.includes(user.id) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center"
              >
                <div className={cn(
                  'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                )}>
                  <Users className={cn(
                    'w-8 h-8',
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  )} />
                </div>
                <p className={cn(
                  'text-sm',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  No se encontraron usuarios
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'px-6 py-4 border-t flex justify-end gap-3',
            theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
          )}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-300'
                  : 'hover:bg-gray-100 text-gray-700'
              )}
            >
              Cancelar
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              disabled={isCreating || selectedUsers.length === 0 || (type !== 'private' && !name.trim())}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2',
                'bg-gradient-to-r text-white shadow-lg',
                getTypeGradient(),
                type === 'private' ? 'shadow-emerald-500/25' : type === 'group' ? 'shadow-blue-500/25' : 'shadow-purple-500/25',
                (isCreating || selectedUsers.length === 0 || (type !== 'private' && !name.trim())) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isCreating && (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 className="w-4 h-4" />
                </motion.div>
              )}
              {type === 'private' ? 'Iniciar chat' : 'Crear'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
