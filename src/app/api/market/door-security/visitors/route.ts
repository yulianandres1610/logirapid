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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const idNumber = searchParams.get('idNumber')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE v.companyid = $1'
    const params: any[] = [payload.companyId]
    let paramIndex = 2

    // If searching by exact ID number (for entry/exit lookup)
    if (idNumber) {
      whereClause += ` AND v.idnumber = $${paramIndex}`
      params.push(idNumber)
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
    const {
      fullName,
      idType,
      idNumber,
      dateOfBirth,
      address,
      nationality,
      gender,
      idPhotoBase64
    } = body

    if (!fullName || !idNumber) {
      return NextResponse.json({
        success: false,
        error: 'Nombre completo y número de identificación son requeridos'
      }, { status: 400 })
    }

    // Check if visitor already exists
    const existingResult = await db.query(`
      SELECT id, totalvisits FROM market_visitors
      WHERE companyid = $1 AND idnumber = $2
    `, [payload.companyId, idNumber])

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

      // Upload ID photo if provided
      let idPhotoUrl = null
      if (idPhotoBase64 && storageAdapter.isConfigured()) {
        try {
          const cleanBase64 = idPhotoBase64.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(cleanBase64, 'base64')
          const fileName = `visitor-documents/${payload.companyId}/${idNumber}-${Date.now()}.jpg`

          const { data, error } = await storageAdapter.upload(
            'company-private-documents',
            fileName,
            buffer,
            { contentType: 'image/jpeg', upsert: true }
          )

          if (!error && data) {
            idPhotoUrl = fileName
          }
        } catch (uploadError) {
          console.error('[Visitors POST] Photo upload error:', uploadError)
          // Continue without photo
        }
      }

      const result = await db.query(`
        INSERT INTO market_visitors (
          companyid, fullname, idtype, idnumber, dateofbirth,
          address, nationality, gender, idphotourl,
          firstvisit, lastvisit, totalvisits
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), 1)
        RETURNING id
      `, [
        payload.companyId,
        fullName,
        idType || null,
        idNumber,
        dateOfBirth || null,
        address || null,
        nationality || null,
        gender || null,
        idPhotoUrl
      ])

      visitorId = result.rows[0].id
      console.log('[Visitors POST] Created new visitor:', visitorId)
    }

    // Fetch the visitor data
    const visitorResult = await db.query(`
      SELECT
        id, fullname, idtype, idnumber, dateofbirth,
        address, nationality, gender, idphotourl,
        firstvisit, lastvisit, totalvisits
      FROM market_visitors WHERE id = $1
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
          totalVisits: visitor.totalvisits
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
