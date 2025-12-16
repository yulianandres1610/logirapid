/**
 * UnivCell Reseller API Client
 *
 * Client for interacting with UnivCell's top-up/recharge services.
 * Supports JWT and Basic authentication.
 */

// Types based on UnivCell API schema
export interface UnivCellProduct {
  id: number
  slug: string
  name: string
  price: number
  description: string | null
  pattern: string // Regex to validate phone numbers
  mask?: string // Phone number mask for display
  country_id: number
  created_at: string
  updated_at: string
  range?: boolean // Whether product accepts range denominations
  pivot?: {
    user_id: string
    product_id: number
    rate: number
    visible: number // 1 = visible, 0 = hidden
    created_at: string
    updated_at: string
  }
  country?: UnivCellCountry
}

export interface UnivCellCountry {
  id: number
  sortname: string
  name: string
  phonecode: number
  iso_code_3: string
  continent_code: string
  taxable: number
}

export interface UnivCellPromotion {
  id: string
  product_id: number
  min_amount: number
  from: string
  effective_date: string
  to: string
  summary: string
  description: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  product?: UnivCellProduct
}

export interface UnivCellAuthResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
}

export interface UnivCellCreditsResponse {
  success: boolean
  credit: string | number
}

export interface TopUpRequest {
  product_id: number
  destination: string
  amount: number // Amount in cents (2000 = $20.00)
  local_reference: string
  scheduled_date?: string
  email_notification?: boolean
  realtime?: boolean
  unlimited?: boolean
  topup_mode?: 'SOURCE_AMOUNT' | 'DESTINATION_AMOUNT'
}

export interface TopUpResponse {
  success: boolean
  data: {
    id: string
    reference: string
    resultCode: number
    resultMessage: string
    destination: string
    confirmationCode: string | null
    status: 'ok' | 'error' | 'pending' | 'on-hold'
  }
}

export interface UnivCellConfig {
  baseUrl: string
  username?: string
  password?: string
  userId?: string
  apiKey?: string
  apiSecret?: string
}

// Result codes from UnivCell
export const UNIVCELL_RESULT_CODES: Record<number, string> = {
  500: 'Operation completed',
  501: 'Unknown error',
  502: 'Operation pending',
  503: 'Operation rejected',
  504: 'Operation non existent or not completed previously',
  505: 'Rejected for security reasons',
  507: 'Distributor system error',
  508: 'Provider system error',
  509: 'Product unavailable temporarily',
  510: 'Topup limit exceeded',
  511: 'Duplicated transaction',
  512: 'Invalid amount',
  513: 'Invalid request',
  514: 'Operator unavailable',
  515: 'Asynchronous system unavailable',
  516: 'Invalid subscriber',
}

class UnivCellClient {
  private baseUrl: string
  private username: string
  private password: string
  private userId: string
  private apiKey: string
  private apiSecret: string
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  constructor(config?: Partial<UnivCellConfig>) {
    this.baseUrl = config?.baseUrl || process.env.UNIVCELL_API_URL || 'https://api.univcell.com'
    this.username = config?.username || process.env.UNIVCELL_USERNAME || ''
    this.password = config?.password || process.env.UNIVCELL_PASSWORD || ''
    this.userId = config?.userId || process.env.UNIVCELL_USER_ID || ''
    this.apiKey = config?.apiKey || process.env.UNIVCELL_API_KEY || ''
    this.apiSecret = config?.apiSecret || process.env.UNIVCELL_API_SECRET || ''
  }

