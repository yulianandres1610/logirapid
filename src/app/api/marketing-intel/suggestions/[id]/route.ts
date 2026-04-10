import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

/**
 * PATCH /api/marketing-intel/suggestions/[id]
 * Approve or reject a suggestion
 * Body: { status: 'approved' | 'rejected', applyToProducts?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const suggestionId = parseInt(id)
    const body = await request.json()
    const { status, applyToProducts } = body

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Status debe ser approved o rejected' }, { status: 400 })
    }

    const result = await db.query(`
      UPDATE mi_suggestions SET
        status = $1, reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $3 AND company_id = $4
      RETURNING *
    `, [status, payload.userId, suggestionId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Sugerencia no encontrada' }, { status: 404 })
    }

    const suggestion = result.rows[0]

    // If approved and applyToProducts = true, update product prices
    if (status === 'approved' && applyToProducts) {
      const products = suggestion.products || []
      let updated = 0
      for (const p of products) {
        if (p.productId && p.suggestedPrice) {
          await db.query(
            'UPDATE market_products SET selling_price = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
            [p.suggestedPrice, p.productId, payload.companyId]
          )
          updated++
        }
      }
      return NextResponse.json({
        success: true,
        message: `Sugerencia aprobada. ${updated} producto(s) actualizados.`,
        data: { productsUpdated: updated }
      })
    }

    return NextResponse.json({
      success: true,
      message: status === 'approved' ? 'Sugerencia aprobada' : 'Sugerencia rechazada'
    })
  } catch (error) {
    console.error('[MI Suggestions PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar sugerencia' }, { status: 500 })
  }
}
