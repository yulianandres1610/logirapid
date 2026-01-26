'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import {
  Reply, Smile, Pin, Edit, Check, CheckCheck, X,
  FileText, Play, Pause, Download
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
    readBy?: Array<{ id: number; name: string }>
    isReadByAll?: boolean
  }
  showSender: boolean
  onReply: () => void
  isOwnMessage: boolean
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function MessageBubble({ message, showSender, onReply, isOwnMessage }: MessageBubbleProps) {
  const { theme } = useTheme()
  const { addReaction, removeReaction, pinMessage, unpinMessage, editMessage } = useChatContext()

  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content || '')
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

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
      <div className={cn('mb-2', showSender ? 'mt-3' : '')}>
        <div className={cn(
          'inline-block px-3 py-1.5 rounded-lg italic text-sm',
          theme === 'dark' ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-100 text-gray-400'
        )}>
          Mensaje eliminado
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('mb-2 group relative', showSender ? 'mt-3' : '')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        setShowEmojiPicker(false)
      }}
    >
      {/* Sender info */}
      {showSender && (
        <div className="flex items-center gap-2 mb-1">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium',
            getAvatarBg(message.sender.name)
          )}>
            {message.sender.name.charAt(0).toUpperCase()}
          </div>
          <span className={cn(
            'font-medium text-sm',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {message.sender.name}
          </span>
          <span className={cn(
            'text-xs flex items-center gap-1',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
            {isOwnMessage && (
              message.isReadByAll ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )
            )}
          </span>
          {message.isPinned && (
            <Pin className="w-3 h-3 text-amber-500" />
          )}
        </div>
      )}

      {/* Reply quote */}
      {message.replyToMessage && (
        <div className={cn(
          'mb-1 ml-9 px-2 py-1 border-l-2 rounded-r text-xs',
          theme === 'dark'
            ? 'border-blue-500 bg-blue-500/10 text-gray-400'
            : 'border-blue-500 bg-blue-50 text-gray-500'
        )}>
          <span className={cn('font-medium', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
            {message.replyToMessage.senderName}:
          </span>{' '}
          {message.replyToMessage.content.substring(0, 50)}
        </div>
      )}

      {/* Message content */}
      <div className={cn('flex items-start gap-2', showSender ? 'ml-9' : 'ml-9')}>
        <div className={cn(
          'inline-block max-w-lg',
          message.messageType === 'text' && cn(
            'px-3 py-2 rounded-lg text-sm',
            theme === 'dark'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-900 border border-gray-200'
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
                    'flex-1 bg-transparent outline-none min-w-[180px] text-sm',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit()
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                />
                <button
                  onClick={handleEdit}
                  className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.editedAt && (
                  <span className={cn(
                    'text-xs italic',
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
            <div className="rounded-lg overflow-hidden">
              <img
                src={signedUrl}
                alt={message.fileName || 'Imagen'}
                className="max-w-xs max-h-64 object-contain"
              />
            </div>
          )}

          {/* Audio */}
          {message.messageType === 'audio' && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg min-w-[200px]',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <button
                onClick={toggleAudio}
                className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1">
                <div className={cn(
                  'h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                )}>
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: isPlaying ? '100%' : '0%' }}
                  />
                </div>
                <p className={cn('text-xs mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Nota de voz
                </p>
              </div>
            </div>
          )}

          {/* File */}
          {message.messageType === 'file' && (
            <a
              href={signedUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg',
                theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {message.fileName}
                </p>
                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {formatFileSize(message.fileSize)}
                </p>
              </div>
              <Download className={cn('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
            </a>
          )}
        </div>

        {/* Actions */}
        {showActions && !isEditing && (
          <div className={cn(
            'flex items-center gap-0.5 p-1 rounded-lg',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'
          )}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                'p-1.5 rounded transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onReply}
              className={cn(
                'p-1.5 rounded transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={togglePin}
              className={cn(
                'p-1.5 rounded transition-colors',
                message.isPinned ? 'text-amber-500' : theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            {message.messageType === 'text' && (
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className={cn(
            'absolute left-9 mt-8 p-1.5 rounded-lg shadow-lg flex gap-0.5 z-10',
            theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          )}>
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={cn(
                  'p-1.5 rounded text-base transition-colors',
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
        <div className="flex flex-wrap gap-1 mt-1 ml-9">
          {Object.entries(groupedReactions).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
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
