'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Users, Megaphone, Settings, Pin, Loader2, ChevronDown, MoreVertical
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

  const getHeaderGradient = () => {
    switch (activeConversation?.type) {
      case 'channel':
        return 'from-purple-500 to-pink-500'
      case 'group':
        return 'from-blue-500 to-cyan-500'
      default:
        return 'from-emerald-500 to-teal-500'
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
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          'h-16 px-5 flex items-center justify-between border-b flex-shrink-0',
          theme === 'dark'
            ? 'border-gray-800 bg-gradient-to-r from-gray-900/80 to-gray-950/80 backdrop-blur-xl'
            : 'border-gray-100 bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-xl'
        )}
      >
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg',
              'bg-gradient-to-br',
              getHeaderGradient()
            )}
          >
            {activeConversation.avatarUrl ? (
              <img src={activeConversation.avatarUrl} alt="" className="w-full h-full rounded-xl object-cover" />
            ) : activeConversation.type === 'private' ? (
              getAvatarInitial()
            ) : (
              getConversationIcon()
            )}
          </motion.div>
          <div>
            <h2 className={cn(
              'font-bold text-lg',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {getConversationName()}
            </h2>
            <p className={cn(
              'text-xs flex items-center gap-2',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              {activeConversation.type === 'private' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className={cn(
                'px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all',
                showPinnedMessages
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                  : theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Pin className="w-4 h-4" />
              <span>{pinnedMessages.length}</span>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <MoreVertical className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Pinned messages banner */}
      <AnimatePresence>
        {showPinnedMessages && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              'border-b overflow-hidden',
              theme === 'dark'
                ? 'bg-gradient-to-r from-amber-900/20 to-orange-900/20 border-amber-800/30'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
            )}
          >
            <div className="p-4 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center',
                  'bg-gradient-to-br from-amber-500 to-orange-500'
                )}>
                  <Pin className="w-3.5 h-3.5 text-white" />
                </div>
                <span className={cn(
                  'text-sm font-bold',
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                )}>
                  Mensajes fijados
                </span>
              </div>
              {pinnedMessages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'p-3 rounded-xl text-sm mb-2 last:mb-0 border-l-2 border-amber-500',
                    theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-sm'
                  )}
                >
                  <span className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {msg.sender.name}:
                  </span>{' '}
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                    {msg.content?.substring(0, 100)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={cn(
          'flex-1 overflow-y-auto px-4 py-4',
          theme === 'dark'
            ? 'bg-gradient-to-b from-gray-950 to-gray-900'
            : 'bg-gradient-to-b from-gray-50/50 to-white'
        )}
      >
        {/* Loading more */}
        {isLoadingMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className={cn(
                'w-6 h-6',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
              )} />
            </motion.div>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1]
            const showSender = !prevMessage ||
              prevMessage.sender.id !== message.sender.id ||
              new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
              >
                <MessageBubble
                  message={message}
                  showSender={showSender}
                  onReply={() => handleReply(message)}
                  isOwnMessage={false}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToBottom}
            className={cn(
              'absolute bottom-24 right-6 p-3 rounded-full shadow-lg transition-all z-10',
              'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
              'shadow-blue-500/25 hover:shadow-blue-500/40'
            )}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

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
