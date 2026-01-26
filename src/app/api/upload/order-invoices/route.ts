import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents' // Private bucket
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/upload/order-invoices
 * Upload invoice/receipt files to Supabase Storage (private bucket)
 * Supports both temporary uploads (during wizard) and permanent uploads (with orderId)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ORDER INVOICES] Starting invoice upload...')

    // Auth check
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Verify Supabase config
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ORDER INVOICES] Supabase configuration missing')
      return NextResponse.json({
        success: false,
        error: 'El almacenamiento de archivos no esta configurado'
      }, { status: 500 })
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if this is a JSON request (for registering already-uploaded files from phone)
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // Handle JSON request - register existing files uploaded via phone
      const body = await request.json()
      const { orderType, orderId, existingFiles } = body

      if (!orderType || !['consignment', 'purchase'].includes(orderType)) {
        return NextResponse.json({
          success: false,
          error: 'orderType debe ser "consignment" o "purchase"'
        }, { status: 400 })
      }

      if (!orderId) {
        return NextResponse.json({
          success: false,
          error: 'orderId es requerido'
        }, { status: 400 })
      }

      if (!existingFiles || !Array.isArray(existingFiles) || existingFiles.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No se proporcionaron archivos existentes'
        }, { status: 400 })
      }

      console.log(`[ORDER INVOICES] Registering ${existingFiles.length} phone-uploaded file(s) for ${orderType} ${orderId}`)

      const registeredInvoices: any[] = []

      for (const file of existingFiles) {
        try {
          // First check if this file is already registered (to avoid duplicates)
          const columnName = orderType === 'consignment' ? 'consignment_order_id' : 'purchase_id'
          const existingCheck = await db.query(
            `SELECT id FROM order_invoices WHERE ${columnName} = $1 AND storage_path = $2`,
            [parseInt(orderId), file.storagePath]
          )

          if (existingCheck.rows.length > 0) {
            // Already registered, skip but include in response
            console.log(`[ORDER INVOICES] File already registered: ${file.storagePath}`)
            registeredInvoices.push({
              id: existingCheck.rows[0].id,
              fileName: file.storagePath.split('/').pop() || file.fileName,
              originalName: file.fileName,
              storagePath: file.storagePath,
              fileType: file.fileType,
              fileSize: file.fileSize,
              alreadyExists: true
            })
            continue
          }

          const insertQuery = orderType === 'consignment'
            ? `INSERT INTO order_invoices (consignment_order_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
            : `INSERT INTO order_invoices (purchase_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

          const fileName = file.storagePath.split('/').pop() || file.fileName

          const result = await db.query(insertQuery, [
            parseInt(orderId),
            fileName,
            file.fileName,
            file.storagePath,
            file.fileType || 'image/jpeg',
            file.fileSize || 0,
            payload.companyId,
            payload.userId
          ])

          registeredInvoices.push({
            id: result.rows[0].id,
            fileName: fileName,
            originalName: file.fileName,
            storagePath: file.storagePath,
            fileType: file.fileType,
            fileSize: file.fileSize
          })
        } catch (dbError) {
          console.error('[ORDER INVOICES] Error registering phone-uploaded file:', dbError)
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          invoices: registeredInvoices,
          registeredCount: registeredInvoices.length,
          totalCount: existingFiles.length,
          orderType,
          orderId: parseInt(orderId)
        },
        message: 'Archivos registrados exitosamente'
      })
    }

    // Handle FormData request - upload new files
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const orderType = formData.get('orderType') as 'consignment' | 'purchase'
    const orderId = formData.get('orderId') as string | null
    const tempId = formData.get('tempId') as string || randomBytes(16).toString('hex')

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se proporcionaron archivos'
      }, { status: 400 })
    }

    if (!orderType || !['consignment', 'purchase'].includes(orderType)) {
      return NextResponse.json({
        success: false,
        error: 'orderType debe ser "consignment" o "purchase"'
      }, { status: 400 })
    }

    console.log(`[ORDER INVOICES] Processing ${files.length} file(s) for ${orderType}`)

    const uploadedInvoices: any[] = []
    const errors: string[] = []

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      console.log(`[ORDER INVOICES] Processing file ${i + 1}/${files.length}:`, {
        name: file.name,
        type: file.type,
        size: file.size
      })

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no permitido (solo PDF e imagenes)`)
        continue
      }

      try {
        // Generate unique filename
        const fileExtension = file.name.split('.').pop() || 'pdf'
        const timestamp = Date.now()
        const randomSuffix = randomBytes(8).toString('hex')
        const fileName = `invoice-${timestamp}-${i}-${randomSuffix}.${fileExtension}`

        // Storage path: company-{companyId}/invoices/{orderType}/{orderId|tempId}/
        const folderPath = orderId || `temp-${tempId}`
        const storagePath = `company-${payload.companyId}/invoices/${orderType}/${folderPath}/${fileName}`

        console.log(`[ORDER INVOICES] Storage path:`, storagePath)

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

        // Upload to Supabase Storage (private)
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false
          })

        if (error) {
          console.error(`[ORDER INVOICES] Error uploading file ${i + 1}:`, error)
          errors.push(`${file.name}: ${error.message}`)
          continue
        }

        console.log(`[ORDER INVOICES] File ${i + 1} uploaded successfully`)

        // If we have an orderId, save to database immediately
        let invoiceId: number | null = null
        if (orderId) {
          try {
            const insertQuery = orderType === 'consignment'
              ? `INSERT INTO order_invoices (consignment_order_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
              : `INSERT INTO order_invoices (purchase_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

            const result = await db.query(insertQuery, [
              parseInt(orderId),
              fileName,
              file.name,
              storagePath,
              file.type,
              file.size,
              payload.companyId,
              payload.userId
            ])

            invoiceId = result.rows[0].id
          } catch (dbError) {
            console.error(`[ORDER INVOICES] Error saving to database:`, dbError)
            // File is already uploaded, continue
          }
        }

        uploadedInvoices.push({
          id: invoiceId,
          tempId: tempId,
          fileName: fileName,
          originalName: file.name,
          storagePath: storagePath,
          fileType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        })
      } catch (uploadError: any) {
        console.error(`[ORDER INVOICES] Error uploading file ${i + 1}:`, uploadError)
        errors.push(`${file.name}: ${uploadError.message || 'Error al subir'}`)
      }
    }

    // Return result
    const hasUploads = uploadedInvoices.length > 0
    const hasErrors = errors.length > 0

    if (!hasUploads && hasErrors) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo subir ningun archivo',
        errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        invoices: uploadedInvoices,
        tempId: tempId,
        uploadedCount: uploadedInvoices.length,
        totalCount: files.length,
        orderType,
        orderId: orderId ? parseInt(orderId) : null
      },
      message: hasErrors
        ? `${uploadedInvoices.length}/${files.length} archivos subidos`
        : 'Archivos subidos exitosamente',
      ...(hasErrors ? { errors } : {})
    })

  } catch (error: any) {
    console.error('[ORDER INVOICES] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 })
  }
}
