'use client'

import React from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { MessageInput } from './MessageInput'
import { X, ArrowLeft } from 'lucide-react'

interface PendingChatThreadProps {
  onBack?: () => void
}

export function PendingChatThread({ onBack }: PendingChatThreadProps) {
  const { theme } = useTheme()
  const { pendingChat, cancelPendingChat } = useChatContext()

  if (!pendingChat) return null

  const getAvatarBg = (name: string) => {
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

  const handleCancel = () => {
    cancelPendingChat()
    if (onBack) onBack()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'h-12 px-3 flex items-center justify-between border-b flex-shrink-0',
        theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={handleCancel}
              className={cn(
                'md:hidden p-1.5 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs',
            getAvatarBg(pendingChat.user.name)
          )}>
            {pendingChat.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className={cn(
              'font-semibold text-sm truncate',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {pendingChat.user.name}
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              Nueva conversacion
            </p>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className={cn(
            'hidden md:block p-1.5 rounded-lg transition-colors',
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Empty state - no messages yet */}
      <div className={cn(
        'flex-1 flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="text-center px-8">
          <div className={cn(
            'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
            getAvatarBg(pendingChat.user.name)
          )}>
            <span className="text-2xl text-white font-semibold">
              {pendingChat.user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h3 className={cn(
            'text-lg font-semibold mb-1',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {pendingChat.user.name}
          </h3>
          <p className={cn(
            'text-sm mb-4',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {pendingChat.user.email}
          </p>
          <p className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            Escribe un mensaje para iniciar la conversacion
          </p>
        </div>
      </div>

      {/* Input */}
      <MessageInput
        replyingTo={null}
        onCancelReply={() => {}}
        conversationType="private"
        userRole="admin"
      />
    </div>
  )
}
