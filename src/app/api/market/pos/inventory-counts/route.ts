import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/pos/inventory-counts
 * Lista todos los conteos de inventario de la empresa
 *
 * Query params:
 * - status: 'in_progress' | 'completed' | 'approved' | 'rejected' | 'all'
 * - requiresApproval: 'true' para obtener solo conteos que necesitan aprobación
 * - page: número de página
 * - limit: items por página
 */
export async function GET(request: NextRequest) {
  try {
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const requiresApproval = searchParams.get('requiresApproval') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query based on filters
    let statusFilter = ''
    if (requiresApproval) {
      // Solo conteos completados CON diferencias (pendientes de aprobación)
      statusFilter = "AND c.status = 'completed' AND c.products_with_differences > 0"
    } else if (status !== 'all') {
      statusFilter = `AND c.status = '${status}'`
    }

    // Get counts with approval info
    const countsResult = await db.query(`
      SELECT
        c.id,
        c.count_number,
        c.status,
        c.total_products,
        c.products_with_differences,
        c.total_difference_value,
        c.notes,
        c.created_at,
        c.completed_at,
        c.updated_at,
        c.auto_approved,
        c.approved_by,
        c.approved_at,
        w.name as warehouse_name,
        s.session_code,
        t.name as terminal_name,
        u.firstname || ' ' || u.lastname as counted_by_name,
        ua.firstname || ' ' || ua.lastname as approved_by_name
      FROM market_inventory_counts c
      LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
      LEFT JOIN market_pos_sessions s ON c.session_id = s.id
      LEFT JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      LEFT JOIN users u ON c.counted_by = u.id
      LEFT JOIN users ua ON c.approved_by = ua.id
      WHERE c.company_id = $1 ${statusFilter}
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [payload.companyId, limit, offset])

    // Get total count for pagination
    const totalResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_inventory_counts c
      WHERE c.company_id = $1 ${statusFilter}
    `, [payload.companyId])

    const total = parseInt(totalResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: {
        counts: countsResult.rows.map(c => ({
          id: c.id,
          countNumber: c.count_number,
          status: c.status,
          totalProducts: parseInt(c.total_products) || 0,
          productsWithDifferences: parseInt(c.products_with_differences) || 0,
          totalDifferenceValue: parseFloat(c.total_difference_value) || 0,
          notes: c.notes,
          createdAt: c.created_at,
          completedAt: c.completed_at,
          updatedAt: c.updated_at,
          autoApproved: c.auto_approved || false,
          approvedBy: c.approved_by,
          approvedAt: c.approved_at,
          approvedByName: c.approved_by_name,
          warehouseName: c.warehouse_name,
          sessionCode: c.session_code,
          terminalName: c.terminal_name,
          countedByName: c.counted_by_name
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Inventory Counts API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conteos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/inventory-counts
 * Aprobar un conteo y ajustar inventario
 */
export async function POST(request: NextRequest) {
  try {
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const body = await request.json()
    const { countId, action } = body

    if (!countId) {
      return NextResponse.json({
        success: false,
        error: 'countId es requerido'
      }, { status: 400 })
    }

    // Get count details
    const countResult = await db.query(`
      SELECT c.*, w.id as warehouse_id
      FROM market_inventory_counts c
      LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
      WHERE c.id = $1 AND c.company_id = $2
    `, [countId, payload.companyId])

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conteo no encontrado'
      }, { status: 404 })
    }

    const count = countResult.rows[0]

    if (count.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden aprobar conteos completados'
      }, { status: 400 })
    }

    if (action === 'approve') {
      // Get count lines with differences - including variant_id for proper matching
      const linesResult = await db.query(`
        SELECT
          cl.*,
          p.name as product_name,
          COALESCE(ws.quantity_on_hand, p.quantity_on_hand, 0) as current_stock
        FROM market_inventory_count_lines cl
        LEFT JOIN market_products p ON cl.product_id = p.id
        LEFT JOIN market_warehouse_stock ws ON cl.product_id = ws.product_id
          AND ws.warehouse_id = $2
          AND cl.variant_id IS NOT DISTINCT FROM ws.variant_id
        WHERE cl.count_id = $1
      `, [countId, count.warehouse_id])

      // Update inventory based on count - properly handling variants
      for (const line of linesResult.rows) {
        const difference = parseInt(line.counted_quantity) - parseInt(line.current_stock || 0)

        if (difference !== 0) {
          // Check if warehouse stock record exists for this product+variant combination
          const stockCheck = await db.query(`
            SELECT id FROM market_warehouse_stock
            WHERE product_id = $1 AND warehouse_id = $2
              AND variant_id IS NOT DISTINCT FROM $3
          `, [line.product_id, count.warehouse_id, line.variant_id || null])

          if (stockCheck.rows.length > 0) {
            // Update existing stock for the specific variant
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = $1, updated_at = NOW()
              WHERE product_id = $2 AND warehouse_id = $3
                AND variant_id IS NOT DISTINCT FROM $4
            `, [line.counted_quantity, line.product_id, count.warehouse_id, line.variant_id || null])
          } else {
            // Insert new stock record with variant_id
            await db.query(`
              INSERT INTO market_warehouse_stock (product_id, warehouse_id, variant_id, quantity_on_hand, created_at, updated_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
            `, [line.product_id, count.warehouse_id, line.variant_id || null, line.counted_quantity])
          }

          // Update product or variant stock based on whether it's a variant count
          if (line.variant_id) {
            // Update variant stock
            await db.query(`
              UPDATE market_product_variants
              SET quantity_on_hand = $1, updated_at = NOW()
              WHERE id = $2
            `, [line.counted_quantity, line.variant_id])

            // IMPORTANTE: Si hay stock "huérfano" a nivel producto (sin variant_id),
            // debemos eliminarlo porque ya fue incluido en el conteo de la variante
            // Esto evita duplicación futura del stock
            const orphanStock = await db.query(`
              SELECT id, quantity_on_hand FROM market_warehouse_stock
              WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
            `, [line.product_id, count.warehouse_id])

            if (orphanStock.rows.length > 0 && parseFloat(orphanStock.rows[0].quantity_on_hand) > 0) {
              console.log(`[Inventory Count Approve] Limpiando stock huérfano (sin variante) para producto ${line.product_id}: ${orphanStock.rows[0].quantity_on_hand} unidades`)
              await db.query(`
                UPDATE market_warehouse_stock
                SET quantity_on_hand = 0, updated_at = NOW()
                WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
              `, [line.product_id, count.warehouse_id])
            }
          } else {
            // Update main product stock (only if no variant)
            await db.query(`
              UPDATE market_products
              SET quantity_on_hand = $1, updated_at = NOW()
              WHERE id = $2
            `, [line.counted_quantity, line.product_id])
          }
        }
      }

      // Mark count as approved with approver info
      await db.query(`
        UPDATE market_inventory_counts
        SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [payload.userId, countId])

      return NextResponse.json({
        success: true,
        message: 'Conteo aprobado e inventario ajustado',
        data: {
          countId,
          status: 'approved',
          adjustedProducts: linesResult.rows.length
        }
      })

    } else if (action === 'reject') {
      // Mark count as rejected
      await db.query(`
        UPDATE market_inventory_counts
        SET status = 'rejected', updated_at = NOW()
        WHERE id = $1
      `, [countId])

      return NextResponse.json({
        success: true,
        message: 'Conteo rechazado',
        data: {
          countId,
          status: 'rejected'
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida. Use "approve" o "reject"'
    }, { status: 400 })

  } catch (error) {
    console.error('[Inventory Counts API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar conteo'
    }, { status: 500 })
  }
}

// Roles que tienen permisos de administrador para eliminar conteos
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

/**
 * DELETE /api/market/pos/inventory-counts
 * Eliminar un conteo de inventario
 * SOLO ADMINISTRADORES pueden eliminar conteos
 */
export async function DELETE(request: NextRequest) {
  try {
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Verificar que el usuario sea administrador
    if (!ADMIN_ROLES.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Solo los administradores pueden eliminar conteos de inventario'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const countId = searchParams.get('countId')

    if (!countId) {
      return NextResponse.json({
        success: false,
        error: 'countId es requerido'
      }, { status: 400 })
    }

    // Verificar que el conteo existe y pertenece a la empresa
    const countResult = await db.query(`
      SELECT id, count_number, status FROM market_inventory_counts
      WHERE id = $1 AND company_id = $2
    `, [countId, payload.companyId])

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conteo no encontrado'
      }, { status: 404 })
    }

    const count = countResult.rows[0]

    // Eliminar líneas del conteo primero (foreign key)
    await db.query(`
      DELETE FROM market_inventory_count_lines WHERE count_id = $1
    `, [countId])

    // Eliminar el conteo
    await db.query(`
      DELETE FROM market_inventory_counts WHERE id = $1
    `, [countId])

    console.log(`[Inventory Counts] Conteo ${count.count_number} eliminado por usuario ${payload.userId} (${payload.role})`)

    return NextResponse.json({
      success: true,
      message: `Conteo ${count.count_number} eliminado exitosamente`,
      data: {
        countId: parseInt(countId),
        countNumber: count.count_number
      }
    })

  } catch (error) {
    console.error('[Inventory Counts DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar conteo'
    }, { status: 500 })
  }
}
