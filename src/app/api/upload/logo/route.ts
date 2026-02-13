import { NextRequest, NextResponse } from 'next/server'
import * as storageAdapter from '@/lib/storage-adapter'
import { randomBytes } from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

const BUCKET_NAME = 'company-documents'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']

/**
 * POST /api/upload/logo
 * Sube un logo de empresa a Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [LOGO UPLOAD] Starting logo upload to Supabase Storage')

    // Verificar configuración de almacenamiento
    if (!storageAdapter.isConfigured()) {
      console.error('❌ [LOGO UPLOAD] Storage configuration missing')
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

    const formData = await request.formData()
    const file = formData.get('logo') as File
    const oldLogoUrl = formData.get('oldLogoUrl') as string | null

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se proporcionó ningún archivo'
        },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📄 [LOGO UPLOAD] File received:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Validar tipo de archivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de archivo no permitido. Solo se aceptan PNG, JPG, SVG y WEBP'
        },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'El archivo es demasiado grande. Tamaño máximo: 5MB'
        },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const randomSuffix = randomBytes(8).toString('hex')
    const fileName = `logo-${timestamp}-${randomSuffix}.${fileExtension}`
    const storagePath = `logos/${fileName}`

    console.log('🔑 [LOGO UPLOAD] Generated storage path:', storagePath)

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Subir a Storage (dual-write: Supabase + MinIO)
    const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false
    })

    if (!uploadResult.success) {
      console.error('❌ [LOGO UPLOAD] Storage Error:', uploadResult.error)

      return NextResponse.json(
        {
          success: false,
          error: `Error al subir el archivo: ${uploadResult.error}`
        },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ [LOGO UPLOAD] File uploaded successfully')

    // Eliminar logo antiguo si existe
    if (oldLogoUrl) {
      try {
        console.log('🗑️ [LOGO UPLOAD] Deleting old logo:', oldLogoUrl)

        // Extraer el path del storage desde la URL
        const urlParts = oldLogoUrl.split('/storage/v1/object/public/' + BUCKET_NAME + '/')
        if (urlParts.length > 1) {
          const oldStoragePath = urlParts[1]
          await storageAdapter.remove(BUCKET_NAME, [oldStoragePath])
          console.log('✅ [LOGO UPLOAD] Old logo deleted successfully')
        } else {
          console.warn('⚠️ [LOGO UPLOAD] Could not parse old logo URL path')
        }
      } catch (deleteErr: any) {
        console.warn('⚠️ [LOGO UPLOAD] Error deleting old logo:', deleteErr.message)
      }
    }

    // Obtener URL pública del archivo
    const publicUrl = uploadResult.publicUrl || storageAdapter.getPublicUrl(BUCKET_NAME, storagePath)

    console.log('🌐 [LOGO UPLOAD] Public URL:', publicUrl)

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        fileName,
        message: 'Logo subido exitosamente'
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('❌ [LOGO UPLOAD] Error uploading logo:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor al subir el logo'
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
