import axios, { AxiosInstance, AxiosError } from 'axios'
import crypto from 'crypto'
import { getCredentials } from '../store/credentials'
import os from 'os'

interface PrinterInfo {
  printerName: string
  printerId?: string
  driverName?: string
  printerType?: 'thermal_80mm' | 'label_4x6' | 'label_barcode' | 'standard'
  connectionType?: 'usb' | 'network' | 'bluetooth'
  networkAddress?: string
  supportsEscpos?: boolean
  supportsRaw?: boolean
  paperWidthMm?: number
  dpi?: number
}

interface RegisterResponse {
  success: boolean
  data?: {
    serviceCode: string
    status: string
    configuration: {
      pollInterval: number
      heartbeatInterval: number
      jobEndpoint: string
      statusEndpoint: string
    }
    pendingJobs: number
  }
  error?: string
}

interface HeartbeatResponse {
  success: boolean
  data?: {
    nextPoll: number
    pendingJobs: number
    urgentJobs: number
  }
  error?: string
}

interface PrintJob {
  id: number
  jobNumber: string
  documentType:
    | 'pos_receipt'
    | 'shipping_label'
    | 'product_label'
    | 'invoice'
    | 'purchase_invoice'
    | 'sales_report'
    | 'inventory_count_report'
    | 'cash_register_report'
    | 'warehouse_operation'
    | 'consignment_receipt'
    | 'unified_reception'
  sourceType: string | null
  sourceId: number | null
  documentData: Record<string, unknown>
  copies: number
  priority: number
  printerId: number | null
  printerName: string | null
}

interface PendingJobsResponse {
  success: boolean
  data?: {
    jobs: PrintJob[]
  }
  error?: string
}

interface StatusUpdateResponse {
  success: boolean
  data?: {
    jobId: number
    jobNumber: string
    status: string
    willRetry: boolean
  }
  error?: string
}

class ApiClient {
  private client: AxiosInstance | null = null
  private credentials: ReturnType<typeof getCredentials> = null

  initialize(): boolean {
    this.credentials = getCredentials()
    if (!this.credentials) {
      return false
    }

    this.client = axios.create({
      baseURL: this.credentials.serverUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.credentials.apiKey}:${this.credentials.apiSecret}`
      }
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          console.error('[API Client] Authentication failed - check credentials')
        }
        return Promise.reject(error)
      }
    )

    return true
  }

  private getAppVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('../../package.json')
      return pkg.version || '1.0.0'
    } catch {
      return '1.0.0'
    }
  }

  async register(printers: PrinterInfo[]): Promise<RegisterResponse> {
    if (!this.client || !this.credentials) {
      return { success: false, error: 'Not initialized' }
    }

    try {
      const response = await this.client.post<RegisterResponse>(
        `/api/print/services/${this.credentials.serviceCode}/register`,
        {
          platform: process.platform,
          hostname: os.hostname(),
          version: this.getAppVersion(),
          printers
        }
      )

      return response.data
    } catch (error) {
      console.error('[API Client] Register failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  async heartbeat(printerStatuses?: { printerId: number; isOnline: boolean }[]): Promise<HeartbeatResponse> {
    if (!this.client || !this.credentials) {
      return { success: false, error: 'Not initialized' }
    }

    try {
      const response = await this.client.post<HeartbeatResponse>(
        `/api/print/services/${this.credentials.serviceCode}/heartbeat`,
        { printerStatuses }
      )

      return response.data
    } catch (error) {
      console.error('[API Client] Heartbeat failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Heartbeat failed'
      }
    }
  }

  async getPendingJobs(limit: number = 10): Promise<PendingJobsResponse> {
    if (!this.client || !this.credentials) {
      return { success: false, error: 'Not initialized' }
    }

    try {
      const response = await this.client.get<PendingJobsResponse>(
        `/api/print/jobs/pending`,
        {
          params: {
            serviceCode: this.credentials.serviceCode,
            limit
          }
        }
      )

      return response.data
    } catch (error) {
      console.error('[API Client] Get pending jobs failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending jobs'
      }
    }
  }

  async updateJobStatus(
    jobId: number,
    status: 'printing' | 'completed' | 'failed',
    errorMessage?: string,
    errorCode?: string
  ): Promise<StatusUpdateResponse> {
    if (!this.client || !this.credentials) {
      return { success: false, error: 'Not initialized' }
    }

    try {
      const response = await this.client.post<StatusUpdateResponse>(
        `/api/print/jobs/${jobId}/status`,
        {
          status,
          errorMessage,
          errorCode
        }
      )

      return response.data
    } catch (error) {
      console.error('[API Client] Update job status failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update job status'
      }
    }
  }

  async sendWebhook(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.client || !this.credentials) {
      return false
    }

    try {
      const payload = JSON.stringify({
        type: eventType,
        serviceCode: this.credentials.serviceCode,
        timestamp: new Date().toISOString(),
        data
      })

      // Create HMAC signature
      const hmac = crypto.createHmac('sha256', this.credentials.apiSecret)
      hmac.update(payload)
      const signature = hmac.digest('hex')

      await this.client.post('/api/webhooks/print', payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.credentials.apiKey,
          'X-Print-Signature': signature
        }
      })

      return true
    } catch (error) {
      console.error('[API Client] Webhook failed:', error)
      return false
    }
  }

  getServiceCode(): string | null {
    return this.credentials?.serviceCode || null
  }

  isInitialized(): boolean {
    return this.client !== null && this.credentials !== null
  }
}

export const apiClient = new ApiClient()
export type { PrinterInfo, PrintJob, RegisterResponse, HeartbeatResponse }
