/**
 * Odoo 16 REST API Client
 * Supports JSON-RPC for Odoo 16+
 *
 * Authentication methods:
 * 1. API Key via header (recommended for Odoo 16+)
 * 2. Session-based with user/password fallback
 */

export interface OdooConfig {
  url: string
  database: string
  apiKey: string
  username?: string // Optional: if provided, uses session auth with apiKey as password
}

export interface OdooProduct {
  id: number
  name: string
  default_code: string // SKU
  barcode: string | false
  list_price: number
  standard_price: number // Cost
  categ_id: [number, string] | false
  uom_id: [number, string]
  qty_available: number
  image_1920: string | false // Base64 image
  active: boolean
  type: string
  create_date: string
  write_date: string
}

export interface OdooProductData {
  name: string
  default_code?: string
  barcode?: string
  list_price?: number
  standard_price?: number
  categ_id?: number
  uom_id?: number
  type?: 'consu' | 'service' | 'product'
  active?: boolean
}

export interface OdooStockLevel {
  product_id: [number, string]
  location_id: [number, string]
  quantity: number
  reserved_quantity: number
}

export interface OdooVariant {
  id: number
  name: string
  default_code: string
  barcode: string | false
  lst_price: number
  product_tmpl_id: [number, string]
  attribute_value_ids: [number, string][]
  qty_available: number
}

export interface OdooSyncResult {
  imported: number
  updated: number
  errors: { id: number; error: string }[]
}

class OdooClient {
  private url: string
  private database: string
  private apiKey: string
  private username: string | null = null
  private uid: number | null = null
  private sessionId: string | null = null
  private useApiKeyHeader: boolean = true // Use API key in header (Odoo 16+ method)

  constructor(config: OdooConfig) {
    this.url = config.url.replace(/\/$/, '') // Remove trailing slash
    this.database = config.database
    this.apiKey = config.apiKey
    this.username = config.username || null
  }

  /**
   * Make a JSON-RPC call to Odoo
   * For Odoo 16+, uses API key in header for authentication
   */
  private async jsonRpc(endpoint: string, method: string, params: any, requiresAuth = true): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // For Odoo 16+: Use API key in header (preferred method)
    if (this.useApiKeyHeader && this.apiKey) {
      headers['api-key'] = this.apiKey
    }

    // Add session cookie if available (for session-based auth)
    if (this.sessionId) {
      headers['Cookie'] = `session_id=${this.sessionId}`
    }

    console.log(`[Odoo Client] Making request to ${this.url}${endpoint}`)
    console.log(`[Odoo Client] Using API Key header: ${this.useApiKeyHeader}`)

