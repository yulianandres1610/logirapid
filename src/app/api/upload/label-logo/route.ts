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

const BUCKET_NAME = 'company-documents'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']

/**
 * POST /api/upload/label-logo
 * Sube un logo de etiqueta (blanco y negro) a Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [LABEL LOGO UPLOAD] Starting label logo upload to Supabase Storage')

    // Verificar configuración de Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [LABEL LOGO UPLOAD] Supabase configuration missing')
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

    console.log('📄 [LABEL LOGO UPLOAD] File received:', {
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
    const fileName = `label-logo-${timestamp}-${randomSuffix}.${fileExtension}`
    const storagePath = `label-logos/${fileName}`

    console.log('🔑 [LABEL LOGO UPLOAD] Generated storage path:', storagePath)

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('❌ [LABEL LOGO UPLOAD] Supabase Storage Error:', {
        message: error.message,
        name: error.name
      })

      return NextResponse.json(
        {
          success: false,
          error: `Error al subir el archivo: ${error.message}`
        },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ [LABEL LOGO UPLOAD] File uploaded successfully to Supabase Storage')

    // Eliminar logo antiguo si existe
    if (oldLogoUrl) {
      try {
        console.log('🗑️ [LABEL LOGO UPLOAD] Deleting old label logo:', oldLogoUrl)

        // Extraer el path del storage desde la URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/company-documents/label-logos/label-logo-xxx.png
        const urlParts = oldLogoUrl.split('/storage/v1/object/public/' + BUCKET_NAME + '/')
        if (urlParts.length > 1) {
          const oldStoragePath = urlParts[1]

          const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([oldStoragePath])

          if (deleteError) {
            console.warn('⚠️ [LABEL LOGO UPLOAD] Could not delete old label logo:', deleteError.message)
            // No fallar la request si no se puede eliminar el logo antiguo
          } else {
            console.log('✅ [LABEL LOGO UPLOAD] Old label logo deleted successfully')
          }
        } else {
          console.warn('⚠️ [LABEL LOGO UPLOAD] Could not parse old label logo URL path')
        }
      } catch (deleteErr: any) {
        console.warn('⚠️ [LABEL LOGO UPLOAD] Error deleting old label logo:', deleteErr.message)
        // No fallar la request si hay un error al eliminar
      }
    }

    // Obtener URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    const publicUrl = publicUrlData.publicUrl

    console.log('🌐 [LABEL LOGO UPLOAD] Public URL:', publicUrl)

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        fileName,
        message: 'Logo de etiqueta subido exitosamente'
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('❌ [LABEL LOGO UPLOAD] Error uploading label logo:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor al subir el logo de etiqueta'
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
