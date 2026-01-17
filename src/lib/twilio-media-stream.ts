import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { OpenAIRealtimeClient } from './openai-realtime-client'
import { db } from './database'

/**
 * Audio conversion utilities
 * Twilio uses mulaw 8kHz, OpenAI uses PCM16 24kHz
 */

// mulaw to linear PCM lookup table
const MULAW_DECODE_TABLE = new Int16Array(256)

// Initialize mulaw decode table
;(function initMulawTable() {
  const MULAW_BIAS = 33
  const MULAW_CLIP = 32635

  for (let i = 0; i < 256; i++) {
    let mulaw = ~i & 0xFF
    const sign = mulaw & 0x80
    const exponent = (mulaw >> 4) & 0x07
    const mantissa = mulaw & 0x0F
    let sample = (mantissa << 4) + 8
    sample <<= exponent
    sample -= MULAW_BIAS

    MULAW_DECODE_TABLE[i] = sign ? -sample : sample
  }
})()

// Linear PCM to mulaw
function linearToMulaw(sample: number): number {
  const MULAW_BIAS = 33
  const MULAW_CLIP = 32635
  const MULAW_MAX = 0x7F

  // Clip to valid range
  if (sample > MULAW_CLIP) sample = MULAW_CLIP
  if (sample < -MULAW_CLIP) sample = -MULAW_CLIP

  const sign = (sample < 0) ? 0x80 : 0
  if (sample < 0) sample = -sample
  sample += MULAW_BIAS

  let exponent = 7
  let mask = 0x4000
  while (exponent > 0 && !(sample & mask)) {
    exponent--
    mask >>= 1
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0F
  const mulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF

  return mulaw
}

// Convert mulaw buffer to PCM16
function mulawToPcm16(mulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(mulawData.length * 2)
  for (let i = 0; i < mulawData.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawData[i]]
    pcmData.writeInt16LE(sample, i * 2)
  }
  return pcmData
}

// Convert PCM16 buffer to mulaw
function pcm16ToMulaw(pcmData: Buffer): Buffer {
  const mulawData = Buffer.alloc(pcmData.length / 2)
  for (let i = 0; i < pcmData.length / 2; i++) {
    const sample = pcmData.readInt16LE(i * 2)
    mulawData[i] = linearToMulaw(sample)
  }
  return mulawData
}

// Resample from 8kHz to 24kHz (simple linear interpolation)
function upsample8kTo24k(pcm8k: Buffer): Buffer {
  const factor = 3 // 24000 / 8000
  const samples8k = pcm8k.length / 2
  const pcm24k = Buffer.alloc(samples8k * factor * 2)

  for (let i = 0; i < samples8k - 1; i++) {
    const sample1 = pcm8k.readInt16LE(i * 2)
    const sample2 = pcm8k.readInt16LE((i + 1) * 2)

    for (let j = 0; j < factor; j++) {
      const t = j / factor
      const interpolated = Math.round(sample1 + (sample2 - sample1) * t)
      pcm24k.writeInt16LE(interpolated, (i * factor + j) * 2)
    }
  }

  // Handle last sample
  const lastSample = pcm8k.readInt16LE((samples8k - 1) * 2)
  for (let j = 0; j < factor; j++) {
    pcm24k.writeInt16LE(lastSample, ((samples8k - 1) * factor + j) * 2)
  }

  return pcm24k
}

// Resample from 24kHz to 8kHz (decimation)
function downsample24kTo8k(pcm24k: Buffer): Buffer {
  const factor = 3 // 24000 / 8000
  const samples24k = pcm24k.length / 2
  const samples8k = Math.floor(samples24k / factor)
  const pcm8k = Buffer.alloc(samples8k * 2)

  for (let i = 0; i < samples8k; i++) {
    // Average the samples for better quality
    let sum = 0
    for (let j = 0; j < factor; j++) {
      sum += pcm24k.readInt16LE((i * factor + j) * 2)
    }
    pcm8k.writeInt16LE(Math.round(sum / factor), i * 2)
  }

  return pcm8k
}

/**
 * Media Stream Handler
 * Bridges Twilio media stream with OpenAI Realtime API
 */