    const response = await fetch(`${this.url}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Date.now(),
      }),
    })

    // Extract session cookie from response
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      const sessionMatch = setCookie.match(/session_id=([^;]+)/)
      if (sessionMatch) {
        this.sessionId = sessionMatch[1]
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Odoo Client] HTTP Error:', response.status, errorText)

      // If API key method fails with 401/403, try session-based auth
      if ((response.status === 401 || response.status === 403) && this.useApiKeyHeader) {
        console.log('[Odoo Client] API key auth failed, trying session-based auth...')
        this.useApiKeyHeader = false
        await this.authenticate()
        return this.jsonRpc(endpoint, method, params, false)
      }

      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      console.error('[Odoo Client] Odoo Error:', data.error)
      const errorMessage = data.error.data?.message || data.error.message || 'Odoo error'

      // If session/access error and using API key, try session-based auth
      if (this.useApiKeyHeader && (
        errorMessage.toLowerCase().includes('access denied') ||
        errorMessage.toLowerCase().includes('session') ||
        errorMessage.toLowerCase().includes('expired') ||
        errorMessage.toLowerCase().includes('api key')
      )) {
        console.log('[Odoo Client] API key auth issue, trying session-based auth...')
        this.useApiKeyHeader = false
        await this.authenticate()
        return this.jsonRpc(endpoint, method, params, false)
      }

      // If session expired with session-based auth, re-authenticate
      if (!this.useApiKeyHeader && (
        errorMessage.toLowerCase().includes('session') ||
        errorMessage.toLowerCase().includes('expired')
      )) {
        console.log('[Odoo Client] Session expired, re-authenticating...')
        this.sessionId = null
        this.uid = null
        await this.authenticate()
        return this.jsonRpc(endpoint, method, params, false)
      }

      throw new Error(errorMessage)
    }

    return data.result
  }

  /**
   * Call a model method via JSON-RPC
   * Uses XML-RPC style if session is not available
   */
  private async call(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    // If we have a session, use the web endpoint
    if (this.sessionId) {
      return this.jsonRpc('/web/dataset/call_kw', 'call', {
        model,
        method,
        args,
        kwargs,
      })
    }

    // Otherwise use XML-RPC style with execute_kw
    // This requires: db, uid, password, model, method, args, kwargs
    if (!this.uid) {
      await this.authenticate()
    }

    if (!this.uid) {
      throw new Error('No authenticated. Call authenticate() first.')
    }

    console.log(`[Odoo Client] Using XML-RPC execute_kw for ${model}.${method}`)

    const result = await this.jsonRpc('/jsonrpc', 'call', {
      service: 'object',
      method: 'execute_kw',
      args: [
        this.database,
        this.uid,
        this.apiKey,
        model,
        method,
        args,
        kwargs
      ]
    }, false)

    return result
  }

  /**
   * Authenticate with Odoo
   * Priority order:
   * 1. XML-RPC style authentication (most reliable, no rate limiting)
   * 2. Session-based authentication (may have rate limiting)
   * 3. API key in header (Odoo 16+ only)
   */
  async authenticate(): Promise<boolean> {
    try {
      console.log('[Odoo Client] Authenticating with Odoo...')
      console.log('[Odoo Client] Database:', this.database)
      console.log('[Odoo Client] Username:', this.username || '(not provided)')
      console.log('[Odoo Client] API Key length:', this.apiKey?.length || 0)

      // Determine which usernames to try
      const usernamesToTry = this.username
        ? [this.username]
        : ['admin', this.apiKey.includes('@') ? this.apiKey : null].filter(Boolean) as string[]

      // Method 1 (PREFERRED): Try XML-RPC style authentication first
      // This method works best and typically doesn't have rate limiting issues
      for (const login of usernamesToTry) {
        try {
          console.log(`[Odoo Client] Trying XML-RPC auth with login: ${login}`)
          const xmlRpcResult = await this.jsonRpc('/jsonrpc', 'call', {
            service: 'common',
            method: 'authenticate',
            args: [this.database, login, this.apiKey, {}]
          }, false)

          if (xmlRpcResult && typeof xmlRpcResult === 'number' && xmlRpcResult > 0) {
            this.uid = xmlRpcResult
            this.useApiKeyHeader = false
            console.log('[Odoo Client] XML-RPC auth successful, uid:', this.uid)
            return true
          } else if (xmlRpcResult === false) {
            console.log(`[Odoo Client] XML-RPC auth failed for ${login}: Invalid credentials`)
          }
        } catch (xmlRpcError) {
          console.log(`[Odoo Client] XML-RPC auth error for ${login}:`, xmlRpcError instanceof Error ? xmlRpcError.message : 'Unknown error')
        }
      }

      // Method 2: Try session-based authentication
      // This might have rate limiting on some servers
      for (const login of usernamesToTry) {
        try {
          console.log(`[Odoo Client] Trying session auth with login: ${login}`)
          const result = await this.jsonRpc('/web/session/authenticate', 'call', {
            db: this.database,
            login: login,
            password: this.apiKey,
          }, false)

          if (result && result.uid) {
            this.uid = result.uid
            this.useApiKeyHeader = false
            console.log('[Odoo Client] Session authentication successful, uid:', this.uid)
            return true
          }
        } catch (authError) {
          const errorMsg = authError instanceof Error ? authError.message : 'Unknown error'
          console.log(`[Odoo Client] Session auth failed for ${login}:`, errorMsg)
          // If rate limited, don't try more usernames
          if (errorMsg.toLowerCase().includes('intentos') || errorMsg.toLowerCase().includes('attempts')) {
            console.log('[Odoo Client] Rate limited, stopping session auth attempts')
            break
          }
        }
      }

      // Method 3: If using API key header mode, verify it works
      if (this.useApiKeyHeader) {
        try {
          console.log('[Odoo Client] Testing API key header authentication...')
          const sessionInfo = await this.jsonRpc('/web/session/get_session_info', 'call', {}, false)

          if (sessionInfo && sessionInfo.uid) {
            this.uid = sessionInfo.uid
            console.log('[Odoo Client] API key header auth successful, uid:', this.uid)
            return true
          }
        } catch (apiKeyError) {
          console.log('[Odoo Client] API key header auth failed')
        }
      }

      console.log('[Odoo Client] All authentication methods failed')
      return false
    } catch (error) {
      console.error('[Odoo Client] Authentication error:', error)
      return false
    }
  }

  /**
   * Test connection to Odoo
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string; details?: string }> {
    try {
      console.log('[Odoo Client] Testing connection to:', this.url)
      console.log('[Odoo Client] Database:', this.database)

      // First try to get version info (doesn't require auth)
      let versionInfo: any = null
      try {
        versionInfo = await this.jsonRpc('/web/webclient/version_info', 'call', {}, false)
        console.log('[Odoo Client] Version info:', versionInfo)
      } catch (versionError) {
        console.log('[Odoo Client] Could not get version (might be normal):', versionError)
      }

      // Try to authenticate using various methods
      const authSuccess = await this.authenticate()

      if (!authSuccess) {
        // Provide detailed error message based on what we know
        let message = 'Autenticación falló.'

        if (!this.database) {
          message += ' Falta el nombre de la base de datos.'
        } else {
          message += ` Verifica que:\n- El API Key sea válido y esté activo\n- El usuario tenga permisos de acceso\n- La base de datos "${this.database}" exista`
        }

        return {
          success: false,
          message,
          version: versionInfo?.server_version,
          details: `URL: ${this.url}, DB: ${this.database || '(no especificada)'}`
        }
      }

      // Try a simple query to verify full access
      try {
        const userInfo = await this.jsonRpc('/web/session/get_session_info', 'call', {}, false)
        console.log('[Odoo Client] Session info:', userInfo)

        return {
          success: true,
          message: `Conexión exitosa. Usuario: ${userInfo?.username || userInfo?.name || 'Autenticado'}`,
          version: versionInfo?.server_version,
        }
      } catch {
        return {
          success: true,
          message: 'Conexión y autenticación exitosa',
          version: versionInfo?.server_version,
        }
      }
    } catch (error) {
      console.error('[Odoo Client] Connection test error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión'

      // Check for common issues
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        return {
          success: false,
          message: `No se pudo conectar al servidor. Verifica que la URL "${this.url}" sea correcta y el servidor esté activo.`,
        }
      }

      if (errorMessage.includes('CERT') || errorMessage.includes('SSL')) {
        return {
          success: false,
          message: 'Error de certificado SSL. Verifica que la URL use HTTPS correctamente.',
        }
      }

      return {
        success: false,
        message: errorMessage,
      }
    }
  }

  /**
   * Get products from Odoo
   */
  async getProducts(options: {
    limit?: number
    offset?: number
    domain?: any[]
    lastSyncDate?: string
  } = {}): Promise<OdooProduct[]> {
    const domain: any[] = options.domain || [['active', '=', true]]

    if (options.lastSyncDate) {
      domain.push(['write_date', '>', options.lastSyncDate])
    }

    return this.call('product.product', 'search_read', [domain], {
      fields: [
        'id',
        'name',
        'default_code',
        'barcode',
        'list_price',
        'standard_price',
        'categ_id',
        'uom_id',
        'qty_available',
        'image_1920',
        'active',
        'type',
        'create_date',
        'write_date',
      ],
      limit: options.limit || 100,
      offset: options.offset || 0,
      order: 'write_date desc',
    })
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: number): Promise<OdooProduct | null> {
    const products = await this.call('product.product', 'search_read', [[['id', '=', id]]], {
      fields: [
        'id',
        'name',
        'default_code',
        'barcode',
        'list_price',
        'standard_price',
        'categ_id',
        'uom_id',
        'qty_available',
        'image_1920',
        'active',
        'type',
        'create_date',
        'write_date',
      ],
    })
    return products.length > 0 ? products[0] : null
  }

  /**
   * Search product by SKU or barcode
   */
  async searchProduct(code: string): Promise<OdooProduct | null> {
    const products = await this.call('product.product', 'search_read', [
      ['|', ['default_code', '=', code], ['barcode', '=', code]],
    ], {
      fields: [
        'id',
        'name',
        'default_code',
        'barcode',
        'list_price',
        'standard_price',
        'categ_id',
        'qty_available',
      ],
      limit: 1,
    })
    return products.length > 0 ? products[0] : null
  }

  /**
   * Create a product in Odoo
   */
  async createProduct(data: OdooProductData): Promise<number> {
    const productData = {
      name: data.name,
      default_code: data.default_code || false,
      barcode: data.barcode || false,
      list_price: data.list_price || 0,
      standard_price: data.standard_price || 0,
      categ_id: data.categ_id || false,
      uom_id: data.uom_id || 1, // Default to "Units"
      type: data.type || 'product',
      active: data.active !== false,
    }

    return this.call('product.product', 'create', [productData])
  }

  /**
   * Update a product in Odoo
   */
  async updateProduct(id: number, data: Partial<OdooProductData>): Promise<boolean> {
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.default_code !== undefined) updateData.default_code = data.default_code || false
    if (data.barcode !== undefined) updateData.barcode = data.barcode || false
    if (data.list_price !== undefined) updateData.list_price = data.list_price
    if (data.standard_price !== undefined) updateData.standard_price = data.standard_price
    if (data.categ_id !== undefined) updateData.categ_id = data.categ_id || false
    if (data.active !== undefined) updateData.active = data.active

    return this.call('product.product', 'write', [[id], updateData])
  }

  /**
   * Get stock levels for products
   */
  async getStockLevels(productIds: number[]): Promise<OdooStockLevel[]> {
    return this.call('stock.quant', 'search_read', [
      [
        ['product_id', 'in', productIds],
        ['location_id.usage', '=', 'internal'],
      ],
    ], {
      fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
    })
  }

  /**
   * Update stock quantity (inventory adjustment)
   */
  async updateStock(productId: number, locationId: number, quantity: number): Promise<boolean> {
    try {
      // Create an inventory adjustment
      const inventoryId = await this.call('stock.inventory', 'create', [{
        name: `API Adjustment - ${new Date().toISOString()}`,
        product_ids: [[6, 0, [productId]]],
        location_ids: [[6, 0, [locationId]]],
      }])

      // Start the inventory
      await this.call('stock.inventory', 'action_start', [[inventoryId]])

      // Set the quantity
      const lines = await this.call('stock.inventory.line', 'search_read', [
        [['inventory_id', '=', inventoryId], ['product_id', '=', productId]],
      ], { fields: ['id'] })

      if (lines.length > 0) {
        await this.call('stock.inventory.line', 'write', [[lines[0].id], {
          product_qty: quantity,
        }])
      }

      // Validate the inventory
      await this.call('stock.inventory', 'action_validate', [[inventoryId]])

      return true
    } catch (error) {
      console.error('Error updating stock:', error)
      return false
    }
  }

  /**
   * Get product variants for a template
   */
  async getProductVariants(templateId: number): Promise<OdooVariant[]> {
    return this.call('product.product', 'search_read', [
      [['product_tmpl_id', '=', templateId]],
    ], {
      fields: [
        'id',
        'name',
        'default_code',
        'barcode',
        'lst_price',
        'product_tmpl_id',
        'product_template_attribute_value_ids',
        'qty_available',
      ],
    })
  }

  /**
   * Get product categories
   */
  async getCategories(): Promise<{ id: number; name: string; parent_id: [number, string] | false }[]> {
    return this.call('product.category', 'search_read', [[]], {
      fields: ['id', 'name', 'parent_id'],
    })
  }

  /**
   * Get units of measure
   */
  async getUnitsOfMeasure(): Promise<{ id: number; name: string }[]> {
    return this.call('uom.uom', 'search_read', [[]], {
      fields: ['id', 'name'],
    })
  }

  /**
   * Get warehouses/locations
   */
  async getWarehouses(): Promise<{ id: number; name: string; code: string }[]> {
    return this.call('stock.warehouse', 'search_read', [[]], {
      fields: ['id', 'name', 'code'],
    })
  }

  /**
   * Get count of products
   */
  async getProductCount(domain: any[] = []): Promise<number> {
    return this.call('product.product', 'search_count', [domain])
  }
}

/**
 * Create an Odoo client instance
 */
export function createOdooClient(config: OdooConfig): OdooClient {
  return new OdooClient(config)
}

/**
 * Transform Odoo product to local format
 */
export function transformOdooProduct(odooProduct: OdooProduct): {
  name: string
  sku: string
  barcode: string | null
  costPrice: number
  sellingPrice: number
  categoryName: string | null
  unitOfMeasure: string
  quantityOnHand: number
  imageBase64: string | null
} {
  return {
    name: odooProduct.name,
    sku: odooProduct.default_code || '',
    barcode: odooProduct.barcode || null,
    costPrice: odooProduct.standard_price,
    sellingPrice: odooProduct.list_price,
    categoryName: odooProduct.categ_id ? odooProduct.categ_id[1] : null,
    unitOfMeasure: odooProduct.uom_id ? odooProduct.uom_id[1] : 'Unidad',
    quantityOnHand: odooProduct.qty_available,
    imageBase64: odooProduct.image_1920 || null,
  }
}

/**
 * Transform local product to Odoo format
 */
export function transformToOdooProduct(localProduct: {
  name: string
  sku?: string
  barcode?: string | null
  costPrice?: number
  sellingPrice?: number
}): OdooProductData {
  return {
    name: localProduct.name,
    default_code: localProduct.sku,
    barcode: localProduct.barcode || undefined,
    standard_price: localProduct.costPrice,
    list_price: localProduct.sellingPrice,
    type: 'product',
    active: true,
  }
}

export default OdooClient
