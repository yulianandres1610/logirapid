import { NextRequest, NextResponse } from 'next/server'
import * as storageAdapter from '@/lib/storage-adapter'
import { randomBytes } from 'crypto'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

const BUCKET_NAME = 'company-private-documents' // Bucket PRIVADO
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB por foto
const MAX_PHOTOS = 5 // Máximo 5 fotos por orden
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]

/**
 * POST /api/upload/delivery-photos
 * Sube fotos de comprobante de entrega a Supabase Storage (bucket privado)
 * Las fotos se asocian a una orden específica
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [DELIVERY PHOTOS] Starting delivery photos upload to Supabase Storage')

    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    // Verificar configuración de almacenamiento
    if (!storageAdapter.isConfigured()) {
      console.error('❌ [DELIVERY PHOTOS] Storage configuration missing')
      return NextResponse.json(
        {
          success: false,
          error: 'El almacenamiento de archivos no está configurado. Contacte al administrador.'
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('photos') as File[]
    const orderId = formData.get('orderId') as string
    const companyId = formData.get('companyId') as string || headerCompanyId

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se proporcionaron fotos'
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

    console.log(`📸 [DELIVERY PHOTOS] Received ${files.length} photo(s) for order ${order.ordernumber}`)

    // Validar máximo de fotos
    if (files.length > MAX_PHOTOS) {
      return NextResponse.json({
        success: false,
        error: `Máximo ${MAX_PHOTOS} fotos permitidas por orden`
      }, { status: 400 })
    }

    const uploadedPhotos: any[] = []
    const errors: string[] = []

    // Procesar cada foto
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      console.log(`📸 [DELIVERY PHOTOS] Processing photo ${i + 1}/${files.length}:`, {
        name: file.name,
        type: file.type,
        size: file.size
      })

      // Validar tipo de archivo
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no permitido (solo imágenes)`)
        continue
      }

      // Validar tamaño
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Imagen demasiado grande (máx 10MB)`)
        continue
      }

      try {
        // Generar nombre único
        const fileExtension = file.name.split('.').pop() || 'jpg'
        const timestamp = Date.now()
        const randomSuffix = randomBytes(8).toString('hex')
        const fileName = `photo-${timestamp}-${i}-${randomSuffix}.${fileExtension}`
        // Path organizado: company-{id}/delivery-proofs/order-{orderId}/
        const storagePath = `company-${companyId}/delivery-proofs/order-${orderId}/${fileName}`

        console.log(`🔑 [DELIVERY PHOTOS] Generated storage path:`, storagePath)

        // Convertir File a ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

        // Subir a Storage PRIVADO
        const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, Buffer.from(arrayBuffer), {
          contentType: file.type,
          upsert: false
        })

        if (!uploadResult.success) {
          console.error(`❌ [DELIVERY PHOTOS] Error uploading photo ${i + 1}:`, uploadResult.error)
          errors.push(`${file.name}: ${uploadResult.error}`)
          continue
        }

        console.log(`✅ [DELIVERY PHOTOS] Photo ${i + 1} uploaded successfully`)

        uploadedPhotos.push({
          originalName: file.name,
          storagePath: storagePath,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        })
      } catch (uploadError: any) {
        console.error(`❌ [DELIVERY PHOTOS] Error uploading photo ${i + 1}:`, uploadError)
        errors.push(`${file.name}: ${uploadError.message || 'Error al subir'}`)
      }
    }

    // Si hay fotos subidas, actualizar delivery_proofs
    if (uploadedPhotos.length > 0) {
      try {
        // Verificar si existe comprobante para esta orden
        const existingProof = await db.query(
          'SELECT id, photos FROM delivery_proofs WHERE order_id = $1 AND company_id = $2',
          [parseInt(orderId), companyId]
        )

        if (existingProof.rows.length > 0) {
          // Actualizar fotos existentes
          let existingPhotos = existingProof.rows[0].photos
          if (typeof existingPhotos === 'string') {
            try {
              existingPhotos = JSON.parse(existingPhotos)
            } catch (e) {
              existingPhotos = []
            }
          }
          existingPhotos = existingPhotos || []

          const allPhotos = [...existingPhotos, ...uploadedPhotos]

          await db.query(
            'UPDATE delivery_proofs SET photos = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(allPhotos), existingProof.rows[0].id]
          )

          console.log(`📸 [DELIVERY PHOTOS] Updated existing proof with ${uploadedPhotos.length} new photos`)
        } else {
          // Crear nuevo registro de comprobante solo con fotos
          const insertResult = await db.query(
            `INSERT INTO delivery_proofs (order_id, order_number, photos, company_id)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [parseInt(orderId), order.ordernumber, JSON.stringify(uploadedPhotos), companyId]
          )

          // Actualizar orden con referencia al comprobante
          await db.query(
            `UPDATE package_orders SET delivery_proof_id = $1, proof_status = 'pending' WHERE id = $2`,
            [insertResult.rows[0].id, parseInt(orderId)]
          )

          console.log(`📸 [DELIVERY PHOTOS] Created new delivery proof with ${uploadedPhotos.length} photos`)
        }
      } catch (dbError: any) {
        console.error('❌ [DELIVERY PHOTOS] Error updating database:', dbError)
        // Las fotos ya están subidas, continuamos
      }
    }

    // Retornar resultado
    const hasUploads = uploadedPhotos.length > 0
    const hasErrors = errors.length > 0

    if (!hasUploads && hasErrors) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo subir ninguna foto',
        errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      photos: uploadedPhotos,
      uploadedCount: uploadedPhotos.length,
      totalCount: files.length,
      orderId: parseInt(orderId),
      orderNumber: order.ordernumber,
      message: hasErrors
        ? `${uploadedPhotos.length}/${files.length} fotos subidas exitosamente`
        : 'Todas las fotos subidas exitosamente',
      info: 'Las fotos son privadas. Usa /api/documents/[companyId]/[filename] para obtener URLs temporales.',
      ...(hasErrors ? { errors } : {})
    })

  } catch (error: any) {
    console.error('❌ [DELIVERY PHOTOS] Error uploading photos:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor al subir fotos'
    }, { status: 500 })
  }
}
