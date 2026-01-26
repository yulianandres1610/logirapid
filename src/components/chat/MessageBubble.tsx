'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreVertical, Reply, Smile, Pin, Clock, Trash2, Edit, Check, X,
  Image as ImageIcon, FileText, Volume2, Play, Pause, Download
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface MessageBubbleProps {
  message: {
    id: number
    content: string | null
    messageType: 'text' | 'image' | 'audio' | 'file'
    fileUrl?: string | null
    fileName?: string | null
    fileSize?: number
    fileType?: string
    replyToId?: number | null
    replyToMessage?: {
      id: number
      content: string
      senderName: string
    } | null
    isPinned: boolean
    isDeleted: boolean
    createdAt: string
    editedAt?: string | null
    sender: {
      id: number
      name: string
      email: string
    }
    reactions: Array<{
      emoji: string
      userId: number
      userName: string
    }>
  }
  showSender: boolean
  onReply: () => void
  isOwnMessage: boolean
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function MessageBubble({ message, showSender, onReply }: MessageBubbleProps) {
  const { theme } = useTheme()
  const { addReaction, removeReaction, pinMessage, unpinMessage, editMessage, deleteMessage } = useChatContext()

  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content || '')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

  // Get current user ID from cookie (simplified check)
  const isOwn = typeof window !== 'undefined' && document.cookie.includes(`user-id=${message.sender.id}`)

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

  // Fetch signed URL for files
  useEffect(() => {
    if (message.fileUrl && !message.isDeleted) {
      fetch(`/api/market/chat/upload?fileUrl=${encodeURIComponent(message.fileUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setSignedUrl(data.data.signedUrl)
        })
        .catch(() => {})
    }
  }, [message.fileUrl, message.isDeleted])

  const handleReaction = (emoji: string) => {
    const hasReaction = message.reactions.some(r => r.emoji === emoji && r.userId === message.sender.id)
    if (hasReaction) {
      removeReaction(message.id, emoji)
    } else {
      addReaction(message.id, emoji)
    }
    setShowEmojiPicker(false)
  }

  const handleEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      editMessage(message.id, editContent)
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (confirm('¿Eliminar este mensaje?')) {
      deleteMessage(message.id)
    }
  }

  const togglePin = () => {
    if (message.isPinned) {
      unpinMessage(message.id)
    } else {
      pinMessage(message.id)
    }
  }

  const toggleAudio = () => {
    if (!audioRef && signedUrl) {
      const audio = new Audio(signedUrl)
      audio.onended = () => setIsPlaying(false)
      setAudioRef(audio)
      audio.play()
      setIsPlaying(true)
    } else if (audioRef) {
      if (isPlaying) {
        audioRef.pause()
        setIsPlaying(false)
      } else {
        audioRef.play()
        setIsPlaying(true)
      }
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Group reactions by emoji
  const groupedReactions = message.reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = []
    acc[r.emoji].push(r.userName)
    return acc
  }, {} as Record<string, string[]>)

  if (message.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn('mb-2', showSender ? 'mt-4' : '')}
      >
        <div className={cn(
          'inline-block px-4 py-2 rounded-2xl italic text-sm',
          theme === 'dark' ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-100 text-gray-400'
        )}>
          Mensaje eliminado
        </div>
      </motion.div>
    )
  }

  return (
    <div
      className={cn('mb-3 group relative', showSender ? 'mt-5' : '')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        setShowEmojiPicker(false)
      }}
    >
      {/* Sender info */}
      {showSender && (
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md',
            'bg-gradient-to-br',
            getAvatarGradient(message.sender.name)
          )}>
            {message.sender.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-semibold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {message.sender.name}
            </span>
            <span className={cn(
              'text-xs',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
            </span>
            {message.isPinned && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center"
              >
                <Pin className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Reply quote */}
      {message.replyToMessage && (
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            'mb-2 ml-11 px-3 py-2 border-l-3 rounded-r-xl text-sm',
            theme === 'dark'
              ? 'border-blue-500 bg-blue-500/10 text-gray-400'
              : 'border-blue-500 bg-blue-50 text-gray-500'
          )}
        >
          <span className={cn(
            'font-medium',
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          )}>
            {message.replyToMessage.senderName}:
          </span>{' '}
          {message.replyToMessage.content.substring(0, 50)}
        </motion.div>
      )}

      {/* Message content */}
      <div className={cn('flex items-start gap-2', showSender ? 'ml-11' : 'ml-11')}>
        <div className={cn(
          'inline-block max-w-xl',
          message.messageType === 'text' && cn(
            'px-4 py-2.5 rounded-2xl shadow-sm',
            theme === 'dark'
              ? 'bg-gradient-to-br from-gray-800 to-gray-800/80 text-white'
              : 'bg-white text-gray-900 border border-gray-100'
          )
        )}>
          {/* Text */}
          {message.messageType === 'text' && (
            isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={cn(
                    'flex-1 bg-transparent outline-none min-w-[200px]',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit()
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleEdit}
                  className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white"
                >
                  <Check className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsEditing(false)}
                  className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                {message.editedAt && (
                  <span className={cn(
                    'text-xs italic ml-1',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    (editado)
                  </span>
                )}
              </>
            )
          )}

          {/* Image */}
          {message.messageType === 'image' && signedUrl && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="rounded-xl overflow-hidden shadow-lg"
            >
              <img
                src={signedUrl}
                alt={message.fileName || 'Imagen'}
                className="max-w-sm max-h-80 object-contain"
              />
            </motion.div>
          )}

          {/* Audio */}
          {message.messageType === 'audio' && (
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[250px]',
              theme === 'dark'
                ? 'bg-gradient-to-r from-gray-800 to-gray-700'
                : 'bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200'
            )}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleAudio}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg',
                  'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-500/25'
                )}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </motion.button>
              <div className="flex-1">
                <div className={cn(
                  'h-1.5 rounded-full overflow-hidden',
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                )}>
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: isPlaying ? '100%' : 0 }}
                    transition={{ duration: 3, ease: 'linear' }}
                  />
                </div>
                <p className={cn(
                  'text-xs mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Nota de voz
                </p>
              </div>
              <Volume2 className={cn(
                'w-5 h-5',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
            </div>
          )}

          {/* File */}
          {message.messageType === 'file' && (
            <motion.a
              whileHover={{ scale: 1.02 }}
              href={signedUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all',
                theme === 'dark'
                  ? 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600'
                  : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md'
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium truncate',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {message.fileName}
                </p>
                <p className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {formatFileSize(message.fileSize)}
                </p>
              </div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-100'
                )}
              >
                <Download className={cn(
                  'w-4 h-4',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                )} />
              </motion.div>
            </motion.a>
          )}
        </div>

        {/* Actions */}
        <AnimatePresence>
          {showActions && !isEditing && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={cn(
                'flex items-center gap-0.5 p-1 rounded-xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-lg'
              )}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <Smile className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onReply}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <Reply className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePin}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  message.isPinned
                    ? 'text-amber-500 bg-amber-500/10'
                    : theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <Pin className="w-4 h-4" />
              </motion.button>
              {message.messageType === 'text' && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  )}
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDelete}
                className={cn(
                  'p-2 rounded-lg transition-colors hover:text-red-500',
                  theme === 'dark' ? 'hover:bg-red-500/10 text-gray-400' : 'hover:bg-red-50 text-gray-500'
                )}
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className={cn(
                'absolute left-11 mt-1 p-2 rounded-2xl shadow-xl flex gap-1 z-10',
                theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
              )}
            >
              {EMOJI_OPTIONS.map(emoji => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleReaction(emoji)}
                  className={cn(
                    'p-2 rounded-xl text-xl transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reactions */}
      {Object.keys(groupedReactions).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-1.5 mt-2 ml-11"
        >
          {Object.entries(groupedReactions).map(([emoji, users]) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleReaction(emoji)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
              )}
              title={users.join(', ')}
            >
              <span className="text-sm">{emoji}</span>
              <span>{users.length}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  )
}
