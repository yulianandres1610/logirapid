import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { SYSTEM_KNOWLEDGE } from '@/lib/system-knowledge'
import type {
  SupportChatRequest,
  SupportMessage,
  ZAIMessage,
  ZAIResponse,
  AIResponseParsed
} from '@/types/support'

// Z.AI API Configuration - GLM-4.6V-Flash (Free vision model)
const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
const ZAI_API_KEY = '98c8e5eeb08d4f42963bcb4d963bbfd6.NbBtw1KWVhSdb5HC'
const ZAI_MODEL = 'glm-4.6v-flash'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

function buildSystemPrompt(userContext: SupportChatRequest['userContext']): string {
  return `Eres el asistente de soporte de LogiRapid, un sistema de gestion logistica.

CONOCIMIENTO DEL SISTEMA:
${SYSTEM_KNOWLEDGE}

CONTEXTO DEL USUARIO ACTUAL:
- Rol: ${userContext.role}
- Tipo de empresa: ${userContext.companyType}
- Empresa: ${userContext.companyName}
- Pagina actual: ${userContext.currentPage}

INSTRUCCIONES IMPORTANTES:
1. Responde SOLO sobre funcionalidades de LogiRapid
2. Se conciso pero completo en tus respuestas
3. Si el usuario incluye una imagen/captura, analizala para entender el contexto y problema
4. Si NO puedes resolver la duda o el problema requiere intervencion humana, indica claramente que necesitan soporte tecnico
5. Usa formato Markdown para mejor legibilidad
6. Sugiere acciones especificas paso a paso cuando sea posible
7. Si detectas un error en la captura, explicalo claramente
8. Manten un tono amigable y profesional

FORMATO DE RESPUESTA (JSON valido):
{
  "response": "Tu respuesta aqui en formato Markdown",
  "canResolve": true o false (si puedes resolver completamente la duda),
  "suggestedActions": ["accion 1", "accion 2"] (opcional, pasos sugeridos)
}

Responde UNICAMENTE con el JSON, sin texto adicional antes o despues.`
}

function parseAIResponse(content: string): AIResponseParsed {
  try {
    // Clean the response
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    }

    const parsed = JSON.parse(cleanContent)
    return {
      response: parsed.response || content,
      canResolve: parsed.canResolve !== false,
      suggestedActions: parsed.suggestedActions || []
    }
  } catch {
    // If parsing fails, return the raw content as response
    return {
      response: content,
      canResolve: true,
      suggestedActions: []
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const body: SupportChatRequest = await request.json()
    const { message, imageUrl, conversationId, conversationHistory, userContext } = body

    if (!message || message.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'El mensaje debe tener al menos 2 caracteres'
      }, { status: 400 })
    }

    console.log('[Support Chat] Processing message for user:', payload.userId)

    // Build messages for Z.AI API
    const systemPrompt = buildSystemPrompt(userContext)
    const messages: ZAIMessage[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history (last 10 messages for context)
    const recentHistory = conversationHistory.slice(-10)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    // Add current message with optional image
    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: message }
        ]
      })
    } else {
      messages.push({
        role: 'user',
        content: message
      })
    }

    // Call Z.AI API
    const response = await fetch(ZAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ZAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1500,
        stream: false
      })
    })

    if (!response.ok) {
      console.error('[Support Chat] Z.AI API Error:', response.status)
      return NextResponse.json({
        success: false,
        error: 'Error al procesar tu mensaje. Por favor intenta de nuevo.'
      }, { status: 500 })
    }

    const data: ZAIResponse = await response.json()
    console.log('[Support Chat] Z.AI response received')

    if (!data.choices || data.choices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se recibio respuesta del asistente'
      }, { status: 500 })
    }

    const aiContent = data.choices[0].message.content
    const parsed = parseAIResponse(aiContent)

    // Save/update conversation in database
    let finalConversationId = conversationId

    // Build messages to save
    const userMessage: SupportMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      imageUrl,
      timestamp: new Date()
    }

    const assistantMessage: SupportMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: parsed.response,
      timestamp: new Date()
    }

    if (conversationId) {
      // Update existing conversation
      await db.query(`
        UPDATE support_conversations
        SET messages = messages || $1::jsonb,
            last_message_at = NOW(),
            is_resolved = $2
        WHERE conversation_id = $3
      `, [
        JSON.stringify([userMessage, assistantMessage]),
        parsed.canResolve,
        conversationId
      ])
    } else {
      // Create new conversation
      const result = await db.query(`
        INSERT INTO support_conversations (user_id, company_id, messages, last_message_at, is_resolved)
        VALUES ($1, $2, $3::jsonb, NOW(), $4)
        RETURNING conversation_id
      `, [
        payload.userId,
        payload.companyId,
        JSON.stringify([userMessage, assistantMessage]),
        parsed.canResolve
      ])
      finalConversationId = result.rows[0].conversation_id
    }

    // Prepare escalation info if needed
    let escalate = undefined
    if (!parsed.canResolve) {
      escalate = {
        reason: 'El asistente no pudo resolver completamente tu consulta',
        priority: 'medium' as const
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        response: parsed.response,
        canResolve: parsed.canResolve,
        suggestedActions: parsed.suggestedActions
      },
      conversationId: finalConversationId,
      escalate
    })

  } catch (error) {
    console.error('[Support Chat] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
