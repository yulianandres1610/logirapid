import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createClient } from '@supabase/supabase-js'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const BUCKET_NAME = 'company-private-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * POST /api/broker/orders/[id]/upload-photos
 * Upload delivery proof photos
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verify order belongs to this broker
    const orderResult = await db.query(`
      SELECT id, order_number, broker_company_id, status
      FROM remittance_orders
      WHERE id = $1 AND broker_company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('photos') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere al menos una foto'
      }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({
        success: false,
        error: `Máximo ${MAX_FILES} fotos permitidas`
      }, { status: 400 })
    }

    const uploadedPhotos: any[] = []
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo no permitido (solo PNG, JPEG, WebP)`)
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Excede 10MB`)
        continue
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(2, 10)
        const extension = file.type.split('/')[1] || 'jpg'
        const storagePath = `company-${payload.companyId}/remittance-proofs/order-${orderId}/photo-${i}-${timestamp}-${randomSuffix}.${extension}`

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true
          })

        if (error) {
          console.error(`[Upload Photos] Error uploading ${file.name}:`, error)
          errors.push(`${file.name}: Error al subir`)
          continue
        }

        uploadedPhotos.push({
          originalName: file.name,
          storagePath,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        })
      } catch (err) {
        console.error(`[Upload Photos] Error processing ${file.name}:`, err)
        errors.push(`${file.name}: Error al procesar`)
      }
    }

    if (uploadedPhotos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo subir ninguna foto',
        errors
      }, { status: 400 })
    }

    // Update delivery proof with photos
    // First get existing photos
    const existingResult = await db.query(`
      SELECT photos FROM remittance_delivery_proofs
      WHERE remittance_order_id = $1
    `, [orderId])

    let existingPhotos: any[] = []
    if (existingResult.rows.length > 0 && existingResult.rows[0].photos) {
      existingPhotos = existingResult.rows[0].photos
    }

    // Combine existing and new photos
    const allPhotos = [...existingPhotos, ...uploadedPhotos]

    // Update or create delivery proof
    await db.query(`
      INSERT INTO remittance_delivery_proofs (
        remittance_order_id, order_number,
        photos, bill_denominations, total_delivered, delivery_currency,
        signer_name, company_id
      ) VALUES ($1, $2, $3, '{}', 0, 'CUP', 'Pendiente', $4)
      ON CONFLICT (remittance_order_id) DO UPDATE SET
        photos = $3
    `, [orderId, order.order_number, JSON.stringify(allPhotos), payload.companyId])

    console.log(`[Upload Photos] ${uploadedPhotos.length} photos uploaded for order ${orderId}`)

    return NextResponse.json({
      success: true,
      data: {
        photos: uploadedPhotos,
        totalPhotos: allPhotos.length,
        orderId,
        orderNumber: order.order_number
      },
      errors: errors.length > 0 ? errors : undefined,
      message: `${uploadedPhotos.length} foto(s) subida(s) exitosamente`
    })

  } catch (error) {
    console.error('[Upload Photos] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir fotos'
    }, { status: 500 })
  }
}
