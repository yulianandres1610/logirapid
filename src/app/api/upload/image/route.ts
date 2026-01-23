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
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']

/**
 * GET /api/upload/image?path=xxx&bucket=yyy
 * Returns a signed URL for a stored file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    const bucket = searchParams.get('bucket') || BUCKET_NAME

    if (!path) {
      return NextResponse.json(
        { success: false, error: 'path es requerido' },
        { status: 400 }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Almacenamiento no configurado' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Generate a signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (error || !data?.signedUrl) {
      console.error('[GET Image] Error getting signed URL:', error)
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener la URL del archivo' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl
    })
  } catch (error: any) {
    console.error('[GET Image] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener URL' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/upload/image
 * Sube una imagen genérica a Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [IMAGE UPLOAD] Starting image upload to Supabase Storage')

    // Verificar configuración de Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [IMAGE UPLOAD] Supabase configuration missing')
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
    const file = formData.get('file') as File
    const folder = (formData.get('folder') as string) || 'images'

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

    console.log('📄 [IMAGE UPLOAD] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
      folder
    })

    // Validar tipo de archivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de archivo no permitido. Solo se aceptan PNG, JPG, WEBP, GIF y PDF'
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
          error: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
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
    const fileName = `img-${timestamp}-${randomSuffix}.${fileExtension}`
    const storagePath = `${folder}/${fileName}`

    console.log('🔑 [IMAGE UPLOAD] Generated storage path:', storagePath)

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
      console.error('❌ [IMAGE UPLOAD] Supabase Storage Error:', {
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

    console.log('✅ [IMAGE UPLOAD] File uploaded successfully to Supabase Storage')

    // Obtener URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    const publicUrl = publicUrlData.publicUrl

    console.log('🌐 [IMAGE UPLOAD] Public URL:', publicUrl)

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        fileName,
        path: storagePath,
        message: 'Imagen subida exitosamente'
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error('❌ [IMAGE UPLOAD] Error uploading image:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor al subir la imagen'
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
