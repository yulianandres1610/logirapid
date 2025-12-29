// Types for AI Support Agent System

export interface SupportMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  imageUrl?: string
  timestamp: Date
  isLoading?: boolean
}

export interface SupportConversation {
  id: number
  conversationId: string
  userId: number
  companyId: number
  messages: SupportMessage[]
  lastMessageAt: Date
  isResolved: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SupportTicket {
  id: number
  ticketCode: string
  userId: number
  companyId: number
  conversationId?: string
  subject: string
  description: string
  screenshots: string[]
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: number
  assignedAt?: Date
  resolution?: string
  resolvedBy?: number
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
  // Joined fields
  userName?: string
  userEmail?: string
  companyName?: string
  assignedToName?: string
}

export interface UserContext {
  userId: number
  role: string
  companyType: string
  companyId: number
  companyName: string
  currentPage: string
}

export interface SupportChatRequest {
  message: string
  imageUrl?: string
  conversationId?: string
  conversationHistory: SupportMessage[]
  userContext: UserContext
}

export interface SupportChatResponse {
  success: boolean
  data?: {
    response: string
    canResolve: boolean
    suggestedActions?: string[]
    escalate?: {
      reason: string
      priority: 'low' | 'medium' | 'high'
    }
  }
  conversationId?: string
  error?: string
}

export interface CreateTicketRequest {
  subject: string
  description: string
  conversationId?: string
  screenshots: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface CreateTicketResponse {
  success: boolean
  data?: {
    ticketId: number
    ticketCode: string
  }
  error?: string
}

export interface UploadImageResponse {
  success: boolean
  data?: {
    url: string
    path: string
  }
  error?: string
}

// Z.AI API Types
export interface ZAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ZAIMessageContent[]
}

export interface ZAIMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface ZAIRequest {
  model: string
  messages: ZAIMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  thinking?: {
    type: 'enabled' | 'disabled'
  }
}

export interface ZAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// AI Response parsed
export interface AIResponseParsed {
  response: string
  canResolve: boolean
  suggestedActions?: string[]
}
