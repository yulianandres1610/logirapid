'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useChatContext } from '@/contexts/ChatContext'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, X, Image as ImageIcon, File, Smile, Loader2, Square, Reply
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

const EMOJI_QUICK = ['👍', '❤️', '😂', '👏', '🔥', '✨', '🎉', '💯']

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'px-4 py-4 text-center border-t',
          theme === 'dark'
            ? 'border-gray-800 bg-gray-900/50 text-gray-500'
            : 'border-gray-100 bg-gray-50 text-gray-500'
        )}
      >
        <p className="text-sm">Solo administradores pueden publicar en este canal</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'border-t flex-shrink-0',
        theme === 'dark'
          ? 'border-gray-800 bg-gradient-to-r from-gray-900/80 to-gray-950/80 backdrop-blur-xl'
          : 'border-gray-100 bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-xl'
      )}
    >
      {/* Reply preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              'border-b overflow-hidden',
              theme === 'dark' ? 'border-gray-800 bg-blue-500/5' : 'border-gray-100 bg-blue-50/50'
            )}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Reply className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-semibold',
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
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onCancelReply}
                className={cn(
                  'p-1.5 rounded-lg',
                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                )}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording UI */}
      {isRecording ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 py-4 flex items-center gap-4"
        >
          <div className="flex items-center gap-3 flex-1">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50"
            />
            <span className={cn(
              'font-mono text-lg font-semibold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {formatRecordingTime(recordingTime)}
            </span>
            <div className="flex-1 h-6 flex items-center gap-0.5">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: [4, Math.random() * 20 + 4, 4] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                  className="w-1 rounded-full bg-gradient-to-t from-red-500 to-pink-500"
                />
              ))}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={cancelRecording}
            className={cn(
              'p-2.5 rounded-xl',
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <X className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={stopRecording}
            className="p-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
          >
            <Square className="w-5 h-5 fill-current" />
          </motion.button>
        </motion.div>
      ) : (
        <div className="px-4 py-3 flex items-end gap-3">
          {/* Attachments */}
          <div className="flex items-center gap-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <ImageIcon className="w-5 h-5" />
            </motion.button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Paperclip className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Input */}
          <div className={cn(
            'flex-1 rounded-2xl overflow-hidden transition-all',
            theme === 'dark'
              ? 'bg-gray-800 focus-within:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500/50'
              : 'bg-white border border-gray-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-lg'
          )}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              disabled={isSending}
              className={cn(
                'w-full px-4 py-3 resize-none outline-none bg-transparent',
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              )}
              style={{ maxHeight: '120px' }}
            />
          </div>

          {/* Emoji */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                showEmojiPicker
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-500'
              )}
            >
              <Smile className="w-5 h-5" />
            </motion.button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className={cn(
                    'absolute bottom-full right-0 mb-2 p-2 rounded-2xl shadow-xl flex gap-1',
                    theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                  )}
                >
                  {EMOJI_QUICK.map(emoji => (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addEmoji(emoji)}
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

          {/* Voice or Send */}
          {content.trim() ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={isSending}
              className={cn(
                'p-3 rounded-xl transition-all',
                'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
                'shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40',
                isSending && 'opacity-50'
              )}
            >
              {isSending ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 className="w-5 h-5" />
                </motion.div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startRecording}
              disabled={isSending}
              className={cn(
                'p-3 rounded-xl transition-all',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              )}
            >
              <Mic className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  )
}
