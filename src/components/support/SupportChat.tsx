'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  X,
  Send,
  Paperclip,
  Loader2,
  Bot,
  User,
  AlertTriangle,
  Trash2,
  Image as ImageIcon,
  Headphones,
  HelpCircle
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { usePathname } from 'next/navigation'
import type { SupportMessage, UserContext } from '@/types/support'

interface SupportChatProps {
  userContext: {
    userId: number
    role: string
    companyType: string
    companyId: number
    companyName: string
  }
  isOpen?: boolean
  onClose?: () => void
}

// Typing Indicator Component - 3 dots animation
const TypingIndicator = () => {
  return (
    <div className="flex items-center gap-1 py-2 px-1">
      <motion.span
        className="w-2 h-2 rounded-full bg-gray-400"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className="w-2 h-2 rounded-full bg-gray-400"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.span
        className="w-2 h-2 rounded-full bg-gray-400"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </div>
  )
}

// Format message content with links and markdown-like formatting
const FormattedMessage = ({ content, isDark }: { content: string; isDark: boolean }) => {
  // Convert markdown-like links and formatting to JSX
  const formatText = (text: string) => {
    // Split by lines for better formatting
    const lines = text.split('\n')

    return lines.map((line, lineIndex) => {
      // Check for numbered list items
      const numberedMatch = line.match(/^(\d+)\.\s*(.*)/)
      if (numberedMatch) {
        return (
          <div key={lineIndex} className="flex gap-2 my-1">
            <span className="font-semibold text-blue-500 min-w-[20px]">{numberedMatch[1]}.</span>
            <span>{formatInlineContent(numberedMatch[2], isDark)}</span>
          </div>
        )
      }

      // Check for bullet points
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={lineIndex} className="flex gap-2 my-1">
            <span className="text-blue-500">•</span>
            <span>{formatInlineContent(line.substring(2), isDark)}</span>
          </div>
        )
      }

      // Check for headers (lines starting with **)
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <div key={lineIndex} className="font-semibold mt-2 mb-1">
            {line.replace(/\*\*/g, '')}
          </div>
        )
      }

      // Regular line
      if (line.trim()) {
        return (
          <p key={lineIndex} className="my-1">
            {formatInlineContent(line, isDark)}
          </p>
        )
      }

      // Empty line for spacing
      return <div key={lineIndex} className="h-2" />
    })
  }

  // Format inline content (bold, links, etc.)
  const formatInlineContent = (text: string, isDark: boolean): React.ReactNode => {
    // Match URLs and make them clickable
    const urlRegex = /(\/dashboard\/[^\s]+|https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)

    return parts.map((part, index) => {
      // Check if this part is a dashboard link
      if (part.startsWith('/dashboard/')) {
        return (
          <a
            key={index}
            href={part}
            className={`font-medium underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
          >
            {formatPathToLabel(part)}
          </a>
        )
      }

      // Check if this part is an external URL
      if (part.startsWith('http')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
          >
            {part}
          </a>
        )
      }

      // Format bold text **text**
      const boldParts = part.split(/\*\*(.*?)\*\*/g)
      return boldParts.map((boldPart, boldIndex) => {
        if (boldIndex % 2 === 1) {
          return <strong key={`${index}-${boldIndex}`}>{boldPart}</strong>
        }
        return boldPart
      })
    })
  }

  // Convert path to readable label
  const formatPathToLabel = (path: string): string => {
    const pathLabels: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/dashboard/market/inventory': 'Inventario',
      '/dashboard/market/inventory/create': 'Crear Producto',
      '/dashboard/market/warehouses': 'Almacenes',
      '/dashboard/market/marketplace': 'Marketplace',
      '/dashboard/market/marketplace/create': 'Nueva Publicacion',
      '/dashboard/market/purchases': 'Compras',
      '/dashboard/market/consignments': 'Consignaciones',
      '/dashboard/market/consignments/create': 'Nueva Consignacion',
      '/dashboard/agency/orders': 'Ordenes de Paquetes',
      '/dashboard/agency/orders/create': 'Nueva Orden',
      '/dashboard/agency/clients': 'Clientes',
      '/dashboard/agency/routes': 'Rutas',
      '/dashboard/wallet': 'Wallet',
      '/dashboard/reports': 'Reportes',
      '/dashboard/settings': 'Configuracion',
      '/dashboard/support': 'Soporte'
    }
    return pathLabels[path] || path
  }

  return <div className="text-sm leading-relaxed">{formatText(content)}</div>
}

export default function SupportChat({ userContext, isOpen: externalIsOpen, onClose }: SupportChatProps) {
  const { theme } = useTheme()
  const pathname = usePathname()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const handleClose = () => {
    if (onClose) onClose()
    else setInternalIsOpen(false)
  }
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showEscalate, setShowEscalate] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isDark = theme === 'dark'

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load conversation from localStorage on mount
  useEffect(() => {
    const savedConversation = localStorage.getItem('support_conversation')
    if (savedConversation) {
      try {
        const parsed = JSON.parse(savedConversation)
        setMessages(parsed.messages || [])
        setConversationId(parsed.conversationId || null)
      } catch {
        // Invalid data, clear it
        localStorage.removeItem('support_conversation')
      }
    }
  }, [])

  // Save conversation to localStorage
  useEffect(() => {
    if (messages.length > 0 || conversationId) {
      localStorage.setItem('support_conversation', JSON.stringify({
        messages,
        conversationId
      }))
    }
  }, [messages, conversationId])

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen valida')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen debe ser menor a 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    setImageFile(file)
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('folder', 'support-screenshots')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error al subir imagen')
      }

      const data = await response.json()
      return data.url || null
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const clearImage = () => {
    setImagePreview(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    if ((!inputMessage.trim() && !imageFile) || isLoading) return

    const messageText = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Upload image if present
    let imageUrl: string | undefined
    if (imageFile) {
      imageUrl = (await uploadImage()) || undefined
      clearImage()
    }

    // Add user message to UI
    const userMessage: SupportMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: messageText || 'Imagen adjunta',
      imageUrl,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    // Add loading message (typing indicator)
    const loadingMessage: SupportMessage = {
      id: `msg_${Date.now()}_loading`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }
    setMessages(prev => [...prev, loadingMessage])

    try {
      const context: UserContext = {
        ...userContext,
        currentPage: pathname
      }

      const response = await fetch('/api/ai/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          imageUrl,
          conversationId,
          conversationHistory: messages,
          userContext: context
        })
      })

      const data = await response.json()

      // Remove loading message
      setMessages(prev => prev.filter(m => !m.isLoading))

      if (data.success) {
        // Add assistant response
        const assistantMessage: SupportMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])

        // Save conversation ID
        if (data.conversationId) {
          setConversationId(data.conversationId)
        }

        // Show escalate option if AI couldn't resolve
        if (data.escalate || !data.data.canResolve) {
          setShowEscalate(true)
        }
      } else {
        // Error message
        const errorMessage: SupportMessage = {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => prev.filter(m => !m.isLoading))
      const errorMessage: SupportMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Error de conexion. Por favor verifica tu conexion e intenta de nuevo.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearConversation = () => {
    setMessages([])
    setConversationId(null)
    setShowEscalate(false)
    localStorage.removeItem('support_conversation')
  }

  const escalateToSupport = async () => {
    // Create ticket with conversation history
    try {
      const lastMessages = messages.slice(-10).map(m => m.content).join('\n\n')
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Solicitud de soporte desde chat',
          description: `Conversacion del chat:\n\n${lastMessages}`,
          conversationId,
          screenshots: messages.filter(m => m.imageUrl).map(m => m.imageUrl),
          priority: 'medium'
        })
      })

      const data = await response.json()
      if (data.success) {
        const systemMessage: SupportMessage = {
          id: `msg_${Date.now()}_system`,
          role: 'system',
          content: `Tu solicitud ha sido enviada al equipo de soporte. Ticket: ${data.data.ticketCode}. Te contactaremos pronto.`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, systemMessage])
        setShowEscalate(false)
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
    }
  }

  return (
    <>
      {/* Chat Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl overflow-hidden flex flex-col
              ${isDark ? 'bg-gray-900/95' : 'bg-white/95'}
              backdrop-blur-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
            style={{
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Header - Brand Blue */}
            <div className={`px-4 py-3 flex items-center justify-between border-b bg-[#3B82F6]
              ${isDark ? 'border-blue-600' : 'border-blue-400'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">
                    Asistente LogiRapid
                  </h3>
                  <p className="text-xs text-blue-100">
                    Siempre disponible
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearConversation}
                    className="p-2 rounded-lg transition-colors hover:bg-white/20 text-white/80"
                    title="Limpiar conversacion"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg transition-colors hover:bg-white/20 text-white/80"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-blue-500/20`}>
                    <HelpCircle className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <h4 className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Hola! Como puedo ayudarte?
                  </h4>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Preguntame sobre cualquier funcionalidad del sistema.
                    Puedes adjuntar capturas de pantalla.
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}
                    ${msg.role === 'system' ? 'justify-center' : ''}`}
                >
                  {msg.role === 'system' ? (
                    <div className={`px-3 py-2 rounded-lg text-xs text-center max-w-[90%]
                      ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                        ${msg.role === 'user'
                          ? 'bg-[#3B82F6]'
                          : isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        {msg.role === 'user'
                          ? <User className="w-4 h-4 text-white" />
                          : <Bot className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />}
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-[#3B82F6] text-white rounded-br-md'
                          : isDark
                            ? 'bg-gray-800 text-gray-100 rounded-bl-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {msg.isLoading ? (
                          <TypingIndicator />
                        ) : (
                          <>
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt="Captura"
                                className="max-w-full rounded-lg mb-2 cursor-pointer"
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                              />
                            )}
                            {msg.role === 'user' ? (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <FormattedMessage content={msg.content} isDark={isDark} />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Escalate Button */}
              {showEscalate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <button
                    onClick={escalateToSupport}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      ${isDark
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                  >
                    <Headphones className="w-4 h-4" />
                    Hablar con soporte humano
                  </button>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div className={`px-4 py-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-16 rounded-lg"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white
                      flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className={`p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`flex items-end gap-2 rounded-xl p-2
                ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className={`p-2 rounded-lg transition-colors
                    ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                  title="Adjuntar imagen"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  rows={1}
                  className={`flex-1 resize-none bg-transparent outline-none text-sm
                    ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                  style={{ maxHeight: '100px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || (!inputMessage.trim() && !imageFile)}
                  className={`p-2 rounded-lg transition-colors
                    ${(inputMessage.trim() || imageFile) && !isLoading
                      ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                      : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
