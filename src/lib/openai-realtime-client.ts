import WebSocket from 'ws'
import { EventEmitter } from 'events'

// OpenAI Realtime API types
export interface RealtimeSession {
  id: string
  model: string
  voice: string
  modalities: string[]
  instructions: string
  input_audio_format: string
  output_audio_format: string
  turn_detection: {
    type: string
    threshold?: number
    prefix_padding_ms?: number
    silence_duration_ms?: number
  }
  tools: RealtimeTool[]
}

export interface RealtimeTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface RealtimeEvent {
  type: string
  event_id?: string
  [key: string]: unknown
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void

// System prompt for voice agent
const VOICE_SYSTEM_PROMPT = `Eres el asistente telefonico de LogiRapid LLC, una empresa de logistica y envios a Cuba.

INSTRUCCIONES DE VOZ:
- Habla de forma natural y conversacional en espanol
- Usa frases cortas y claras
- Confirma datos importantes deletreando numeros y direcciones
- Si no entiendes algo, pide que lo repitan amablemente
- Manten un tono profesional pero amigable y calido

CAPACIDADES:
- Crear ordenes de recogida de paquetes (pickup orders)
- Consultar estado de envios existentes
- Proporcionar informacion de servicios y tarifas
- Responder dudas generales sobre envios a Cuba

FLUJO PARA CREAR ORDEN:
1. Saludar e identificar si el cliente ya tiene cuenta o es nuevo
2. Recopilar datos del remitente (nombre completo, direccion en USA)
3. Recopilar datos del destinatario en Cuba (nombre, telefono 8 digitos, carnet de identidad 11 digitos, provincia, municipio, direccion)
4. Confirmar fecha y horario de recogida
5. Leer resumen completo de la orden para confirmacion
6. Informar que recibira un SMS con el enlace de pago

REGLAS IMPORTANTES:
- El telefono de Cuba debe tener exactamente 8 digitos
- El carnet de identidad cubano debe tener exactamente 11 digitos
- Siempre confirma los datos criticos antes de crear la orden
- Si el cliente quiere cancelar, respeta su decision amablemente
- No inventes informacion, si no sabes algo, indica que lo verificaras

EJEMPLO DE SALUDO:
"Hola, gracias por llamar a LogiRapid. Mi nombre es Sofia, tu asistente virtual. ¿En que puedo ayudarte hoy?"`;

// Available tools for the voice agent
const VOICE_TOOLS: RealtimeTool[] = [
  {
    type: 'function',
    name: 'search_customer',
    description: 'Buscar un cliente existente por numero de telefono',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Numero de telefono del cliente (con o sin codigo de pais)'
        }
      },
      required: ['phone']
    }
  },
  {
    type: 'function',
    name: 'search_recipient',
    description: 'Buscar un destinatario existente en Cuba por telefono',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Telefono del destinatario (8 digitos)'
        }
      },
      required: ['phone']
    }
  },
  {
    type: 'function',
    name: 'get_available_dates',
    description: 'Obtener fechas y horarios disponibles para recogida',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'validate_cuba_address',
    description: 'Validar una direccion en Cuba (provincia y municipio)',
    parameters: {
      type: 'object',
      properties: {
        province: {
          type: 'string',
          description: 'Nombre de la provincia'
        },
        municipality: {
          type: 'string',
          description: 'Nombre del municipio'
        }
      },
      required: ['province', 'municipality']
    }
  },
  {
    type: 'function',
    name: 'create_pickup_order',
    description: 'Crear una orden de recogida con todos los datos recopilados',
    parameters: {
      type: 'object',
      properties: {
        senderName: { type: 'string', description: 'Nombre completo del remitente' },
        senderPhone: { type: 'string', description: 'Telefono del remitente' },
        senderAddress: { type: 'string', description: 'Direccion completa del remitente en USA' },
        senderCity: { type: 'string', description: 'Ciudad del remitente' },
        senderState: { type: 'string', description: 'Estado del remitente (ej: FL, TX)' },
        senderZipcode: { type: 'string', description: 'Codigo postal del remitente' },
        recipientName: { type: 'string', description: 'Nombre completo del destinatario' },
        recipientPhone: { type: 'string', description: 'Telefono del destinatario (8 digitos)' },
        recipientCI: { type: 'string', description: 'Carnet de identidad (11 digitos)' },
        recipientProvince: { type: 'string', description: 'Provincia del destinatario' },
        recipientMunicipality: { type: 'string', description: 'Municipio del destinatario' },
        recipientAddress: { type: 'string', description: 'Direccion del destinatario en Cuba' },
        pickupDate: { type: 'string', description: 'Fecha de recogida (YYYY-MM-DD)' },
        pickupTimeSlot: { type: 'string', description: 'Horario de recogida (ej: 8:00 AM - 12:00 PM)' }
      },
      required: [
        'senderName', 'senderPhone', 'senderAddress', 'senderCity', 'senderState', 'senderZipcode',
        'recipientName', 'recipientPhone', 'recipientProvince', 'recipientMunicipality', 'recipientAddress',
        'pickupDate', 'pickupTimeSlot'
      ]
    }
  },
  {
    type: 'function',
    name: 'check_order_status',
    description: 'Consultar el estado de una orden existente',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: {
          type: 'string',
          description: 'Numero de orden (ej: ORD-2025-0001)'
        }
      },
      required: ['orderNumber']
    }
  }
]

/**
 * Cliente para OpenAI Realtime API
 * Maneja la conexion WebSocket y eventos de audio/texto
 */