  /**
   * Decode JWT token to extract user ID
   */
  private decodeJWT(token: string): { sub?: string; user_id?: string; id?: string } | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      // Decode the payload (second part)
      const payload = parts[1]
      const decoded = Buffer.from(payload, 'base64').toString('utf-8')
      return JSON.parse(decoded)
    } catch (error) {
      console.error('Error decoding JWT:', error)
      return null
    }
  }

  /**
   * Get Basic Auth header value using API Key:API Secret
   */
  private getBasicAuth(): string {
    if (this.apiKey && this.apiSecret) {
      const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')
      return `Basic ${credentials}`
    }
    throw new Error('API Key and API Secret are required for Basic authentication')
  }

  /**
   * Authenticate and get JWT token
   */
  async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: this.username,
        password: this.password,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `Authentication failed: ${response.status}`)
    }

    const data: UnivCellAuthResponse = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000) // Refresh 1 min before expiry

    // Extract user ID from JWT token if not already set
    if (!this.userId && this.accessToken) {
      const decoded = this.decodeJWT(this.accessToken)
      if (decoded) {
        // Try different possible field names for user ID
        this.userId = decoded.sub || decoded.user_id || decoded.id || ''
        console.log('[UnivCell] User ID extracted from token:', this.userId)
      }
    }

    return this.accessToken
  }

  /**
   * Make authenticated request
   * Uses Basic Auth with API Key:Secret (preferred), falls back to JWT Bearer
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    preferBasicAuth: boolean = true
  ): Promise<T> {
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // Try Basic Auth first if API credentials are available
    if (preferBasicAuth && this.apiKey && this.apiSecret) {
      headers['Authorization'] = this.getBasicAuth()
    } else if (this.username && this.password) {
      // Fall back to JWT Bearer token
      const token = await this.authenticate()
      headers['Authorization'] = `Bearer ${token}`
    } else {
      throw new Error('No authentication credentials available')
    }

    console.log(`[UnivCell] Request to ${endpoint} with ${preferBasicAuth && this.apiKey ? 'Basic' : 'Bearer'} auth`)

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage: string
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorJson.message || `Request failed: ${response.status}`
      } catch {
        errorMessage = errorText || `Request failed: ${response.status}`
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Get products the user has contract with
   * GET /users/{id}/products
   */
  async getProducts(): Promise<UnivCellProduct[]> {
    // If we have user ID, use it directly
    if (this.userId) {
      const response = await this.request<Record<string, UnivCellProduct>>(`/users/${this.userId}/products`)
      // API returns object with numeric keys, convert to array
      return Object.values(response)
    }

    // Try to authenticate to get user ID from JWT
    if (this.username && this.password) {
      await this.authenticate()
      if (this.userId) {
        const response = await this.request<Record<string, UnivCellProduct>>(`/users/${this.userId}/products`)
        return Object.values(response)
      }
    }

    throw new Error('User ID is required to fetch products. Please provide UNIVCELL_USER_ID in environment variables.')
  }

  /**
   * Get active or future promotions for products the user has contract with
   * GET /users/products/promotions
   */
  async getPromotions(): Promise<UnivCellPromotion[]> {
    return this.request<UnivCellPromotion[]>('/users/products/promotions')
  }

  /**
   * Get promotions organized by country
   * GET /users/products/promotions/countries
   */
  async getPromotionsByCountry(): Promise<Array<UnivCellCountry & { promotions: UnivCellPromotion[] }>> {
    return this.request('/users/products/promotions/countries')
  }

  /**
   * Get available prices for a specific product
   * GET /products/{productId}/prices
   */
  async getProductPrices(productId: number): Promise<number[]> {
    return this.request<number[]>(`/products/${productId}/prices`)
  }

  /**
   * Get promotions for a specific product
   * GET /products/{productId}/promotions
   */
  async getProductPromotions(productId: number): Promise<UnivCellPromotion[]> {
    return this.request<UnivCellPromotion[]>(`/products/${productId}/promotions`)
  }

  /**
   * Get available products for a specific country
   * GET /products/countries/{countryCode}
   */
  async getProductsByCountry(countryCode: string): Promise<UnivCellProduct[]> {
    return this.request<UnivCellProduct[]>(`/products/countries/${countryCode}`)
  }

  /**
   * Lookup product associated with a subscriber number
   * GET /products/lookup?subscriber=xxx
   */
  async lookupProduct(subscriber: string): Promise<UnivCellProduct[]> {
    return this.request<UnivCellProduct[]>(`/products/lookup?subscriber=${encodeURIComponent(subscriber)}`)
  }

  /**
   * Get user's credits/balance
   * GET /credits
   */
  async getCredits(): Promise<number> {
    const response = await this.request<UnivCellCreditsResponse>('/credits')
    return typeof response.credit === 'string' ? parseFloat(response.credit) : response.credit
  }

  /**
   * Get available countries for topup
   * GET /countries/availability
   */
  async getAvailableCountries(): Promise<UnivCellCountry[]> {
    return this.request<UnivCellCountry[]>('/countries/availability')
  }

  /**
   * Get countries available for the specific user
   * GET /users/countries/availability
   */
  async getUserAvailableCountries(): Promise<UnivCellCountry[]> {
    return this.request<UnivCellCountry[]>('/users/countries/availability')
  }

  /**
   * Execute a top-up order
   * POST /topup
   */
  async executeTopUp(request: TopUpRequest): Promise<TopUpResponse> {
    return this.request<TopUpResponse>('/topup', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get topup record by reference
   * GET /topup/{reference}
   */
  async getTopUpByReference(reference: string): Promise<any> {
    return this.request(`/topup/${encodeURIComponent(reference)}`)
  }

  /**
   * Check if the client is properly configured
   * Requires API Key + Secret, or Username + Password
   */
  isConfigured(): boolean {
    return !!(
      this.baseUrl &&
      ((this.apiKey && this.apiSecret) || (this.username && this.password))
    )
  }

  /**
   * Get configuration status for diagnostics
   */
  getConfigStatus(): {
    hasBaseUrl: boolean
    hasCredentials: boolean
    hasUserId: boolean
    hasApiKey: boolean
    hasApiSecret: boolean
  } {
    return {
      hasBaseUrl: !!this.baseUrl,
      hasCredentials: !!(this.username && this.password),
      hasUserId: !!this.userId,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
    }
  }
}

// Singleton instance for use across the application
let univcellClientInstance: UnivCellClient | null = null

export function getUnivCellClient(config?: Partial<UnivCellConfig>): UnivCellClient {
  if (!univcellClientInstance || config) {
    univcellClientInstance = new UnivCellClient(config)
  }
  return univcellClientInstance
}

export { UnivCellClient }
