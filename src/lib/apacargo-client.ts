/**
 * ApaCargo API Client
 * Cliente para integración con la API de ApaCargo (transitaria para envíos a Cuba)
 *
 * API Base URL: https://dev-apacargo-api.azurewebsites.net
 * Versión: v1
 */

// Configuración desde variables de entorno
const APACARGO_API_URL = process.env.APACARGO_API_URL || 'https://dev-apacargo-api.azurewebsites.net'
const APACARGO_USERNAME = process.env.APACARGO_USERNAME || ''
const APACARGO_PASSWORD = process.env.APACARGO_PASSWORD || ''
const APACARGO_AGENCY_ID = parseInt(process.env.APACARGO_AGENCY_ID || '0')

// Cache del token en memoria
let cachedToken: {
  accessToken: string
  tokenType: string
  userId: number
  expiresAt: number
} | null = null

// Interfaces para la API de ApaCargo

export interface ApaCargoAuthResponse {
  access_token: string
  token_type: string
  userId: number
}

export interface ApaCargoSenderAddress {
  addressLine1: string
  addressLine2?: string
  city: string
  stateId: number
  zipCode: string
}

export interface ApaCargoSender {
  clientId?: number
  firstName: string
  middleName?: string
  lastName: string
  email?: string
  cellPhone: string
  homePhone?: string
  passport?: string
  identification: string
  documentNumber?: string
  documentCountry?: string
  documentExpirationDate?: string
  identityDocumentTypeId?: number
  address: ApaCargoSenderAddress
}

export interface ApaCargoReceiver {
  clientId?: number
  firstName: string
  middleName?: string
  lastName: string
  email?: string
  cellPhone: string
  homePhone?: string
  passport?: string
  identification: string
  street: string
  streetNo: string
  apt?: string
  floor?: string
  streetBetween1?: string
  streetBetween2?: string
  city: string
  municipalityId: number
}

export interface ApaCargoProduct {
  orderProductId?: number
  shippingProductId: number
  weight: number          // kg
  declaredValueUsd?: number
  length: number          // cm
  width?: number          // cm
  height?: number         // cm
  count?: number
  description?: string
}

// Formato legacy (anidado) - mantener por compatibilidad
export interface ApaCargoOrderRequest {
  orderId?: number
  serviceId?: number
  agencyId: number
  orderTypeId?: number
  senderTravelDate?: string
  priority: boolean
  handlingFee?: number
  comment?: string
  addressId?: number
  invoiceSigned?: boolean
  sender: ApaCargoSender
  receiver: ApaCargoReceiver
  products: ApaCargoProduct[]
}

// Formato Integration API (flat) - según documentación oficial
export interface ApaCargoIntegrationProduct {
  labelCode: string
  weight: number
  declaredValueUsd?: number
  length: number
  width?: number
  height?: number
  count?: number
  description?: string
  shippingProduct?: number
}

export interface ApaCargoIntegrationRequest {
  orderId?: number
  agencyId: number
  serviceId: number
  senderTravelDate?: string
  comment?: string
  // Sender fields (flat)
  senderFirstName: string
  senderMiddleName?: string
  senderLastName: string
  senderEmail?: string
  senderCellPhone: string
  senderHomePhone?: string
  senderIdentification: string
  senderDocumentNumber?: string
  senderDocumentCountry?: string
  senderDocumentExpirationDate?: string
  senderIdentityDocumentTypeId?: number
  senderAddressLine1?: string
  senderAddressLine2?: string
  senderCity?: string
  senderZipCode?: string
  senderStateId?: number
  // Receiver fields (flat)
  receiverFirstName: string
  receiverMiddleName?: string
  receiverLastName: string
  receiverEmail?: string
  receiverCellPhone: string
  receiverHomePhone?: string
  receiverIdentification: string
  receiverStreet: string
  receiverStreetNo: string
  receiverApt?: string
  receiverFloor?: string
  receiverStreetBetween1?: string
  receiverStreetBetween2?: string
  receiverCity: string
  receiverMunicipalityId: number
  // Products
  products: ApaCargoIntegrationProduct[]
}

export interface ApaCargoOrderResponse {
  id: number
  code: string
  agencyId: number
  status: string
  sender: ApaCargoSender
  receiver: ApaCargoReceiver
  products: ApaCargoProduct[]
  createdAt: string
  updatedAt: string
}

export interface ApaCargoCubaMunicipality {
  id: number
  name: string
  stateId: number
  stateName?: string
}

export interface ApaCargoCubaState {
  id: number
  name: string
}

export interface ApaCargoUSAState {
  id: number
  name: string
  abbreviation: string
}

/**
 * Clase cliente para la API de ApaCargo
 */
class ApaCargoClient {
  private baseUrl: string
  private version: string = 'v1'

