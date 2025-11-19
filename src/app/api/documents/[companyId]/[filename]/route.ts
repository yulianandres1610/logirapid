import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Configurar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents'
const URL_EXPIRATION_SECONDS = 3600 // 1 hora

/**
 * GET /api/documents/[companyId]/[filename]
 * Genera una URL firmada temporal para acceder a un documento privado
 * SOLO si el usuario tiene permisos para acceder a documentos de esa empresa
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; filename: string }> }
) {
  try {
    const { companyId, filename } = await params

    console.log(`🔐 [SIGNED URL] Request for document: company=${companyId}, file=${filename}`)

    // Verificar configuración
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [SIGNED URL] Supabase configuration missing')
      return NextResponse.json(
        {
          success: false,
          error: 'Configuración de almacenamiento no disponible'
        },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 1. Verificar permisos del usuario
    const { isSuperAdmin, companyId: userCompanyId } = getCompanyFilter(request)

    console.log(`👤 [SIGNED URL] User permissions: superAdmin=${isSuperAdmin}, userCompany=${userCompanyId}`)

    // SUPER_ADMIN puede acceder a cualquier documento
    // Usuarios normales solo pueden acceder a documentos de su empresa
    if (!isSuperAdmin) {
      if (!userCompanyId) {
        console.warn('⚠️ [SIGNED URL] User has no company assigned')
        return NextResponse.json(
          {
            success: false,
            error: 'No tienes asignada ninguna empresa'
          },
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (userCompanyId.toString() !== companyId) {
        console.warn(`🚫 [SIGNED URL] Access denied: user company ${userCompanyId} != document company ${companyId}`)
        return NextResponse.json(
          {
            success: false,
            error: 'No tienes permisos para acceder a este documento'
          },
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('✅ [SIGNED URL] Permissions verified - generating signed URL')

    // 2. Generar URL firmada temporal
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Construir el path completo del archivo
    const storagePath = `company-${companyId}/documents/${filename}`

    console.log(`🔑 [SIGNED URL] Storage path: ${storagePath}`)

    // Verificar que el archivo existe
    const { data: fileData, error: existsError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`company-${companyId}/documents`, {
        search: filename
      })

    if (existsError || !fileData || fileData.length === 0) {
      console.error('❌ [SIGNED URL] File not found:', existsError?.message || 'No files matched')
      return NextResponse.json(
        {
          success: false,
          error: 'Documento no encontrado'
        },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generar URL firmada
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, URL_EXPIRATION_SECONDS)

    if (signedError || !signedUrlData) {
      console.error('❌ [SIGNED URL] Error generating signed URL:', signedError?.message)
      return NextResponse.json(
        {
          success: false,
          error: 'Error generando URL de acceso'
        },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ [SIGNED URL] Signed URL generated successfully (expires in ${URL_EXPIRATION_SECONDS}s)`)

    // 3. Devolver URL firmada
    return NextResponse.json(
      {
        success: true,
        signedUrl: signedUrlData.signedUrl,
        expiresIn: URL_EXPIRATION_SECONDS,
        expiresAt: new Date(Date.now() + URL_EXPIRATION_SECONDS * 1000).toISOString(),
        filename: filename,
        companyId: companyId,
        message: 'URL temporal generada. Válida por 1 hora.'
      },
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ [SIGNED URL] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
