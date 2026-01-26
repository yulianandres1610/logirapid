'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { X, Search, Users, Megaphone, User, Check, Loader2 } from 'lucide-react'

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
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      default:
        return theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        'relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[80vh] flex flex-col',
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        {/* Header */}
        <div className={cn(
          'px-6 py-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <h2 className={cn(
            'text-lg font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva conversacion
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type selector */}
        <div className="px-6 py-4 flex gap-2">
          <button
            onClick={() => { setType('private'); setSelectedUsers([]) }}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors',
              type === 'private'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <User className="w-4 h-4" />
            <span className="text-sm font-medium">Privado</span>
          </button>
          <button
            onClick={() => { setType('group'); setSelectedUsers([]) }}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors',
              type === 'group'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Grupo</span>
          </button>
          <button
            onClick={() => { setType('channel'); setSelectedUsers([]) }}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors',
              type === 'channel'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Megaphone className="w-4 h-4" />
            <span className="text-sm font-medium">Canal</span>
          </button>
        </div>

        {/* Name & description for groups/channels */}
        {type !== 'private' && (
          <div className="px-6 pb-4 space-y-3">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
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
                  'w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                )}
              />
            </div>
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
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
                  'w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 resize-none',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                )}
              />
            </div>
          </div>
        )}

        {/* Search users */}
        <div className={cn(
          'px-6 py-2 border-t',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuarios..."
              className={cn(
                'w-full pl-10 pr-4 py-2.5 bg-transparent outline-none',
                theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
              )}
            />
          </div>
        </div>

        {/* Selected users count */}
        {selectedUsers.length > 0 && type !== 'private' && (
          <div className={cn(
            'px-6 py-2',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            <span className="text-sm">{selectedUsers.length} seleccionado(s)</span>
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {filteredUsers.map(user => (
            <button
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={cn(
                'w-full px-3 py-2 rounded-lg flex items-center gap-3 transition-colors mb-1',
                selectedUsers.includes(user.id)
                  ? theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                  : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <div className="relative">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium',
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
              <div className="flex-1 text-left">
                <p className={cn(
                  'font-medium',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {user.name}
                </p>
                <p className={cn(
                  'text-sm',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {user.email}
                </p>
              </div>
              {selectedUsers.includes(user.id) && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}

          {filteredUsers.length === 0 && (
            <div className="py-8 text-center">
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                No se encontraron usuarios
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'px-6 py-4 border-t flex justify-end gap-3',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-300'
                : 'hover:bg-gray-100 text-gray-700'
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || selectedUsers.length === 0 || (type !== 'private' && !name.trim())}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
              'bg-blue-500 hover:bg-blue-600 text-white',
              (isCreating || selectedUsers.length === 0 || (type !== 'private' && !name.trim())) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            {type === 'private' ? 'Iniciar chat' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
