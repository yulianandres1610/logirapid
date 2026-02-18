import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import * as storageAdapter from '@/lib/storage-adapter'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/door-security/visitors/[id]
 * Get a specific visitor's details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Ensure idphotoreverseurl column exists (auto-migration)
    try {
      await db.query(`
        ALTER TABLE market_visitors
        ADD COLUMN IF NOT EXISTS idphotoreverseurl TEXT
      `)
    } catch {
      // Column might already exist or DB doesn't support IF NOT EXISTS
    }

    // Check if ID is the visitor ID or ID number
    let whereClause = 'WHERE v.companyid = $1 AND '
    if (/^\d+$/.test(id)) {
      whereClause += 'v.id = $2'
    } else {
      whereClause += 'v.idnumber = $2'
    }

    const result = await db.query(`
      SELECT
        v.id,
        v.companyid,
        v.fullname,
        v.idtype,
        v.idnumber,
        v.dateofbirth,
        v.address,
        v.nationality,
        v.gender,
        v.idphotourl,
        v.idphotoreverseurl,
        v.firstvisit,
        v.lastvisit,
        v.totalvisits,
        v.createdat
      FROM market_visitors v
      ${whereClause}
    `, [payload.companyId, id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Visitante no encontrado'
      }, { status: 404 })
    }

    const visitor = result.rows[0]

    // Check for active visit
    const activeLogResult = await db.query(`
      SELECT
        vl.id,
        vl.entrytime,
        vl.visitpurpose,
        vl.visitnotes,
        vl.haspendinginvoices,
        k.name as kioskname
      FROM market_visitor_logs vl
      LEFT JOIN market_door_kiosks k ON vl.kioskid = k.id
      WHERE vl.visitorid = $1 AND vl.status = 'active'
      ORDER BY vl.entrytime DESC
      LIMIT 1
    `, [visitor.id])

    const activeLog = activeLogResult.rows[0] || null

    // Get recent visit history
    const historyResult = await db.query(`
      SELECT
        vl.id,
        vl.entrytime,
        vl.exittime,
        vl.visitpurpose,
        vl.visitnotes,
        vl.status,
        k.name as kioskname
      FROM market_visitor_logs vl
      LEFT JOIN market_door_kiosks k ON vl.kioskid = k.id
      WHERE vl.visitorid = $1
      ORDER BY vl.entrytime DESC
      LIMIT 20
    `, [visitor.id])

    // Generate signed URLs for ID photos if admin requesting
    let idPhotoSignedUrl = null
    let idPhotoReverseSignedUrl = null

    if (['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role) && storageAdapter.isConfigured()) {
      // Front photo
      if (visitor.idphotourl) {
        try {
          idPhotoSignedUrl = await storageAdapter.createSignedUrl(
            'company-private-documents',
            visitor.idphotourl,
            3600 // 1 hour expiry
          )
        } catch (e) {
          console.error('[Visitor GET] Error getting signed URL for front:', e)
        }
      }

      // Reverse photo (for Cuban cedula)
      if (visitor.idphotoreverseurl) {
        try {
          idPhotoReverseSignedUrl = await storageAdapter.createSignedUrl(
            'company-private-documents',
            visitor.idphotoreverseurl,
            3600
          )
        } catch (e) {
          console.error('[Visitor GET] Error getting signed URL for reverse:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        visitor: {
          id: visitor.id,
          fullName: visitor.fullname,
          idType: visitor.idtype,
          idNumber: visitor.idnumber,
          dateOfBirth: visitor.dateofbirth,
          address: visitor.address,
          nationality: visitor.nationality,
          gender: visitor.gender,
          idPhotoUrl: idPhotoSignedUrl,
          idPhotoReverseUrl: idPhotoReverseSignedUrl,
          firstVisit: visitor.firstvisit,
          lastVisit: visitor.lastvisit,
          totalVisits: visitor.totalvisits,
          createdAt: visitor.createdat
        },
        isCurrentlyInside: !!activeLog,
        activeLog: activeLog ? {
          id: activeLog.id,
          entryTime: activeLog.entrytime,
          visitPurpose: activeLog.visitpurpose,
          notes: activeLog.visitnotes,
          hasPendingInvoices: activeLog.haspendinginvoices,
          kioskName: activeLog.kioskname
        } : null,
        recentHistory: historyResult.rows.map(h => ({
          id: h.id,
          entryTime: h.entrytime,
          exitTime: h.exittime,
          visitPurpose: h.visitpurpose,
          notes: h.visitnotes,
          status: h.status,
          kioskName: h.kioskname
        }))
      }
    })

  } catch (error) {
    console.error('[Visitor GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener visitante'
    }, { status: 500 })
  }
}
