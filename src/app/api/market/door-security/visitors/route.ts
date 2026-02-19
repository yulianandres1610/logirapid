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
 * GET /api/market/door-security/visitors
 * Search and list visitors
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    const { searchParams } = new URL(request.url)
    const kioskId = searchParams.get('kioskId')
    const guardId = searchParams.get('guardId')

    let companyId: number | null = null
    let isAuthenticated = false

    // Try JWT authentication first
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const payload = jwt.verify(authToken, secret) as JWTPayload
        companyId = payload.companyId
        isAuthenticated = true
      } catch {
        // JWT invalid, will try kiosk auth
      }
    }

    // Try kiosk authentication if JWT failed
    if (!isAuthenticated && kioskId && guardId) {
      const kioskResult = await db.query(
        'SELECT companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
        [kioskId]
      )
      if (kioskResult.rows.length > 0) {
        const guardResult = await db.query(
          'SELECT id FROM market_door_guards WHERE id = $1 AND isactive = true',
          [guardId]
        )
        if (guardResult.rows.length > 0) {
          companyId = kioskResult.rows[0].companyid
          isAuthenticated = true
        }
      }
    }

    if (!isAuthenticated || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const idNumber = searchParams.get('idNumber')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE v.companyid = $1'
    const params: any[] = [companyId]
    let paramIndex = 2

    // If searching by exact ID number (for entry/exit lookup)
    if (idNumber) {
      // Normalize ID for comparison
      const normalizedId = idNumber.toString().trim().replace(/[\s-]/g, '')
      whereClause += ` AND REPLACE(REPLACE(TRIM(v.idnumber), ' ', ''), '-', '') = $${paramIndex}`
      params.push(normalizedId)
      paramIndex++
    } else if (search) {
      whereClause += ` AND (v.fullname ILIKE $${paramIndex} OR v.idnumber ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_visitors v
      ${whereClause}
    `, params)

    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get visitors
    const result = await db.query(`
      SELECT
        v.id,
        v.fullname,
        v.idtype,
        v.idnumber,
        v.dateofbirth,
        v.address,
        v.nationality,
        v.gender,
        v.idphotourl,
        v.firstvisit,
        v.lastvisit,
        v.totalvisits,
        v.createdat,
        (
          SELECT vl.id
          FROM market_visitor_logs vl
          WHERE vl.visitorid = v.id AND vl.status = 'active'
          ORDER BY vl.entrytime DESC
          LIMIT 1
        ) as activelogid
      FROM market_visitors v
      ${whereClause}
      ORDER BY v.lastvisit DESC NULLS LAST, v.createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    return NextResponse.json({
      success: true,
      data: {
        visitors: result.rows.map(v => ({
          id: v.id,
          fullName: v.fullname,
          idType: v.idtype,
          idNumber: v.idnumber,
          dateOfBirth: v.dateofbirth,
          address: v.address,
          nationality: v.nationality,
          gender: v.gender,
          idPhotoUrl: v.idphotourl,
          firstVisit: v.firstvisit,
          lastVisit: v.lastvisit,
          totalVisits: v.totalvisits,
          createdAt: v.createdat,
          isCurrentlyInside: !!v.activelogid,
          activeLogId: v.activelogid
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
    console.error('[Visitors GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener visitantes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/door-security/visitors
 * Register a new visitor or update existing one
 * Supports both JWT authentication and kiosk authentication (kioskId + guardId)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    const body = await request.json()
    const {
      fullName,
      idType,
      idNumber,
      dateOfBirth,
      address,
      nationality,
      gender,
      idPhotoBase64,
      idPhotoReverseBase64,
      kioskId,
      guardId
    } = body

    let companyId: number | null = null
    let isAuthenticated = false

    // Try JWT authentication first
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const payload = jwt.verify(authToken, secret) as JWTPayload
        companyId = payload.companyId
        isAuthenticated = true
      } catch {
        // JWT failed, will try kiosk auth
      }
    }

    // Try kiosk authentication if JWT failed
    if (!isAuthenticated && kioskId && guardId) {
      const kioskResult = await db.query(
        'SELECT companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
        [kioskId]
      )
      if (kioskResult.rows.length > 0) {
        // Verify guard exists and is active
        const guardResult = await db.query(
          'SELECT id FROM market_door_guards WHERE id = $1 AND isactive = true',
          [guardId]
        )
        if (guardResult.rows.length > 0) {
          companyId = kioskResult.rows[0].companyid
          isAuthenticated = true
        }
      }
    }

    if (!isAuthenticated || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
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

    if (!fullName || !idNumber) {
      return NextResponse.json({
        success: false,
        error: 'Nombre completo y número de identificación son requeridos'
      }, { status: 400 })
    }

    // Normalize ID number - trim whitespace, remove special characters for comparison
    const normalizedIdNumber = idNumber.toString().trim().replace(/[\s-]/g, '')

    // Check if visitor already exists (case-insensitive idNumber match)
    const existingResult = await db.query(`
      SELECT id, totalvisits FROM market_visitors
      WHERE companyid = $1 AND REPLACE(REPLACE(TRIM(idnumber), ' ', ''), '-', '') = $2
    `, [companyId, normalizedIdNumber])

    let visitorId: number
    let isNewVisitor = false

    if (existingResult.rows.length > 0) {
      // Update existing visitor
      visitorId = existingResult.rows[0].id
      const newTotalVisits = existingResult.rows[0].totalvisits + 1

      await db.query(`
        UPDATE market_visitors
        SET
          fullname = COALESCE($1, fullname),
          idtype = COALESCE($2, idtype),
          dateofbirth = COALESCE($3, dateofbirth),
          address = COALESCE($4, address),
          nationality = COALESCE($5, nationality),
          gender = COALESCE($6, gender),
          lastvisit = NOW(),
          totalvisits = $7,
          updatedat = NOW()
        WHERE id = $8
      `, [
        fullName,
        idType || null,
        dateOfBirth || null,
        address || null,
        nationality || null,
        gender || null,
        newTotalVisits,
        visitorId
      ])

      console.log('[Visitors POST] Updated existing visitor:', visitorId)
    } else {
      // Create new visitor
      isNewVisitor = true

      // Upload ID photos if provided
      let idPhotoUrl = null
      let idPhotoReverseUrl = null
      const timestamp = Date.now()

      if (storageAdapter.isConfigured()) {
        // Upload front photo
        if (idPhotoBase64) {
          try {
            const cleanBase64 = idPhotoBase64.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(cleanBase64, 'base64')
            const fileName = `visitor-documents/${companyId}/${idNumber}-front-${timestamp}.jpg`

            const uploadResult = await storageAdapter.upload(
              'company-private-documents',
              fileName,
              buffer,
              { contentType: 'image/jpeg', upsert: true }
            )

            if (uploadResult.success) {
              idPhotoUrl = fileName
            }
          } catch (uploadError) {
            console.error('[Visitors POST] Front photo upload error:', uploadError)
          }
        }

        // Upload reverse photo (for Cuban cedula)
        if (idPhotoReverseBase64) {
          try {
            const cleanBase64 = idPhotoReverseBase64.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(cleanBase64, 'base64')
            const fileName = `visitor-documents/${companyId}/${idNumber}-reverse-${timestamp}.jpg`

            const uploadResult = await storageAdapter.upload(
              'company-private-documents',
              fileName,
              buffer,
              { contentType: 'image/jpeg', upsert: true }
            )

            if (uploadResult.success) {
              idPhotoReverseUrl = fileName
            }
          } catch (uploadError) {
            console.error('[Visitors POST] Reverse photo upload error:', uploadError)
          }
        }
      }

      const result = await db.query(`
        INSERT INTO market_visitors (
          companyid, fullname, idtype, idnumber, dateofbirth,
          address, nationality, gender, idphotourl, idphotoreverseurl,
          firstvisit, lastvisit, totalvisits
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), 1)
        RETURNING id
      `, [
        companyId,
        fullName,
        idType || null,
        normalizedIdNumber, // Use normalized ID for consistency
        dateOfBirth || null,
        address || null,
        nationality || null,
        gender || null,
        idPhotoUrl,
        idPhotoReverseUrl
      ])

      visitorId = result.rows[0].id
      console.log('[Visitors POST] Created new visitor:', visitorId)
    }

    // Fetch the visitor data with current status
    const visitorResult = await db.query(`
      SELECT
        v.id,
        v.fullname,
        v.idtype,
        v.idnumber,
        v.dateofbirth,
        v.address,
        v.nationality,
        v.gender,
        v.idphotourl,
        v.firstvisit,
        v.lastvisit,
        v.totalvisits,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM market_visitor_logs
            WHERE visitorid = v.id AND status = 'active'
          ) THEN true
          ELSE false
        END as iscurrentlyinside,
        (
          SELECT id FROM market_visitor_logs
          WHERE visitorid = v.id AND status = 'active'
          ORDER BY entrytime DESC
          LIMIT 1
        ) as activelogid
      FROM market_visitors v
      WHERE v.id = $1
    `, [visitorId])

    const visitor = visitorResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        isNewVisitor,
        visitor: {
          id: visitor.id,
          fullName: visitor.fullname,
          idType: visitor.idtype,
          idNumber: visitor.idnumber,
          dateOfBirth: visitor.dateofbirth,
          address: visitor.address,
          nationality: visitor.nationality,
          gender: visitor.gender,
          idPhotoUrl: visitor.idphotourl,
          firstVisit: visitor.firstvisit,
          lastVisit: visitor.lastvisit,
          totalVisits: visitor.totalvisits,
          isCurrentlyInside: visitor.iscurrentlyinside,
          activeLogId: visitor.activelogid
        }
      }
    })

  } catch (error) {
    console.error('[Visitors POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar visitante'
    }, { status: 500 })
  }
}
