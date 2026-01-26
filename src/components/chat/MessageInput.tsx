'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import {
  Send, Paperclip, Mic, X, Image as ImageIcon, File, Smile, Loader2, Square
} from 'lucide-react'

interface ReplyingTo {
  id: number
  content: string
  senderName: string
}

interface MessageInputProps {
  replyingTo: ReplyingTo | null
  onCancelReply: () => void
  conversationType: 'private' | 'group' | 'channel'
  userRole: 'admin' | 'member'
}

const EMOJI_QUICK = ['👍', '❤️', '😂', '👏', '🔥', '✨']

export function MessageInput({
  replyingTo,
  onCancelReply,
  conversationType,
  userRole
}: MessageInputProps) {
  const { theme } = useTheme()
  const { sendMessage, activeConversation } = useChatContext()

  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user can post
  const canPost = conversationType !== 'channel' || userRole === 'admin'

  const handleSend = async () => {
    if (!content.trim() || isSending || !activeConversation) return

    setIsSending(true)
    try {
      await sendMessage(content.trim(), 'text', undefined, replyingTo?.id)
      setContent('')
      onCancelReply()
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (file: File, messageType: 'image' | 'file' | 'audio') => {
    if (!activeConversation) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('messageType', messageType)

    setIsSending(true)
    try {
      const res = await fetch('/api/market/chat/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (data.success) {
        await sendMessage(
          file.name,
          messageType,
          {
            fileUrl: data.data.fileUrl,
            fileName: data.data.fileName,
            fileSize: data.data.fileSize,
            fileType: data.data.fileType
          },
          replyingTo?.id
        )
        onCancelReply()
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file, 'image')
    }
    e.target.value = ''
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file, 'file')
    }
    e.target.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        // Create file from blob
        const fileName = `audio_${Date.now()}.webm`
        const file = new window.File([audioBlob], fileName, { type: 'audio/webm' })
        await handleFileUpload(file, 'audio')

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      audioChunksRef.current = []
      setIsRecording(false)

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const addEmoji = (emoji: string) => {
    setContent(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  if (!canPost) {
    return (
      <div className={cn(
        'px-4 py-3 text-center border-t',
        theme === 'dark' ? 'border-gray-700 bg-gray-800 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-500'
      )}>
        Solo administradores pueden publicar en este canal
      </div>
    )
  }

  return (
    <div className={cn(
      'border-t flex-shrink-0',
      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
    )}>
      {/* Reply preview */}
      {replyingTo && (
        <div className={cn(
          'px-4 py-2 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'
        )}>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-xs font-medium',
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )}>
              Respondiendo a {replyingTo.senderName}
            </p>
            <p className={cn(
              'text-sm truncate',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className={cn(
              'p-1 rounded',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recording UI */}
      {isRecording ? (
        <div className="px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className={cn(
              'font-mono',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {formatRecordingTime(recordingTime)}
            </span>
          </div>
          <button
            onClick={cancelRecording}
            className={cn(
              'p-2 rounded-full',
              theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={stopRecording}
            className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 flex items-end gap-2">
          {/* Attachments */}
          <div className="flex items-center gap-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          {/* Input */}
          <div className={cn(
            'flex-1 rounded-2xl border overflow-hidden',
            theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
          )}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              disabled={isSending}
              className={cn(
                'w-full px-4 py-2.5 resize-none outline-none bg-transparent',
                theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
              )}
              style={{ maxHeight: '120px' }}
            />
          </div>

          {/* Emoji */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Smile className="w-5 h-5" />
            </button>

            {showEmojiPicker && (
              <div className={cn(
                'absolute bottom-full right-0 mb-2 p-2 rounded-xl shadow-lg flex gap-1',
                theme === 'dark' ? 'bg-gray-700' : 'bg-white border border-gray-200'
              )}>
                {EMOJI_QUICK.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className={cn(
                      'p-1.5 rounded-lg text-lg hover:scale-125 transition-transform',
                      theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice or Send */}
          {content.trim() ? (
            <button
              onClick={handleSend}
              disabled={isSending}
              className={cn(
                'p-3 rounded-full transition-colors',
                'bg-blue-500 hover:bg-blue-600 text-white',
                isSending && 'opacity-50'
              )}
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={isSending}
              className={cn(
                'p-3 rounded-full transition-colors',
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              )}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