  constructor() {
    this.baseUrl = APACARGO_API_URL
  }

  /**
   * Construye la URL completa para un endpoint
   */
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}/api/${this.version}${endpoint}`
  }

  /**
   * Obtiene el token de autenticación (desde cache o nuevo)
   */
  private async getToken(): Promise<string> {
    // Verificar si hay token en cache y no ha expirado
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.accessToken
    }

    // Autenticar y obtener nuevo token
    await this.authenticate()

    if (!cachedToken) {
      throw new Error('No se pudo obtener token de autenticación de ApaCargo')
    }

    return cachedToken.accessToken
  }

  /**
   * Realiza la autenticación inicial con ApaCargo
   */
  async authenticate(): Promise<ApaCargoAuthResponse> {
    if (!APACARGO_USERNAME || !APACARGO_PASSWORD) {
      throw new Error('Credenciales de ApaCargo no configuradas. Configure APACARGO_USERNAME y APACARGO_PASSWORD')
    }

    console.log('[ApaCargo] Autenticando con usuario:', APACARGO_USERNAME)

    const response = await fetch(this.buildUrl('/accounts/authenticate/first'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: APACARGO_USERNAME,
        password: APACARGO_PASSWORD,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ApaCargo] Error de autenticación:', response.status, errorText)
      throw new Error(`Error de autenticación ApaCargo: ${response.status} - ${errorText}`)
    }

    const data: ApaCargoAuthResponse = await response.json()

    // Guardar token en cache (expira en 1 hora por defecto)
    cachedToken = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      userId: data.userId,
      expiresAt: Date.now() + (55 * 60 * 1000), // 55 minutos
    }

    console.log('[ApaCargo] Autenticación exitosa, userId:', data.userId)
    return data
  }

  /**
   * Completa la autenticación 2FA si es requerida
   */
  async authenticateSecondFactor(code: string, userId: number): Promise<ApaCargoAuthResponse> {
    const response = await fetch(this.buildUrl('/accounts/authenticate/second'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        userId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Error de autenticación 2FA: ${response.status} - ${errorText}`)
    }

    const data: ApaCargoAuthResponse = await response.json()

    // Actualizar token en cache
    cachedToken = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      userId: data.userId,
      expiresAt: Date.now() + (55 * 60 * 1000),
    }

    return data
  }

  /**
   * Realiza una petición autenticada a la API
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken()

    const response = await fetch(this.buildUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ApaCargo] Error en petición:', endpoint, response.status, errorText)

      // Si es error 401, limpiar cache e intentar de nuevo
      if (response.status === 401) {
        cachedToken = null
        throw new Error('Token expirado. Por favor intente de nuevo.')
      }

      throw new Error(`Error ApaCargo ${endpoint}: ${response.status} - ${errorText}`)
    }

    // Algunos endpoints retornan binario (PDFs)
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/pdf') || contentType?.includes('application/octet-stream')) {
      return response.blob() as unknown as T
    }

    return response.json()
  }

  /**
   * Crea una nueva orden en ApaCargo usando el endpoint de Integration API
   * Este es el endpoint oficial para integraciones externas
   */
  async createIntegrationOrder(orderData: ApaCargoIntegrationRequest): Promise<ApaCargoOrderResponse> {
    console.log('[ApaCargo] Creando orden via Integration API:', JSON.stringify(orderData, null, 2))

    // Asegurar que el agencyId esté configurado
    if (!orderData.agencyId && APACARGO_AGENCY_ID) {
      orderData.agencyId = APACARGO_AGENCY_ID
    }

    const result = await this.authenticatedRequest<ApaCargoOrderResponse>('/integration', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })

    console.log('[ApaCargo] Orden creada via Integration:', result.code)
    return result
  }

  /**
   * Crea una nueva orden en ApaCargo (endpoint legacy /orders)
   * @deprecated Usar createIntegrationOrder para nuevas integraciones
   */
  async createOrder(orderData: ApaCargoOrderRequest): Promise<ApaCargoOrderResponse> {
    console.log('[ApaCargo] Creando orden:', JSON.stringify(orderData, null, 2))

    // Asegurar que el agencyId esté configurado
    if (!orderData.agencyId && APACARGO_AGENCY_ID) {
      orderData.agencyId = APACARGO_AGENCY_ID
    }

    const result = await this.authenticatedRequest<ApaCargoOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })

    console.log('[ApaCargo] Orden creada:', result.code)
    return result
  }

  /**
   * Obtiene una orden por su ID
   */
  async getOrder(orderId: number): Promise<ApaCargoOrderResponse> {
    return this.authenticatedRequest<ApaCargoOrderResponse>(`/orders/${orderId}`)
  }

  /**
   * Obtiene una orden por su código
   */
  async getOrderByCode(code: string): Promise<ApaCargoOrderResponse> {
    return this.authenticatedRequest<ApaCargoOrderResponse>(`/orders/code/${code}`)
  }

  /**
   * Actualiza una orden existente
   */
  async updateOrder(orderId: number, orderData: ApaCargoOrderRequest): Promise<ApaCargoOrderResponse> {
    return this.authenticatedRequest<ApaCargoOrderResponse>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    })
  }

  /**
   * Elimina una orden
   */
  async deleteOrder(orderId: number): Promise<void> {
    await this.authenticatedRequest<void>(`/orders/${orderId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Obtiene la etiqueta EMCI Dispatch Label como PDF
   */
  async getEmciDispatchLabel(orderCode: string): Promise<Blob> {
    console.log('[ApaCargo] Obteniendo etiqueta EMCI para:', orderCode)
    return this.authenticatedRequest<Blob>(`/documentgenerator/order/emcidispatchlabel/${orderCode}`)
  }

  /**
   * Obtiene la etiqueta Aerovaradero como PDF
   */
  async getAeroDispatchLabel(orderCode: string): Promise<Blob> {
    console.log('[ApaCargo] Obteniendo etiqueta Aerovaradero para:', orderCode)
    return this.authenticatedRequest<Blob>(`/documentgenerator/order/aerodispatchlabel/${orderCode}`)
  }

  /**
   * Obtiene documentos de la orden
   */
  async getOrderDocuments(orderId: number, documentType?: string): Promise<Blob> {
    const params = documentType ? `?documentType=${documentType}` : ''
    return this.authenticatedRequest<Blob>(`/documentgenerator/order/${orderId}${params}`)
  }

  /**
   * Obtiene los estados de USA
   */
  async getUSAStates(): Promise<ApaCargoUSAState[]> {
    return this.authenticatedRequest<ApaCargoUSAState[]>('/states/usa')
  }

  /**
   * Obtiene los estados/provincias de Cuba
   */
  async getCubaStates(): Promise<ApaCargoCubaState[]> {
    return this.authenticatedRequest<ApaCargoCubaState[]>('/states/cuba')
  }

  /**
   * Obtiene los municipios de Cuba
   */
  async getMunicipalities(): Promise<ApaCargoCubaMunicipality[]> {
    return this.authenticatedRequest<ApaCargoCubaMunicipality[]>('/municipalities')
  }

  /**
   * Obtiene los tipos de productos de envío
   */
  async getShippingProducts(): Promise<Array<{ id: number; name: string; description?: string }>> {
    return this.authenticatedRequest('/shippingproducts')
  }

  /**
   * Obtiene los servicios disponibles
   */
  async getServices(): Promise<Array<{ id: number; name: string }>> {
    return this.authenticatedRequest('/services')
  }

  /**
   * Verifica si las credenciales están configuradas
   */
  isConfigured(): boolean {
    return !!(APACARGO_USERNAME && APACARGO_PASSWORD && APACARGO_AGENCY_ID)
  }

  /**
   * Obtiene el agencyId configurado
   */
  getAgencyId(): number {
    return APACARGO_AGENCY_ID
  }
}

// Exportar instancia singleton
export const apaCargoClient = new ApaCargoClient()

// Exportar también la clase para testing
export { ApaCargoClient }

/**
 * Utilidades para mapear datos de LogiRapid a ApaCargo
 */
export const apaCargoMapper = {
  /**
   * Separa un nombre completo en firstName y lastName
   */
  splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' }
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    }
  },

  /**
   * Convierte peso de libras a kilogramos
   */
  lbsToKg(lbs: number | string): number {
    const value = typeof lbs === 'string' ? parseFloat(lbs) : lbs
    return Math.round(value * 0.453592 * 100) / 100
  },

  /**
   * Convierte pulgadas a centímetros
   */
  inchesToCm(inches: number | string): number {
    const value = typeof inches === 'string' ? parseFloat(inches) : inches
    return Math.round(value * 2.54 * 100) / 100
  },

  /**
   * Extrae el número de una dirección
   * Ejemplo: "123 Main St" -> "123"
   */
  extractStreetNumber(address: string): string {
    const match = address.match(/^(\d+)\s/)
    return match ? match[1] : ''
  },

  /**
   * Extrae la calle de una dirección (sin el número)
   * Ejemplo: "123 Main St" -> "Main St"
   */
  extractStreetName(address: string): string {
    return address.replace(/^\d+\s+/, '')
  },

  /**
   * Limpia y formatea un número de teléfono
   */
  formatPhone(phone: string): string {
    // Remover todo excepto números y +
    return phone.replace(/[^\d+]/g, '')
  }
}
