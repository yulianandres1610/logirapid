import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-private-documents'

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]

/**
 * POST /api/upload-tokens/[token]/upload
 * Public endpoint - Upload file using token authentication
 * No JWT required - the token itself is the auth
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 32) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 400 })
    }

    // Validate token
    const tokenResult = await db.query(`
      SELECT id, company_id, user_id, purpose, reference_type, reference_id, status, expires_at
      FROM upload_tokens
      WHERE token = $1
    `, [token])

    if (tokenResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Token no encontrado'
      }, { status: 404 })
    }

    const tokenData = tokenResult.rows[0]

    // Check status
    if (tokenData.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: tokenData.status === 'uploaded'
          ? 'Este token ya fue utilizado'
          : tokenData.status === 'expired'
            ? 'Este token ha expirado'
            : 'Token no valido'
      }, { status: 400 })
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      await db.query(`UPDATE upload_tokens SET status = 'expired' WHERE id = $1`, [tokenData.id])
      return NextResponse.json({
        success: false,
        error: 'Este token ha expirado. Genere uno nuevo desde el sistema.'
      }, { status: 400 })
    }

    // Verify Supabase config
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Almacenamiento no configurado'
      }, { status: 500 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No se proporciono archivo'
      }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de archivo no permitido. Solo se aceptan imagenes (JPG, PNG, WEBP) y PDF.'
      }, { status: 400 })
    }

    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'El archivo excede el limite de 10MB'
      }, { status: 400 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomSuffix = randomBytes(8).toString('hex')
    const fileName = `phone-upload-${timestamp}-${randomSuffix}.${fileExtension}`

    // Storage path
    const folderPath = tokenData.reference_id || 'general'
    const storagePath = `company-${tokenData.company_id}/invoices/${tokenData.purpose}/${folderPath}/${fileName}`

    // Convert to buffer and upload
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('[Upload Token] Supabase upload error:', uploadError)
      return NextResponse.json({
        success: false,
        error: 'Error al subir el archivo'
      }, { status: 500 })
    }

    // Update token with file info (including size and type)
    await db.query(`
      UPDATE upload_tokens
      SET status = 'uploaded',
          file_url = $1,
          file_name = $2,
          file_size = $3,
          file_type = $4,
          uploaded_at = NOW()
      WHERE id = $5
    `, [storagePath, file.name, file.size, file.type, tokenData.id])

    // If we have a reference_id, also save to order_invoices
    if (tokenData.reference_type && tokenData.reference_id) {
      try {
        const columnName = tokenData.reference_type === 'purchase'
          ? 'purchase_id'
          : tokenData.reference_type === 'consignment'
            ? 'consignment_order_id'
            : null

        if (columnName) {
          await db.query(`
            INSERT INTO order_invoices (${columnName}, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            tokenData.reference_id,
            fileName,
            file.name,
            storagePath,
            file.type,
            file.size,
            tokenData.company_id,
            tokenData.user_id
          ])
        }
      } catch (dbError) {
        console.error('[Upload Token] Error saving to order_invoices:', dbError)
        // File is already uploaded, don't fail
      }
    }

    console.log(`[Upload Token] File uploaded successfully:`, {
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      tokenId: tokenData.id
    })

    return NextResponse.json({
      success: true,
      message: 'Archivo subido exitosamente',
      data: {
        fileName: file.name,
        storagePath,
        fileSize: file.size,
        fileType: file.type
      }
    })

  } catch (error) {
    console.error('[Upload Token Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir archivo'
    }, { status: 500 })
  }
}
