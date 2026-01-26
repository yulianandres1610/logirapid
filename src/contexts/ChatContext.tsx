'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

interface User {
  id: number
  name: string
  email: string
}

interface Presence {
  status: 'online' | 'away' | 'offline'
  lastSeenAt?: string
}

interface Participant {
  id: number
  userId: number
  name: string
  email: string
  role: 'admin' | 'member'
  joinedAt: string
  presence?: Presence
}

interface Reaction {
  emoji: string
  userId: number
  userName: string
}

interface Message {
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
  pinnedBy?: number | null
  pinnedAt?: string | null
  isDeleted: boolean
  createdAt: string
  editedAt?: string | null
  sender: User
  reactions: Reaction[]
}

interface Conversation {
  id: number
  type: 'private' | 'group' | 'channel'
  name: string | null
  description?: string | null
  avatarUrl?: string | null
  userRole: 'admin' | 'member'
  isMuted: boolean
  unreadCount: number
  lastMessage?: {
    id: number
    content: string
    message_type: string
    sender_id: number
    created_at: string
  } | null
  otherParticipant?: User | null
  participantCount: number
  lastReadAt?: string | null
  createdAt: string
  updatedAt: string
}

interface CompanyUser {
  id: number
  name: string
  email: string
  role: string
  presence: Presence
}

interface ChatContextType {
  // State
  conversations: Conversation[]
  activeConversation: Conversation | null
  messages: Message[]
  participants: Participant[]
  companyUsers: CompanyUser[]
  presenceUsers: CompanyUser[]
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  hasMoreMessages: boolean

  // Actions
  fetchConversations: (search?: string) => Promise<void>
  selectConversation: (conversationId: number) => Promise<void>
  fetchMessages: (beforeId?: number) => Promise<void>
  sendMessage: (content: string, messageType?: string, fileData?: {
    fileUrl: string
    fileName: string
    fileSize: number
    fileType: string
  }, replyToId?: number) => Promise<Message | null>
  createConversation: (type: string, participantIds: number[], name?: string, description?: string) => Promise<number | null>
  fetchCompanyUsers: (search?: string) => Promise<void>
  updatePresence: () => Promise<void>
  addReaction: (messageId: number, emoji: string) => Promise<void>
  removeReaction: (messageId: number, emoji: string) => Promise<void>
  pinMessage: (messageId: number) => Promise<void>
  unpinMessage: (messageId: number) => Promise<void>
  editMessage: (messageId: number, content: string) => Promise<void>
  deleteMessage: (messageId: number) => Promise<void>