export class OpenAIRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private apiKey: string

  constructor(apiKey?: string) {
    super()
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required')
    }
  }

  /**
   * Conectar al API de OpenAI Realtime
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve()
        return
      }

      // Modelo GA de realtime (soporta WebRTC, WebSocket y SIP)
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17'
      // Nota: Para usar gpt-realtime-2025-08-28 se requiere integracion SIP con Twilio
      // ya que Vercel no soporta WebSockets persistentes en funciones serverless

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      this.ws.on('open', () => {
        console.log('[OpenAI Realtime] Connected to API')
        this.isConnected = true
        this.reconnectAttempts = 0

        // Configure session with natural voice settings
        this.sendEvent({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: 'coral', // coral es mas calida y natural para espanol
            instructions: VOICE_SYSTEM_PROMPT,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.6, // Mas alto para evitar interrupciones accidentales
              prefix_padding_ms: 400, // Mas tiempo antes de hablar
              silence_duration_ms: 800 // Mas tiempo de silencio antes de responder
            },
            tools: VOICE_TOOLS,
            tool_choice: 'auto',
            temperature: 0.8, // Un poco mas creativo para conversacion natural
            max_response_output_tokens: 300 // Respuestas concisas
          }
        })

        resolve()
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as RealtimeEvent
          this.handleEvent(event)
        } catch (error) {
          console.error('[OpenAI Realtime] Error parsing message:', error)
        }
      })

      this.ws.on('error', (error) => {
        console.error('[OpenAI Realtime] WebSocket error:', error)
        this.emit('error', error)
        reject(error)
      })

      this.ws.on('close', (code, reason) => {
        console.log('[OpenAI Realtime] Connection closed:', code, reason.toString())
        this.isConnected = false
        this.sessionId = null
        this.emit('disconnected', { code, reason: reason.toString() })

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`[OpenAI Realtime] Reconnecting... (attempt ${this.reconnectAttempts})`)
          setTimeout(() => this.connect(), 1000 * this.reconnectAttempts)
        }
      })
    })
  }

  /**
   * Desconectar del API
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.sessionId = null
  }

  /**
   * Enviar evento al API
   */
  sendEvent(event: RealtimeEvent): void {
    if (!this.ws || !this.isConnected) {
      console.error('[OpenAI Realtime] Cannot send event: not connected')
      return
    }

    const eventWithId = {
      ...event,
      event_id: event.event_id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    this.ws.send(JSON.stringify(eventWithId))
  }

  /**
   * Enviar audio al API (PCM16 en base64)
   */
  sendAudio(audioBase64: string): void {
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    })
  }

  /**
   * Indicar que el audio de entrada termino
   */
  commitAudio(): void {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    })
  }

  /**
   * Limpiar el buffer de audio de entrada
   */
  clearAudioBuffer(): void {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    })
  }

  /**
   * Cancelar la respuesta actual
   */
  cancelResponse(): void {
    this.sendEvent({
      type: 'response.cancel'
    })
  }

  /**
   * Enviar resultado de una herramienta
   */
  sendToolResult(callId: string, result: unknown): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result)
      }
    })

    // Request response after tool result
    this.sendEvent({
      type: 'response.create'
    })
  }

  /**
   * Manejar eventos del API
   */
  private handleEvent(event: RealtimeEvent): void {
    // console.log('[OpenAI Realtime] Event:', event.type)

    switch (event.type) {
      case 'session.created':
        this.sessionId = (event.session as { id: string })?.id
        console.log('[OpenAI Realtime] Session created:', this.sessionId)
        this.emit('session_created', event)
        break

      case 'session.updated':
        console.log('[OpenAI Realtime] Session updated')
        this.emit('session_updated', event)
        break

      case 'error':
        console.error('[OpenAI Realtime] API error:', event)
        this.emit('api_error', event)
        break

      case 'input_audio_buffer.speech_started':
        this.emit('speech_started', event)
        break

      case 'input_audio_buffer.speech_stopped':
        this.emit('speech_stopped', event)
        break

      case 'input_audio_buffer.committed':
        this.emit('audio_committed', event)
        break

      case 'conversation.item.input_audio_transcription.completed':
        this.emit('transcript', {
          role: 'user',
          text: (event as { transcript?: string }).transcript
        })
        break

      case 'response.audio_transcript.delta':
        this.emit('transcript_delta', {
          role: 'assistant',
          delta: (event as { delta?: string }).delta
        })
        break

      case 'response.audio_transcript.done':
        this.emit('transcript', {
          role: 'assistant',
          text: (event as { transcript?: string }).transcript
        })
        break

      case 'response.audio.delta':
        // Audio chunk from the assistant
        this.emit('audio', {
          audio: (event as { delta?: string }).delta,
          itemId: (event as { item_id?: string }).item_id
        })
        break

      case 'response.audio.done':
        this.emit('audio_done', event)
        break

      case 'response.function_call_arguments.done':
        // Tool call completed - need to execute
        this.emit('tool_call', {
          callId: (event as { call_id?: string }).call_id,
          name: (event as { name?: string }).name,
          arguments: (event as { arguments?: string }).arguments
        })
        break

      case 'response.done':
        this.emit('response_done', event)
        break

      case 'rate_limits.updated':
        // Rate limit info
        break

      default:
        // Forward unknown events
        this.emit(event.type, event)
    }
  }

  /**
   * Verificar si esta conectado
   */
  get connected(): boolean {
    return this.isConnected
  }

  /**
   * Obtener el ID de sesion actual
   */
  get session(): string | null {
    return this.sessionId
  }
}

export default OpenAIRealtimeClient
