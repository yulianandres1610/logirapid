import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Configurar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents' // Bucket PRIVADO
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB para firmas

/**
 * POST /api/upload/delivery-signature
 * Sube una firma en formato base64 a Supabase Storage (bucket privado)
 * La firma se asocia a una orden específica
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📝 [DELIVERY SIGNATURE] Starting signature upload to Supabase Storage')

    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    // Verificar configuración de Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [DELIVERY SIGNATURE] Supabase configuration missing')
      return NextResponse.json(
        {
          success: false,
          error: 'El almacenamiento de archivos no está configurado. Contacte al administrador.'
        },
        { status: 500 }
      )
    }

    // Crear cliente Supabase con service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await request.json()
    const { signatureData, orderId, companyId: bodyCompanyId } = body
    const companyId = bodyCompanyId || headerCompanyId

    if (!signatureData) {
      return NextResponse.json({
        success: false,
        error: 'No se proporcionó la firma (signatureData)'
      }, { status: 400 })
    }

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID de la orden (orderId)'
      }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID de la empresa (companyId)'
      }, { status: 400 })
    }

    // Validar que la orden existe y pertenece a la empresa
    let orderQuery = 'SELECT id, ordernumber, company_id FROM package_orders WHERE id = $1'
    const orderParams: any[] = [parseInt(orderId)]

    if (!isSuperAdmin && headerCompanyId) {
      orderQuery += ' AND company_id = $2'
      orderParams.push(headerCompanyId)
    }

    const orderResult = await db.query(orderQuery, orderParams)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada o no tiene acceso'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    console.log(`📝 [DELIVERY SIGNATURE] Processing signature for order ${order.ordernumber}`)

    // Procesar la firma base64
    let base64Data = signatureData
    let contentType = 'image/png'

    // Si viene como data URL, extraer los datos
    if (signatureData.startsWith('data:')) {
      const matches = signatureData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        contentType = matches[1]
        base64Data = matches[2]
      }
    }

    // Convertir base64 a buffer
    const buffer = Buffer.from(base64Data, 'base64')

    // Validar tamaño
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'La firma es demasiado grande (máx 2MB)'
      }, { status: 400 })
    }

    // Generar nombre único
    const timestamp = Date.now()
    const randomSuffix = randomBytes(8).toString('hex')
    const extension = contentType === 'image/png' ? 'png' : 'jpg'
    const fileName = `signature-${timestamp}-${randomSuffix}.${extension}`
    // Path organizado: company-{id}/delivery-proofs/order-{orderId}/
    const storagePath = `company-${companyId}/delivery-proofs/order-${orderId}/${fileName}`

    console.log(`🔑 [DELIVERY SIGNATURE] Generated storage path:`, storagePath)

    // Subir a Supabase Storage PRIVADO
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true // Permitir reemplazar si ya existe
      })

    if (error) {
      console.error('❌ [DELIVERY SIGNATURE] Error uploading signature:', error)
      return NextResponse.json({
        success: false,
        error: `Error al subir la firma: ${error.message}`
      }, { status: 500 })
    }

    console.log('✅ [DELIVERY SIGNATURE] Signature uploaded successfully')

    // Actualizar o crear el delivery_proof con el path de la firma
    try {
      // Verificar si existe comprobante para esta orden
      const existingProof = await db.query(
        'SELECT id FROM delivery_proofs WHERE order_id = $1 AND company_id = $2',
        [parseInt(orderId), companyId]
      )

      if (existingProof.rows.length > 0) {
        // Actualizar firma existente
        await db.query(
          `UPDATE delivery_proofs SET
            signature_storage_path = $1,
            updated_at = NOW()
           WHERE id = $2`,
          [storagePath, existingProof.rows[0].id]
        )
        console.log('📝 [DELIVERY SIGNATURE] Updated existing proof with signature path')
      } else {
        // Crear nuevo registro de comprobante solo con firma
        const insertResult = await db.query(
          `INSERT INTO delivery_proofs (order_id, order_number, signature_storage_path, company_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [parseInt(orderId), order.ordernumber, storagePath, companyId]
        )

        // Actualizar orden con referencia al comprobante
        await db.query(
          `UPDATE package_orders SET delivery_proof_id = $1, proof_status = 'pending' WHERE id = $2`,
          [insertResult.rows[0].id, parseInt(orderId)]
        )

        console.log('📝 [DELIVERY SIGNATURE] Created new delivery proof with signature')
      }
    } catch (dbError: any) {
      console.error('❌ [DELIVERY SIGNATURE] Error updating database:', dbError)
      // La firma ya está subida, continuamos
    }

    return NextResponse.json({
      success: true,
      storagePath,
      orderId: parseInt(orderId),
      orderNumber: order.ordernumber,
      message: 'Firma subida exitosamente',
      info: 'La firma es privada. Usa /api/documents/[companyId]/[filename] para obtener URL temporal.'
    })

  } catch (error: any) {
    console.error('❌ [DELIVERY SIGNATURE] Error uploading signature:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor al subir la firma'
    }, { status: 500 })
  }
}