  // Real-time
  subscribeToConversation: (conversationId: number) => void
  unsubscribeFromConversation: () => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [presenceUsers, setPresenceUsers] = useState<CompanyUser[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Supabase client
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      supabaseRef.current = createClient(supabaseUrl, supabaseAnonKey)
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current)
      }
    }
  }, [])

  // Start presence heartbeat
  useEffect(() => {
    updatePresence()
    presenceIntervalRef.current = setInterval(updatePresence, 30000)

    // Mark offline on page unload
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/market/chat/presence', JSON.stringify({ status: 'offline' }))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const fetchConversations = useCallback(async (search?: string) => {
    setIsLoadingConversations(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const res = await fetch(`/api/market/chat/conversations?${params}`)
      const data = await res.json()

      if (data.success) {
        setConversations(data.data)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  const selectConversation = useCallback(async (conversationId: number) => {
    const conv = conversations.find(c => c.id === conversationId)
    if (conv) {
      setActiveConversation(conv)
      setMessages([])
      setHasMoreMessages(true)

      // Fetch conversation details and messages
      try {
        const [convRes, msgRes, partRes] = await Promise.all([
          fetch(`/api/market/chat/conversations/${conversationId}`),
          fetch(`/api/market/chat/conversations/${conversationId}/messages?limit=50`),
          fetch(`/api/market/chat/conversations/${conversationId}/participants`)
        ])

        const [convData, msgData, partData] = await Promise.all([
          convRes.json(),
          msgRes.json(),
          partRes.json()
        ])

        if (convData.success) {
          setActiveConversation(prev => ({
            ...prev!,
            ...convData.data,
            unreadCount: 0
          }))
        }

        if (msgData.success) {
          setMessages(msgData.data.messages)
          setHasMoreMessages(msgData.data.hasMore)
        }

        if (partData.success) {
          setParticipants(partData.data)
        }

        // Update unread count in conversations list
        setConversations(prev => prev.map(c =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ))

        // Subscribe to real-time updates
        subscribeToConversation(conversationId)
      } catch (error) {
        console.error('Error loading conversation:', error)
      }
    }
  }, [conversations])

  const fetchMessages = useCallback(async (beforeId?: number) => {
    if (!activeConversation || isLoadingMessages) return

    setIsLoadingMessages(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (beforeId) params.set('before', String(beforeId))

      const res = await fetch(`/api/market/chat/conversations/${activeConversation.id}/messages?${params}`)
      const data = await res.json()

      if (data.success) {
        if (beforeId) {
          setMessages(prev => [...data.data.messages, ...prev])
        } else {
          setMessages(data.data.messages)
        }
        setHasMoreMessages(data.data.hasMore)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [activeConversation, isLoadingMessages])

  const sendMessage = useCallback(async (
    content: string,
    messageType = 'text',
    fileData?: { fileUrl: string; fileName: string; fileSize: number; fileType: string },
    replyToId?: number
  ): Promise<Message | null> => {
    if (!activeConversation) return null

    try {
      const body: Record<string, unknown> = { content, messageType }
      if (fileData) {
        body.fileUrl = fileData.fileUrl
        body.fileName = fileData.fileName
        body.fileSize = fileData.fileSize
        body.fileType = fileData.fileType
      }
      if (replyToId) {
        body.replyToId = replyToId
      }

      const res = await fetch(`/api/market/chat/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        const newMessage = data.data
        setMessages(prev => [...prev, newMessage])
        return newMessage
      }
      return null
    } catch (error) {
      console.error('Error sending message:', error)
      return null
    }
  }, [activeConversation])

  const createConversation = useCallback(async (
    type: string,
    participantIds: number[],
    name?: string,
    description?: string
  ): Promise<number | null> => {
    try {
      const res = await fetch('/api/market/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, participantIds, name, description })
      })

      const data = await res.json()

      if (data.success) {
        // Refresh conversations list
        await fetchConversations()
        return data.data.id
      }
      return null
    } catch (error) {
      console.error('Error creating conversation:', error)
      return null
    }
  }, [fetchConversations])

  const fetchCompanyUsers = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const res = await fetch(`/api/market/chat/users?${params}`)
      const data = await res.json()

      if (data.success) {
        setCompanyUsers(data.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  const updatePresence = useCallback(async () => {
    try {
      await fetch('/api/market/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online' })
      })

      // Also fetch presence list
      const res = await fetch('/api/market/chat/presence')
      const data = await res.json()
      if (data.success) {
        setPresenceUsers(data.data)
      }
    } catch (error) {
      console.error('Error updating presence:', error)
    }
  }, [])

  const addReaction = useCallback(async (messageId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, reactions: data.data.reactions } : m
        ))
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }, [])

  const removeReaction = useCallback(async (messageId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, reactions: data.data.reactions } : m
        ))
      }
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }, [])

  const pinMessage = useCallback(async (messageId: number) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}/pin`, {
        method: 'POST'
      })

      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, isPinned: true } : m
        ))
      }
    } catch (error) {
      console.error('Error pinning message:', error)
    }
  }, [])

  const unpinMessage = useCallback(async (messageId: number) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}/pin`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, isPinned: false } : m
        ))
      }
    } catch (error) {
      console.error('Error unpinning message:', error)
    }
  }, [])

  const editMessage = useCallback(async (messageId: number, content: string) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, content, editedAt: data.data.edited_at } : m
        ))
      }
    } catch (error) {
      console.error('Error editing message:', error)
    }
  }, [])

  const deleteMessage = useCallback(async (messageId: number) => {
    try {
      const res = await fetch(`/api/market/chat/messages/${messageId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, isDeleted: true, content: null } : m
        ))
      }
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }, [])

  const subscribeToConversation = useCallback((conversationId: number) => {
    if (!supabaseRef.current) return

    // Unsubscribe from previous channel
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    // Subscribe to new messages
    channelRef.current = supabaseRef.current
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          // Fetch the full message with sender info
          const res = await fetch(`/api/market/chat/conversations/${conversationId}/messages?after=${payload.new.id - 1}&limit=1`)
          const data = await res.json()
          if (data.success && data.data.messages.length > 0) {
            const newMsg = data.data.messages[0]
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          }
        }
      )
      .subscribe()
  }, [])

  const unsubscribeFromConversation = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const value: ChatContextType = {
    conversations,
    activeConversation,
    messages,
    participants,
    companyUsers,
    presenceUsers,
    isLoadingConversations,
    isLoadingMessages,
    hasMoreMessages,
    fetchConversations,
    selectConversation,
    fetchMessages,
    sendMessage,
    createConversation,
    fetchCompanyUsers,
    updatePresence,
    addReaction,
    removeReaction,
    pinMessage,
    unpinMessage,
    editMessage,
    deleteMessage,
    subscribeToConversation,
    unsubscribeFromConversation
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}
