'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import {
  User, Users, Megaphone, Settings, Pin, Loader2, ChevronDown
} from 'lucide-react'

interface ReplyingTo {
  id: number
  content: string
  senderName: string
}

export function ChatThread() {
  const { theme } = useTheme()
  const {
    activeConversation,
    messages,
    participants,
    isLoadingMessages,
    hasMoreMessages,
    fetchMessages
  } = useChatContext()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null)
  const [showPinnedMessages, setShowPinnedMessages] = useState(false)

  const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Handle scroll for show scroll button and load more
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current

    // Show scroll to bottom button if not at bottom
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)

    // Load more messages when near top
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMessages && messages.length > 0) {
      const firstMessage = messages[0]
      fetchMessages(firstMessage.id)
    }
  }, [hasMoreMessages, isLoadingMessages, messages, fetchMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleReply = (message: typeof messages[0]) => {
    setReplyingTo({
      id: message.id,
      content: message.content || '',
      senderName: message.sender.name
    })
  }

  const getConversationIcon = () => {
    switch (activeConversation?.type) {
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

  const getConversationName = () => {
    if (!activeConversation) return ''
    if (activeConversation.type === 'private' && activeConversation.otherParticipant) {
      return activeConversation.otherParticipant.name
    }
    return activeConversation.name || 'Sin nombre'
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'h-14 px-4 flex items-center justify-between border-b flex-shrink-0',
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            activeConversation.type === 'channel'
              ? theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'
              : activeConversation.type === 'group'
                ? theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'
                : theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
          )}>
            {getConversationIcon()}
          </div>
          <div>
            <h2 className={cn(
              'font-semibold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {getConversationName()}
            </h2>
            <p className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              {activeConversation.type === 'private'
                ? 'Chat privado'
                : `${participants.length} miembros`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className={cn(
                'p-2 rounded-lg flex items-center gap-1 text-sm transition-colors',
                showPinnedMessages
                  ? theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                  : theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Pin className="w-4 h-4" />
              <span>{pinnedMessages.length}</span>
            </button>
          )}
          <button
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Pinned messages banner */}
      {showPinnedMessages && pinnedMessages.length > 0 && (
        <div className={cn(
          'p-3 border-b max-h-48 overflow-y-auto',
          theme === 'dark' ? 'bg-yellow-900/20 border-yellow-900/50' : 'bg-yellow-50 border-yellow-200'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Pin className={cn(
              'w-4 h-4',
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            )} />
            <span className={cn(
              'text-sm font-semibold',
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
            )}>
              Mensajes fijados
            </span>
          </div>
          {pinnedMessages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'p-2 rounded-lg text-sm mb-1 last:mb-0',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <span className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {msg.sender.name}:
              </span>{' '}
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                {msg.content?.substring(0, 100)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {/* Loading more */}
        {isLoadingMessages && (
          <div className="flex justify-center py-4">
            <Loader2 className={cn(
              'w-6 h-6 animate-spin',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const prevMessage = messages[index - 1]
          const showSender = !prevMessage ||
            prevMessage.sender.id !== message.sender.id ||
            new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000

          return (
            <MessageBubble
              key={message.id}
              message={message}
              showSender={showSender}
              onReply={() => handleReply(message)}
              isOwnMessage={false} // Will be determined in the component
            />
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-24 right-8 p-2 rounded-full shadow-lg transition-all',
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          )}
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Input */}
      <MessageInput
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        conversationType={activeConversation.type}
        userRole={activeConversation.userRole}
      />
    </div>
  )
}
