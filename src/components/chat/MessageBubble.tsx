'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
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
      <div className={cn('mb-2', showSender ? 'mt-4' : '')}>
        <div className={cn(
          'inline-block px-4 py-2 rounded-2xl italic text-sm',
          theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
        )}>
          Mensaje eliminado
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('mb-2 group relative', showSender ? 'mt-4' : '')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        setShowEmojiPicker(false)
      }}
    >
      {/* Sender name */}
      {showSender && (
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            'font-semibold text-sm',
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
            <Pin className={cn(
              'w-3 h-3',
              theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'
            )} />
          )}
        </div>
      )}

      {/* Reply quote */}
      {message.replyToMessage && (
        <div className={cn(
          'mb-1 px-3 py-1.5 border-l-2 rounded text-sm',
          theme === 'dark'
            ? 'border-blue-500 bg-gray-800/50 text-gray-400'
            : 'border-blue-500 bg-gray-50 text-gray-500'
        )}>
          <span className="font-medium">{message.replyToMessage.senderName}: </span>
          {message.replyToMessage.content.substring(0, 50)}
        </div>
      )}

      {/* Message content */}
      <div className="flex items-start gap-2">
        <div className={cn(
          'inline-block max-w-xl',
          message.messageType === 'text' && cn(
            'px-4 py-2 rounded-2xl',
            theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
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
                    'flex-1 bg-transparent outline-none',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit()
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                />
                <button onClick={handleEdit} className="text-green-500">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditing(false)} className="text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.editedAt && (
                  <span className={cn(
                    'text-xs',
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
            <div className="rounded-xl overflow-hidden">
              <img
                src={signedUrl}
                alt={message.fileName || 'Imagen'}
                className="max-w-sm max-h-80 object-contain"
              />
            </div>
          )}

          {/* Audio */}
          {message.messageType === 'audio' && (
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            )}>
              <button
                onClick={toggleAudio}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500',
                  'text-white'
                )}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex-1">
                <div className={cn(
                  'h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                )}>
                  <div className="h-full w-0 bg-blue-500 rounded-full" />
                </div>
              </div>
              <Volume2 className={cn(
                'w-4 h-4',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
            </div>
          )}

          {/* File */}
          {message.messageType === 'file' && (
            <a
              href={signedUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl',
                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              )}
            >
              <FileText className={cn(
                'w-10 h-10',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
              )} />
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
              <Download className={cn(
                'w-5 h-5',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
            </a>
          )}
        </div>

        {/* Actions */}
        {showActions && !isEditing && (
          <div className={cn(
            'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                'p-1.5 rounded-lg',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              )}
            >
              <Smile className="w-4 h-4" />
            </button>
            <button
              onClick={onReply}
              className={cn(
                'p-1.5 rounded-lg',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              )}
            >
              <Reply className="w-4 h-4" />
            </button>
            <button
              onClick={togglePin}
              className={cn(
                'p-1.5 rounded-lg',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
                message.isPinned && 'text-yellow-500'
              )}
            >
              <Pin className="w-4 h-4" />
            </button>
            {message.messageType === 'text' && (
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  'p-1.5 rounded-lg',
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                )}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className={cn(
                'p-1.5 rounded-lg hover:text-red-500',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              )}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className={cn(
            'absolute left-0 mt-1 p-2 rounded-xl shadow-lg flex gap-1 z-10',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
          )}>
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={cn(
                  'p-1.5 rounded-lg text-lg hover:scale-125 transition-transform',
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reactions */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {Object.entries(groupedReactions).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              )}
              title={users.join(', ')}
            >
              <span>{emoji}</span>
              <span>{users.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
