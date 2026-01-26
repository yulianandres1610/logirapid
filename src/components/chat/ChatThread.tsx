'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import {
  User, Users, Megaphone, Pin, Loader2, ChevronDown, MoreVertical, ArrowLeft
} from 'lucide-react'

interface ReplyingTo {
  id: number
  content: string
  senderName: string
}

interface ChatThreadProps {
  onBack?: () => void
}

export function ChatThread({ onBack }: ChatThreadProps) {
  const { theme } = useTheme()
  const {
    activeConversation,
    messages,
    participants,
    isLoadingMessages,
    hasMoreMessages,
    fetchMessages,
    currentUserId,
    typingUsers
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
        return <User className="w-4 h-4" />
      case 'group':
        return <Users className="w-4 h-4" />
      case 'channel':
        return <Megaphone className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getConversationName = () => {
    if (!activeConversation) return ''
    if (activeConversation.type === 'private' && activeConversation.otherParticipant) {
      return activeConversation.otherParticipant.name
    }
    return activeConversation.name || 'Sin nombre'
  }

  const getAvatarBg = () => {
    switch (activeConversation?.type) {
      case 'channel':
        return 'bg-purple-500'
      case 'group':
        return 'bg-blue-500'
      default:
        return 'bg-emerald-500'
    }
  }

  const getAvatarInitial = () => {
    const name = getConversationName()
    return name.charAt(0).toUpperCase()
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className={cn(
        'h-12 px-3 flex items-center justify-between border-b flex-shrink-0',
        theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
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
            getAvatarBg()
          )}>
            {activeConversation.avatarUrl ? (
              <img src={activeConversation.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : activeConversation.type === 'private' ? (
              getAvatarInitial()
            ) : (
              getConversationIcon()
            )}
          </div>
          <div>
            <h2 className={cn(
              'font-semibold text-sm',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {getConversationName()}
            </h2>
            <p className={cn(
              'text-xs flex items-center gap-1.5',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              {activeConversation.type === 'private' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  En linea
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" />
                  {participants.length} miembros
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors',
                showPinnedMessages
                  ? 'bg-amber-500 text-white'
                  : theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{pinnedMessages.length}</span>
            </button>
          )}
          <button className={cn(
            'p-2 rounded-lg transition-colors',
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          )}>
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pinned messages banner */}
      {showPinnedMessages && pinnedMessages.length > 0 && (
        <div className={cn(
          'border-b',
          theme === 'dark' ? 'bg-amber-900/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="p-3 max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Pin className={cn('w-3.5 h-3.5', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
              <span className={cn(
                'text-xs font-medium',
                theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
              )}>
                Mensajes fijados
              </span>
            </div>
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'p-2 rounded-lg text-xs mb-1.5 last:mb-0 border-l-2 border-amber-500',
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'
                )}
              >
                <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {msg.sender.name}:
                </span>{' '}
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  {msg.content?.substring(0, 80)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={cn(
          'flex-1 overflow-y-auto px-4 py-2',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}
      >
        {/* Loading more */}
        {isLoadingMessages && (
          <div className="flex justify-center py-3">
            <Loader2 className={cn(
              'w-5 h-5 animate-spin',
              theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
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
              isOwnMessage={message.sender.id === currentUserId}
            />
          )
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 py-2 ml-9">
            <div className={cn(
              'flex gap-1 px-3 py-2 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
            )}>
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              {typingUsers.length === 1
                ? `${typingUsers[0].name} está escribiendo...`
                : `${typingUsers.map(u => u.name).join(', ')} están escribiendo...`
              }
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-20 right-4 p-2.5 rounded-full shadow-lg transition-all z-10',
            'bg-blue-500 hover:bg-blue-600 text-white'
          )}
        >
          <ChevronDown className="w-4 h-4" />
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
