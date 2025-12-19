/**
 * Odoo 16+/18 REST API Client
 * Uses XML-RPC style calls (most reliable method)
 */

export interface OdooConfig {
  url: string
  database: string
  apiKey: string
  username?: string
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
  private username: string
  private uid: number | null = null

  constructor(config: OdooConfig) {
    this.url = config.url.replace(/\/$/, '')
    this.database = config.database
    this.apiKey = config.apiKey
    this.username = config.username || 'admin'
  }

  /**
   * Make a JSON-RPC call to Odoo's /jsonrpc endpoint
   */
  private async jsonRpc(service: string, method: string, args: any[]): Promise<any> {
    const response = await fetch(`${this.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: Date.now()
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      const errorMsg = data.error.data?.message || data.error.message || 'Odoo error'
      throw new Error(errorMsg)
    }

    return data.result
  }

  /**
   * Call a model method using execute_kw
   */
  private async call(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    if (!this.uid) {
      await this.authenticate()
    }

    if (!this.uid) {
      throw new Error('Not authenticated')
    }

    return this.jsonRpc('object', 'execute_kw', [
      this.database,
      this.uid,
      this.apiKey,
      model,
      method,
      args,
      kwargs
    ])
  }

  /**
   * Authenticate with Odoo using XML-RPC
   */
  async authenticate(): Promise<boolean> {
    try {
      console.log('[Odoo Client] Authenticating...')

      const result = await this.jsonRpc('common', 'authenticate', [
        this.database,
        this.username,
        this.apiKey,
        {}
      ])

      if (result && typeof result === 'number' && result > 0) {
        this.uid = result
        console.log('[Odoo Client] Auth successful, UID:', this.uid)
        return true
      }

      console.log('[Odoo Client] Auth failed, result:', result)
      return false
    } catch (error) {
      console.error('[Odoo Client] Auth error:', error)
      return false
    }
  }

  /**
   * Test connection to Odoo
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      // Get version
      const versionResponse = await fetch(`${this.url}/web/webclient/version_info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Date.now()
        }),
        signal: AbortSignal.timeout(10000)
      })

      let version: string | undefined
      if (versionResponse.ok) {
        const versionData = await versionResponse.json()
        version = versionData.result?.server_version
      }

      // Authenticate
      const authSuccess = await this.authenticate()

      if (!authSuccess) {
        return {
          success: false,
          message: 'Autenticación fallida. Verifica usuario y API Key.',
          version
        }
      }

      return {
        success: true,
        message: `Conexión exitosa. UID: ${this.uid}`,
        version
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error de conexión'
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
        'id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
        'categ_id', 'uom_id', 'qty_available', 'image_1920', 'active', 'type',
        'create_date', 'write_date'
      ],
      limit: options.limit || 100,
      offset: options.offset || 0,
      order: 'write_date desc'
    })
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: number): Promise<OdooProduct | null> {
    const products = await this.call('product.product', 'search_read', [[['id', '=', id]]], {
      fields: [
        'id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price',
        'categ_id', 'uom_id', 'qty_available', 'image_1920', 'active', 'type',
        'create_date', 'write_date'
      ]
    })
    return products.length > 0 ? products[0] : null
  }

  /**
   * Search product by SKU or barcode
   */
  async searchProduct(code: string): Promise<OdooProduct | null> {
    const products = await this.call('product.product', 'search_read', [
      ['|', ['default_code', '=', code], ['barcode', '=', code]]
    ], {
      fields: ['id', 'name', 'default_code', 'barcode', 'list_price', 'standard_price', 'categ_id', 'qty_available'],
      limit: 1
    })
    return products.length > 0 ? products[0] : null
  }

  /**
   * Create a product in Odoo
   */
  async createProduct(data: OdooProductData): Promise<number> {
    return this.call('product.product', 'create', [{
      name: data.name,
      default_code: data.default_code || false,
      barcode: data.barcode || false,
      list_price: data.list_price || 0,
      standard_price: data.standard_price || 0,
      categ_id: data.categ_id || false,
      uom_id: data.uom_id || 1,
      type: data.type || 'product',
      active: data.active !== false
    }])
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
      [['product_id', 'in', productIds], ['location_id.usage', '=', 'internal']]
    ], {
      fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity']
    })
  }

  /**
   * Get product variants for a template
   */
  async getProductVariants(templateId: number): Promise<OdooVariant[]> {
    return this.call('product.product', 'search_read', [
      [['product_tmpl_id', '=', templateId]]
    ], {
      fields: ['id', 'name', 'default_code', 'barcode', 'lst_price', 'product_tmpl_id', 'product_template_attribute_value_ids', 'qty_available']
    })
  }

  /**
   * Get product categories
   */
  async getCategories(): Promise<{ id: number; name: string; parent_id: [number, string] | false }[]> {
    return this.call('product.category', 'search_read', [[]], {
      fields: ['id', 'name', 'parent_id']
    })
  }

  /**
   * Get units of measure
   */
  async getUnitsOfMeasure(): Promise<{ id: number; name: string }[]> {
    return this.call('uom.uom', 'search_read', [[]], {
      fields: ['id', 'name']
    })
  }

  /**
   * Get warehouses
   */
  async getWarehouses(): Promise<{ id: number; name: string; code: string }[]> {
    return this.call('stock.warehouse', 'search_read', [[]], {
      fields: ['id', 'name', 'code']
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
    imageBase64: odooProduct.image_1920 || null
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
    active: true
  }
}

export default OdooClient