export interface TwilioStreamMessage {
  event: string
  sequenceNumber?: string
  streamSid?: string
  media?: {
    track: string
    chunk: string
    timestamp: string
    payload: string // base64 mulaw audio
  }
  start?: {
    streamSid: string
    accountSid: string
    callSid: string
    tracks: string[]
    customParameters?: Record<string, string>
  }
  stop?: {
    accountSid: string
    callSid: string
  }
  mark?: {
    name: string
  }
}

export interface MediaStreamConfig {
  callSid: string
  from: string
  customerId?: string
  customerName?: string
  companyId: string
}

export class TwilioMediaStreamHandler extends EventEmitter {
  private twilioWs: WebSocket
  private openaiClient: OpenAIRealtimeClient | null = null
  private streamSid: string | null = null
  private config: MediaStreamConfig | null = null
  private audioBuffer: Buffer[] = []
  private markCounter = 0
  private isProcessing = false

  constructor(twilioWebSocket: WebSocket) {
    super()
    this.twilioWs = twilioWebSocket
    this.setupTwilioHandlers()
  }

  private setupTwilioHandlers(): void {
    this.twilioWs.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as TwilioStreamMessage
        await this.handleTwilioMessage(message)
      } catch (error) {
        console.error('[TwilioMediaStream] Error handling message:', error)
      }
    })

    this.twilioWs.on('close', () => {
      console.log('[TwilioMediaStream] Twilio connection closed')
      this.cleanup()
    })

    this.twilioWs.on('error', (error) => {
      console.error('[TwilioMediaStream] Twilio WebSocket error:', error)
      this.cleanup()
    })
  }

  private async handleTwilioMessage(message: TwilioStreamMessage): Promise<void> {
    switch (message.event) {
      case 'connected':
        console.log('[TwilioMediaStream] Twilio connected')
        break

      case 'start':
        this.streamSid = message.start?.streamSid || null
        const customParams = message.start?.customParameters || {}

        this.config = {
          callSid: customParams.callSid || message.start?.callSid || '',
          from: customParams.from || '',
          customerId: customParams.customerId,
          customerName: customParams.customerName,
          companyId: customParams.companyId || '1'
        }

        console.log('[TwilioMediaStream] Stream started:', {
          streamSid: this.streamSid,
          callSid: this.config.callSid,
          from: this.config.from
        })

        // Initialize OpenAI connection
        await this.initializeOpenAI()
        break

      case 'media':
        if (message.media && this.openaiClient?.connected) {
          // Convert mulaw 8kHz to PCM16 24kHz and send to OpenAI
          const mulawBuffer = Buffer.from(message.media.payload, 'base64')
          const pcm8k = mulawToPcm16(mulawBuffer)
          const pcm24k = upsample8kTo24k(pcm8k)
          const pcm24kBase64 = pcm24k.toString('base64')

          this.openaiClient.sendAudio(pcm24kBase64)
        }
        break

      case 'stop':
        console.log('[TwilioMediaStream] Stream stopped')
        await this.cleanup()
        break

      case 'mark':
        // Mark received - audio playback completed
        this.emit('mark', message.mark?.name)
        break
    }
  }

  private async initializeOpenAI(): Promise<void> {
    try {
      this.openaiClient = new OpenAIRealtimeClient()

      // Handle OpenAI events
      this.openaiClient.on('session_created', () => {
        console.log('[TwilioMediaStream] OpenAI session created')
        this.emit('ready')
      })

      this.openaiClient.on('audio', (data: { audio: string; itemId: string }) => {
        // Convert PCM16 24kHz to mulaw 8kHz and send to Twilio
        const pcm24k = Buffer.from(data.audio, 'base64')
        const pcm8k = downsample24kTo8k(pcm24k)
        const mulaw = pcm16ToMulaw(pcm8k)
        const mulawBase64 = mulaw.toString('base64')

        this.sendAudioToTwilio(mulawBase64)
      })

      this.openaiClient.on('audio_done', () => {
        // Send mark to know when audio finished playing
        this.sendMarkToTwilio(`response_${this.markCounter++}`)
      })

      this.openaiClient.on('transcript', async (data: { role: string; text: string }) => {
        console.log(`[TwilioMediaStream] Transcript (${data.role}):`, data.text)

        // Save transcript to database
        if (this.config?.callSid) {
          await this.saveTranscript(data.role, data.text)
        }

        this.emit('transcript', data)
      })

      this.openaiClient.on('tool_call', async (data: { callId: string; name: string; arguments: string }) => {
        console.log('[TwilioMediaStream] Tool call:', data.name)

        try {
          const args = JSON.parse(data.arguments)
          const result = await this.executeToolCall(data.name, args)
          this.openaiClient?.sendToolResult(data.callId, result)
        } catch (error) {
          console.error('[TwilioMediaStream] Tool execution error:', error)
          this.openaiClient?.sendToolResult(data.callId, {
            error: 'Error al ejecutar la accion. Por favor intente de nuevo.'
          })
        }
      })

      this.openaiClient.on('error', (error) => {
        console.error('[TwilioMediaStream] OpenAI error:', error)
        this.emit('error', error)
      })

      this.openaiClient.on('disconnected', () => {
        console.log('[TwilioMediaStream] OpenAI disconnected')
      })

      // Connect to OpenAI
      await this.openaiClient.connect()

    } catch (error) {
      console.error('[TwilioMediaStream] Failed to initialize OpenAI:', error)
      this.emit('error', error)
    }
  }

  private sendAudioToTwilio(audioBase64: string): void {
    if (this.twilioWs.readyState !== WebSocket.OPEN || !this.streamSid) {
      return
    }

    const message = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audioBase64
      }
    }

    this.twilioWs.send(JSON.stringify(message))
  }

  private sendMarkToTwilio(name: string): void {
    if (this.twilioWs.readyState !== WebSocket.OPEN || !this.streamSid) {
      return
    }

    const message = {
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name }
    }

    this.twilioWs.send(JSON.stringify(message))
  }

  private async saveTranscript(role: string, text: string): Promise<void> {
    if (!this.config?.callSid) return

    try {
      // Save event to voice_call_events
      await db.query(`
        INSERT INTO voice_call_events (callid, eventtype, eventdata)
        SELECT id, $2, $3
        FROM voice_calls
        WHERE callsid = $1
      `, [
        this.config.callSid,
        'transcript',
        JSON.stringify({ role, text, timestamp: new Date().toISOString() })
      ])

      // Append to transcript in voice_calls
      await db.query(`
        UPDATE voice_calls
        SET transcript = COALESCE(transcript, '') || $2
        WHERE callsid = $1
      `, [
        this.config.callSid,
        `\n[${role.toUpperCase()}]: ${text}`
      ])
    } catch (error) {
      console.error('[TwilioMediaStream] Error saving transcript:', error)
    }
  }

  private async executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    console.log(`[TwilioMediaStream] Executing tool: ${name}`, args)

    // Import the necessary modules dynamically to avoid circular dependencies
    switch (name) {
      case 'search_customer': {
        const phone = (args.phone as string).replace(/\D/g, '').slice(-10)
        const result = await db.query(`
          SELECT id, firstname, lastname, phone, email
          FROM customers
          WHERE phone LIKE $1
          LIMIT 1
        `, [`%${phone}%`])

        if (result.rows[0]) {
          return {
            found: true,
            customer: {
              name: `${result.rows[0].firstname} ${result.rows[0].lastname}`.trim(),
              phone: result.rows[0].phone,
              email: result.rows[0].email
            }
          }
        }
        return { found: false, message: 'Cliente no encontrado' }
      }

      case 'search_recipient': {
        const phone = (args.phone as string).replace(/\D/g, '').slice(-8)
        const result = await db.query(`
          SELECT id, firstname, lastname, phone, province, municipality, address
          FROM customers
          WHERE phone LIKE $1 AND is_recipient = true
          LIMIT 1
        `, [`%${phone}%`])

        if (result.rows[0]) {
          return {
            found: true,
            recipient: {
              name: `${result.rows[0].firstname} ${result.rows[0].lastname}`.trim(),
              phone: result.rows[0].phone,
              province: result.rows[0].province,
              municipality: result.rows[0].municipality,
              address: result.rows[0].address
            }
          }
        }
        return { found: false, message: 'Destinatario no encontrado' }
      }

      case 'get_available_dates': {
        const dates = this.getAvailableDatesForVoice()
        return { dates }
      }

      case 'validate_cuba_address': {
        const { validateCubaAddress, findClosestMatch, CUBA_PROVINCES, CUBA_MUNICIPALITIES } = await import('./cuba-locations')
        const province = args.province as string
        const municipality = args.municipality as string

        const validationResult = validateCubaAddress(province, municipality)

        if (!validationResult.valid) {
          return {
            valid: false,
            error: validationResult.error || `Direccion no valida`,
            provinceSuggestion: validationResult.provinceSuggestion,
            municipalitySuggestion: validationResult.municipalitySuggestion
          }
        }

        return {
          valid: true,
          province: validationResult.province,
          municipality: validationResult.municipality
        }
      }

      case 'create_pickup_order': {
        // This would need the full order creation logic
        // For now, return a placeholder
        return {
          success: true,
          orderNumber: `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          message: 'Orden creada exitosamente. Recibira un SMS con el enlace de pago.'
        }
      }

      case 'check_order_status': {
        const orderNumber = args.orderNumber as string
        const result = await db.query(`
          SELECT ordernumber, status, scheduleddate, recipientname
          FROM package_orders
          WHERE ordernumber = $1
          LIMIT 1
        `, [orderNumber])

        if (result.rows[0]) {
          const order = result.rows[0]
          const statusMap: Record<string, string> = {
            'pending': 'Pendiente de recogida',
            'in_transit': 'En transito',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado'
          }
          return {
            found: true,
            order: {
              number: order.ordernumber,
              status: statusMap[order.status] || order.status,
              scheduledDate: order.scheduleddate,
              recipient: order.recipientname
            }
          }
        }
        return { found: false, message: 'Orden no encontrada' }
      }

      default:
        return { error: `Herramienta desconocida: ${name}` }
    }
  }

  private getAvailableDatesForVoice(): Array<{ date: string; dayName: string; slots: string[] }> {
    const ALL_TIME_SLOTS = [
      '8:00 AM - 12:00 PM',
      '12:00 PM - 4:00 PM',
      '4:00 PM - 8:00 PM'
    ]

    const miamiTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    const now = new Date(miamiTime)
    const currentHour = now.getHours()
    const result: Array<{ date: string; dayName: string; slots: string[] }> = []

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

    const formatDateStr = (d: Date): string => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
      const parts = new Intl.DateTimeFormat('en-CA', options).format(d).split('-')
      return `${parts[0]}-${parts[1]}-${parts[2]}`
    }

    // Calculate slots for today
    let todaySlots: string[] = []
    if (currentHour < 8) {
      todaySlots = [...ALL_TIME_SLOTS]
    } else if (currentHour < 12) {
      todaySlots = ALL_TIME_SLOTS.slice(1)
    } else if (currentHour < 16) {
      todaySlots = ALL_TIME_SLOTS.slice(2)
    }

    if (todaySlots.length > 0) {
      result.push({
        date: formatDateStr(now),
        dayName: 'Hoy',
        slots: todaySlots
      })
    }

    // Add next 6 days
    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date(now)
      futureDate.setDate(futureDate.getDate() + i)

      result.push({
        date: formatDateStr(futureDate),
        dayName: i === 1 ? 'Manana' : dayNames[futureDate.getDay()],
        slots: [...ALL_TIME_SLOTS]
      })
    }

    return result
  }

  private async cleanup(): Promise<void> {
    if (this.openaiClient) {
      this.openaiClient.disconnect()
      this.openaiClient = null
    }

    // Update call status
    if (this.config?.callSid) {
      try {
        await db.query(`
          UPDATE voice_calls
          SET status = 'completed', endedat = NOW()
          WHERE callsid = $1 AND status != 'completed'
        `, [this.config.callSid])
      } catch (error) {
        console.error('[TwilioMediaStream] Error updating call status:', error)
      }
    }

    this.emit('ended')
  }

  /**
   * Interrupt the current response (e.g., when user starts speaking)
   */
  interrupt(): void {
    this.openaiClient?.cancelResponse()
  }
}

export default TwilioMediaStreamHandler
