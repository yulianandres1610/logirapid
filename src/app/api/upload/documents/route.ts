import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Configurar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents' // Bucket PRIVADO para documentos confidenciales
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB - Suficiente para PDFs escaneados de alta calidad
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]

/**
 * POST /api/upload/documents
 * Sube documentos PRIVADOS de empresa a Supabase Storage
 * Los archivos se almacenan en bucket privado y requieren URLs firmadas para acceso
 * Soporta múltiples archivos en una sola petición
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [DOCUMENTS UPLOAD] Starting PRIVATE documents upload to Supabase Storage')

    // Verificar configuración de Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [DOCUMENTS UPLOAD] Supabase configuration missing')
      return NextResponse.json(
        {
          success: false,
          error: 'El almacenamiento de archivos no está configurado. Contacte al administrador.'
        },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Crear cliente Supabase con service role key para bypassing RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const formData = await request.formData()
    const files = formData.getAll('documents') as File[]
    const companyId = formData.get('companyId') as string

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se proporcionaron archivos'
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID de la empresa (companyId)'
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📄 [DOCUMENTS UPLOAD] Received ${files.length} file(s) for company ${companyId}`)

    // Validar máximo 5 archivos
    if (files.length > 5) {
      return NextResponse.json({
        success: false,
        error: 'Máximo 5 documentos permitidos por carga'
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const uploadedDocuments: any[] = []
    const errors: string[] = []

    // Procesar cada archivo
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      console.log(`📄 [DOCUMENTS UPLOAD] Processing file ${i + 1}/${files.length}:`, {
        name: file.name,
        type: file.type,
        size: file.size
      })

      // Validar tipo de archivo
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no permitido`)
        continue
      }

      // Validar tamaño
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Archivo demasiado grande (máx 50MB)`)
        continue
      }

      try {
        // Generar nombre único para el archivo con companyId en el path
        const fileExtension = file.name.split('.').pop() || 'pdf'
        const timestamp = Date.now()
        const randomSuffix = randomBytes(8).toString('hex')
        const fileName = `document-${timestamp}-${i}-${randomSuffix}.${fileExtension}`
        // ⚠️ IMPORTANTE: Organizamos por companyId para seguridad y organización
        const storagePath = `company-${companyId}/documents/${fileName}`

        console.log(`🔑 [DOCUMENTS UPLOAD] Generated PRIVATE storage path for file ${i + 1}:`, storagePath)

        // Convertir File a ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

        // Subir a Supabase Storage PRIVADO
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false
          })

        if (error) {
          console.error(`❌ [DOCUMENTS UPLOAD] Error uploading file ${i + 1}:`, error)
          errors.push(`${file.name}: ${error.message}`)
          continue
        }

        console.log(`✅ [DOCUMENTS UPLOAD] File ${i + 1} uploaded successfully to PRIVATE Supabase Storage`)

        // ⚠️ NO generamos URL pública - el archivo es PRIVADO
        // En su lugar, guardamos metadatos para generar URLs firmadas posteriormente
        uploadedDocuments.push({
          originalName: file.name,
          storedFileName: fileName,
          storagePath: storagePath,
          size: file.size,
          type: file.type,
          companyId: companyId,
          uploadedAt: new Date().toISOString()
        })

        console.log(`🔒 [DOCUMENTS UPLOAD] File ${i + 1} stored as PRIVATE - requires signed URL for access`)
      } catch (uploadError: any) {
        console.error(`❌ [DOCUMENTS UPLOAD] Error uploading file ${i + 1}:`, uploadError)
        errors.push(`${file.name}: ${uploadError.message || 'Error al subir'}`)
      }
    }

    // Retornar resultado con metadatos (NO URLs públicas)
    const hasUploads = uploadedDocuments.length > 0
    const hasErrors = errors.length > 0

    if (!hasUploads && hasErrors) {
      // Todos los archivos fallaron
      return NextResponse.json({
        success: false,
        error: 'No se pudo subir ningún archivo',
        errors
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments, // Metadatos de archivos, NO URLs públicas
      uploadedCount: uploadedDocuments.length,
      totalCount: files.length,
      message: hasErrors
        ? `${uploadedDocuments.length}/${files.length} documentos subidos exitosamente`
        : 'Todos los documentos subidos exitosamente',
      info: '⚠️ Los documentos son privados. Usa /api/documents/[companyId]/[filename] para obtener URLs temporales.',
      ...(hasErrors ? { errors } : {})
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('❌ [DOCUMENTS UPLOAD] Error uploading documents:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor al subir documentos'
    }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
