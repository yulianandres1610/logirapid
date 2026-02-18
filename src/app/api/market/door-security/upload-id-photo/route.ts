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
 * POST /api/market/door-security/upload-id-photo
 * Upload or update a visitor's ID photo to S3
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
    const { visitorId, idNumber, photoBase64 } = body

    if (!photoBase64) {
      return NextResponse.json({
        success: false,
        error: 'Foto de ID requerida'
      }, { status: 400 })
    }

    if (!visitorId && !idNumber) {
      return NextResponse.json({
        success: false,
        error: 'ID de visitante o número de identificación requerido'
      }, { status: 400 })
    }

    // Check if storage is configured
    if (!storageAdapter.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Almacenamiento no configurado'
      }, { status: 500 })
    }

    // Find visitor
    let visitor
    if (visitorId) {
      const result = await db.query(`
        SELECT id, idnumber, idphotourl
        FROM market_visitors
        WHERE id = $1 AND companyid = $2
      `, [visitorId, payload.companyId])
      visitor = result.rows[0]
    } else {
      const result = await db.query(`
        SELECT id, idnumber, idphotourl
        FROM market_visitors
        WHERE idnumber = $1 AND companyid = $2
      `, [idNumber, payload.companyId])
      visitor = result.rows[0]
    }

    if (!visitor) {
      return NextResponse.json({
        success: false,
        error: 'Visitante no encontrado'
      }, { status: 404 })
    }

    // Clean base64 and convert to buffer
    const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')

    // Generate file path
    const timestamp = Date.now()
    const fileName = `visitor-documents/company-${payload.companyId}/${visitor.idnumber}-${timestamp}.jpg`

    // Upload to storage
    const uploadResult = await storageAdapter.upload(
      'company-private-documents',
      fileName,
      buffer,
      { contentType: 'image/jpeg', upsert: true }
    )

    if (!uploadResult.success) {
      console.error('[Upload ID Photo] Storage upload failed:', uploadResult.error)
      return NextResponse.json({
        success: false,
        error: 'Error al subir la foto'
      }, { status: 500 })
    }

    // Delete old photo if exists
    if (visitor.idphotourl && visitor.idphotourl !== fileName) {
      try {
        await storageAdapter.remove('company-private-documents', [visitor.idphotourl])
      } catch (err) {
        console.warn('[Upload ID Photo] Could not delete old photo:', err)
      }
    }

    // Update visitor with new photo URL
    await db.query(`
      UPDATE market_visitors
      SET idphotourl = $1, updatedat = NOW()
      WHERE id = $2
    `, [fileName, visitor.id])

    console.log('[Upload ID Photo] Photo uploaded successfully:', fileName)

    return NextResponse.json({
      success: true,
      data: {
        visitorId: visitor.id,
        photoPath: fileName,
        publicUrl: uploadResult.publicUrl
      }
    })

  } catch (error) {
    console.error('[Upload ID Photo] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir foto'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/door-security/upload-id-photo?visitorId=X
 * Get a signed URL for a visitor's ID photo
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
    const visitorId = searchParams.get('visitorId')

    if (!visitorId) {
      return NextResponse.json({
        success: false,
        error: 'ID de visitante requerido'
      }, { status: 400 })
    }

    // Get visitor with photo
    const result = await db.query(`
      SELECT id, fullname, idphotourl
      FROM market_visitors
      WHERE id = $1 AND companyid = $2
    `, [visitorId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Visitante no encontrado'
      }, { status: 404 })
    }

    const visitor = result.rows[0]

    if (!visitor.idphotourl) {
      return NextResponse.json({
        success: false,
        error: 'El visitante no tiene foto de ID'
      }, { status: 404 })
    }

    // Generate signed URL (valid for 1 hour)
    try {
      const signedUrl = await storageAdapter.createSignedUrl(
        'company-private-documents',
        visitor.idphotourl,
        3600 // 1 hour
      )

      return NextResponse.json({
        success: true,
        data: {
          visitorId: visitor.id,
          visitorName: visitor.fullname,
          signedUrl,
          expiresIn: 3600
        }
      })
    } catch (err) {
      console.error('[Upload ID Photo] Could not create signed URL:', err)
      return NextResponse.json({
        success: false,
        error: 'Error al generar URL de acceso'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Upload ID Photo] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener foto'
    }, { status: 500 })
  }
}
