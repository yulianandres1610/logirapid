import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Helper to get user from token
async function getUserFromToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number
      email: string
      role: string
      companyId: number
    }
  } catch {
    return null
  }
}

// GET /api/products - List all products in catalog
// Query params: ?category=paqueteria&active=true
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Check if product_catalog table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_catalog'
      ) as exists
    `)

    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet, return empty catalog
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          byCategory: {},
          total: 0
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') !== 'false'

    // Use new column names after migration 40
    // Support both old and new column names for backwards compatibility
    let query = `
      SELECT
        id,
        code,
        name,
        description,
        service_category,
        product_type,
        dimensions,
        weight_capacity,
        unit_type,
        -- New names (after migration 40)
        COALESCE(mi_costo, provider_cost) as mi_costo,
        COALESCE(precio_mayorista, provider_b2b_price) as precio_mayorista,
        COALESCE(precio_publico, platform_min_b2c) as precio_publico,
        pricing_model,
        provider_company_id,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM product_catalog
      WHERE 1=1
    `
    const params: any[] = []

    if (category) {
      params.push(category)
      query += ` AND service_category = $${params.length}`
    }

    if (activeOnly) {
      query += ` AND is_active = true`
    }

    query += ` ORDER BY service_category, display_order, name`

    const result = await db.query(query, params)

    // Group by category for easier frontend consumption
    const byCategory: Record<string, any[]> = {}
    for (const product of result.rows) {
      const cat = product.service_category
      if (!byCategory[cat]) {
        byCategory[cat] = []
      }
      byCategory[cat].push(product)
    }

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows,
        byCategory,
        total: result.rows.length
      }
    })

  } catch (error: any) {
    console.error('[Products API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener productos'
    }, { status: 500 })
  }
}

// POST /api/products - Create new product (SUPER_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede crear productos'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      service_category,
      product_type,
      dimensions,
      weight_capacity,
      unit_type,
      // New field names
      mi_costo,
      precio_mayorista,
      precio_publico,
      // Legacy support
      provider_cost,
      provider_b2b_price,
      platform_min_b2c,
      pricing_model,
      provider_company_id,
      display_order
    } = body

    // Validate required fields
    if (!code || !name || !service_category || !product_type) {
      return NextResponse.json({
        success: false,
        error: 'Campos requeridos: code, name, service_category, product_type'
      }, { status: 400 })
    }

    // Validate category
    const validCategories = ['paqueteria', 'remesa', 'recarga', 'mercado']
    if (!validCategories.includes(service_category)) {
      return NextResponse.json({
        success: false,
        error: `service_category debe ser uno de: ${validCategories.join(', ')}`
      }, { status: 400 })
    }

    // Use new field names, fallback to legacy
    const finalMiCosto = mi_costo ?? provider_cost ?? 0
    const finalPrecioMayorista = precio_mayorista ?? provider_b2b_price ?? (finalMiCosto * 1.2)
    const finalPrecioPublico = precio_publico ?? platform_min_b2c ?? (finalPrecioMayorista * 1.5)

    const result = await db.query(`
      INSERT INTO product_catalog (
        code, name, description, service_category, product_type,
        dimensions, weight_capacity, unit_type,
        mi_costo, precio_mayorista, precio_publico,
        pricing_model, provider_company_id, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      code,
      name,
      description || null,
      service_category,
      product_type,
      dimensions || null,
      weight_capacity || null,
      unit_type || 'unit',
      finalMiCosto,
      finalPrecioMayorista,
      finalPrecioPublico,
      pricing_model || 'fixed',
      provider_company_id || null,
      display_order || 0
    ])

    // Log history
    await db.query(`
      INSERT INTO product_pricing_history (
        product_id, change_type, change_level,
        new_provider_cost, new_platform_price,
        changed_by_user_id, changed_by_user_name, notes
      ) VALUES ($1, 'create', 'platform', $2, $3, $4, $5, $6)
    `, [
      result.rows[0].id,
      finalMiCosto,
      finalPrecioMayorista,
      user.userId,
      user.email,
      `Producto creado: ${name}`
    ])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('[Products API] POST error:', error)

    if (error.code === '23505') { // Unique violation
      return NextResponse.json({
        success: false,
        error: 'Ya existe un producto con ese codigo'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Error al crear producto'
    }, { status: 500 })
  }
}

// PUT /api/products - Update platform pricing for multiple products (SUPER_ADMIN only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede actualizar precios de plataforma'
      }, { status: 403 })
    }

    const body = await request.json()
    const { products, notes } = body

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un array de productos'
      }, { status: 400 })
    }

    const results: { id: number; success: boolean; error?: string }[] = []

    for (const product of products) {
      try {
        const {
          id,
          // New field names
          mi_costo,
          precio_mayorista,
          precio_publico,
          // Legacy support
          provider_cost,
          provider_b2b_price,
          platform_min_b2c
        } = product

        if (!id) {
          results.push({ id: 0, success: false, error: 'ID requerido' })
          continue
        }

        // Get current values for history
        const current = await db.query(
          `SELECT
            COALESCE(mi_costo, provider_cost) as mi_costo,
            COALESCE(precio_mayorista, provider_b2b_price) as precio_mayorista,
            COALESCE(precio_publico, platform_min_b2c) as precio_publico
          FROM product_catalog WHERE id = $1`,
          [id]
        )

        if (current.rows.length === 0) {
          results.push({ id, success: false, error: 'Producto no encontrado' })
          continue
        }

        // Use new names, fallback to legacy
        const newMiCosto = mi_costo ?? provider_cost
        const newPrecioMayorista = precio_mayorista ?? provider_b2b_price
        const newPrecioPublico = precio_publico ?? platform_min_b2c

        // Update product with new field names
        await db.query(`
          UPDATE product_catalog
          SET mi_costo = COALESCE($1, mi_costo),
              precio_mayorista = COALESCE($2, precio_mayorista),
              precio_publico = COALESCE($3, precio_publico),
              updated_at = NOW()
          WHERE id = $4
        `, [newMiCosto, newPrecioMayorista, newPrecioPublico, id])

        // Log history
        await db.query(`
          INSERT INTO product_pricing_history (
            product_id, change_type, change_level,
            old_provider_cost, old_platform_price,
            new_provider_cost, new_platform_price,
            changed_by_user_id, changed_by_user_name, notes
          ) VALUES ($1, 'update', 'platform', $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          current.rows[0].mi_costo,
          current.rows[0].precio_mayorista,
          newMiCosto ?? current.rows[0].mi_costo,
          newPrecioMayorista ?? current.rows[0].precio_mayorista,
          user.userId,
          user.email,
          notes || 'Actualizacion de precio de plataforma'
        ])

        results.push({ id, success: true })

      } catch (err: any) {
        results.push({
          id: product.id || 0,
          success: false,
          error: err.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      }
    })

  } catch (error: any) {
    console.error('[Products API] PUT error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al actualizar productos'
    }, { status: 500 })
  }
}
