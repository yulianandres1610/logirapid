import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number; companyName: string }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload
  } catch { return null }
}

/**
 * POST /api/market/production/paint/orders/[id]/steps/[stepId]
 * Actions: start, pause, resume, complete, reject, reprocess
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  const { id, stepId } = await params
  const orderId = parseInt(id)
  const stepIdNum = parseInt(stepId)
  const body = await request.json()
  const { action, notes, qualityCheck, temperature, humidity } = body

  try {
    // Verify step belongs to order and company
    const stepResult = await db.query(`
      SELECT ps.*, po.company_id, po.status as order_status
      FROM paint_production_steps ps
      JOIN paint_production_orders po ON po.id = ps.paint_order_id
      WHERE ps.id = $1 AND ps.paint_order_id = $2 AND po.company_id = $3
    `, [stepIdNum, orderId, payload.companyId])

    if (stepResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paso no encontrado' }, { status: 404 })
    }

    const step = stepResult.rows[0]

    switch (action) {
      case 'issue-materials': {
        if (step.status !== 'pending') {
          return NextResponse.json({ success: false, error: 'Los materiales solo se pueden entregar cuando el paso está pendiente' }, { status: 400 })
        }

        // Mark all materials as issued
        await db.query(`
          UPDATE paint_production_step_materials
          SET status = 'issued', quantity_issued = quantity_required, issued_at = NOW(), issued_by = $1
          WHERE step_id = $2
        `, [payload.userId, stepIdNum])

        await db.query(`
          UPDATE paint_production_steps SET status = 'materials_issued' WHERE id = $1
        `, [stepIdNum])

        // Log
        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'materials_issued', $2, $3)
        `, [stepIdNum, JSON.stringify({ issuedBy: payload.email }), payload.userId])

        // Update order status if needed
        await db.query(`
          UPDATE paint_production_orders SET status = 'in_progress', updated_at = NOW()
          WHERE id = $1 AND status IN ('draft', 'planned')
        `, [orderId])

        return NextResponse.json({ success: true, message: 'Materiales entregados' })
      }

      case 'start': {
        if (!['pending', 'materials_issued'].includes(step.status)) {
          return NextResponse.json({ success: false, error: 'El paso debe estar pendiente o con materiales entregados para iniciar' }, { status: 400 })
        }

        await db.query(`
          UPDATE paint_production_steps
          SET status = 'in_progress', started_at = NOW(), started_by = $1
          WHERE id = $2
        `, [payload.userId, stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'started', $2, $3)
        `, [stepIdNum, JSON.stringify({ startedBy: payload.email }), payload.userId])

        await db.query(`
          UPDATE paint_production_orders SET status = 'in_progress', updated_at = NOW()
          WHERE id = $1 AND status IN ('draft', 'planned')
        `, [orderId])

        return NextResponse.json({ success: true, message: 'Paso iniciado' })
      }

      case 'pause': {
        if (step.status !== 'in_progress') {
          return NextResponse.json({ success: false, error: 'Solo se puede pausar un paso en progreso' }, { status: 400 })
        }

        await db.query(`
          UPDATE paint_production_steps SET paused_at = NOW(), status = 'paused' WHERE id = $1
        `, [stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'paused', $2, $3)
        `, [stepIdNum, JSON.stringify({ reason: notes || 'Pausa manual' }), payload.userId])

        return NextResponse.json({ success: true, message: 'Paso pausado' })
      }

      case 'resume': {
        if (!step.paused_at || step.status !== 'paused') {
          return NextResponse.json({ success: false, error: 'El paso no está pausado' }, { status: 400 })
        }

        // Calculate pause duration
        const pausedAt = new Date(step.paused_at)
        const pauseMinutes = Math.round((Date.now() - pausedAt.getTime()) / 60000)
        const totalPause = (parseInt(step.total_pause_minutes) || 0) + pauseMinutes

        await db.query(`
          UPDATE paint_production_steps SET paused_at = NULL, total_pause_minutes = $1, status = 'in_progress' WHERE id = $2
        `, [totalPause, stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'resumed', $2, $3)
        `, [stepIdNum, JSON.stringify({ pauseDurationMinutes: pauseMinutes, totalPauseMinutes: totalPause }), payload.userId])

        return NextResponse.json({ success: true, message: 'Paso reanudado' })
      }

      case 'complete': {
        if (step.status !== 'in_progress' && step.status !== 'paused') {
          return NextResponse.json({ success: false, error: 'Solo se puede completar un paso en progreso o pausado' }, { status: 400 })
        }

        // Calculate actual time
        const startedAt = new Date(step.started_at)
        let actualMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000)

        // Subtract pause time
        const totalPauseMin = parseInt(step.total_pause_minutes) || 0
        if (step.paused_at) {
          const currentPause = Math.round((Date.now() - new Date(step.paused_at).getTime()) / 60000)
          actualMinutes -= (totalPauseMin + currentPause)
        } else {
          actualMinutes -= totalPauseMin
        }

        actualMinutes = Math.max(1, actualMinutes)

        await db.query(`
          UPDATE paint_production_steps
          SET status = 'completed', completed_at = NOW(), completed_by = $1,
              actual_time_minutes = $2, paused_at = NULL,
              operator_notes = COALESCE($3, operator_notes),
              quality_check = COALESCE($4, quality_check),
              temperature = COALESCE($5, temperature),
              humidity = COALESCE($6, humidity)
          WHERE id = $7
        `, [payload.userId, actualMinutes, notes || null, qualityCheck || null, temperature || null, humidity || null, stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'completed', $2, $3)
        `, [stepIdNum, JSON.stringify({ actualTimeMinutes: actualMinutes, qualityCheck, notes }), payload.userId])

        // Check if all steps are completed
        const remaining = await db.query(`
          SELECT COUNT(*) as c FROM paint_production_steps
          WHERE paint_order_id = $1 AND status != 'completed'
        `, [orderId])

        if (parseInt(remaining.rows[0].c) === 0) {
          await db.query(`
            UPDATE paint_production_orders SET status = 'completed', completed_at = NOW(), completed_by = $1, updated_at = NOW()
            WHERE id = $2
          `, [payload.userId, orderId])
        }

        return NextResponse.json({ success: true, message: 'Paso completado', data: { actualTimeMinutes: actualMinutes } })
      }

      case 'reject': {
        if (step.status === 'completed') {
          return NextResponse.json({ success: false, error: 'No se puede rechazar un paso ya completado' }, { status: 400 })
        }
        await db.query(`
          UPDATE paint_production_steps SET quality_check = 'rejected', operator_notes = COALESCE(operator_notes || E'\n', '') || $1 WHERE id = $2
        `, [notes || 'Rechazado por control de calidad', stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'quality_rejected', $2, $3)
        `, [stepIdNum, JSON.stringify({ reason: notes }), payload.userId])

        return NextResponse.json({ success: true, message: 'Paso rechazado por calidad' })
      }

      case 'add-note': {
        if (!notes || !notes.trim()) {
          return NextResponse.json({ success: false, error: 'Nota requerida' }, { status: 400 })
        }
        await db.query(`
          UPDATE paint_production_steps
          SET operator_notes = CASE WHEN operator_notes IS NULL THEN $1 ELSE operator_notes || E'\n' || $1 END
          WHERE id = $2
        `, [notes.trim(), stepIdNum])

        await db.query(`
          INSERT INTO paint_production_step_log (step_id, action, details, performed_by)
          VALUES ($1, 'note_added', $2, $3)
        `, [stepIdNum, JSON.stringify({ note: notes }), payload.userId])

        return NextResponse.json({ success: true, message: 'Nota agregada' })
      }

      default:
        return NextResponse.json({ success: false, error: `Acción '${action}' no válida` }, { status: 400 })
    }
  } catch (error) {
    console.error('[Paint Step Action] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al ejecutar acción' }, { status: 500 })
  }
}
