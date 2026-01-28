import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { processEmployeePhoto } from '@/lib/gemini'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

/**
 * POST /api/ai/process-employee-photo
 * Procesa foto de empleado con IA:
 * - Remueve fondo y pone blanco puro
 * - Agrega traje formal según género
 * - Normaliza a 1024x1024
 */
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Verificar configuración de Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Process Employee Photo] Supabase not configured')
      return NextResponse.json({
        success: false,
        error: 'El almacenamiento no está configurado'
      }, { status: 500 })
    }

    const body = await request.json()
    const { imageBase64, gender, employeeId } = body

    if (!imageBase64) {
      return NextResponse.json({
        success: false,
        error: 'imageBase64 es requerido'
      }, { status: 400 })
    }

    if (!gender || !['male', 'female'].includes(gender)) {
      return NextResponse.json({
        success: false,
        error: 'gender debe ser "male" o "female"'
      }, { status: 400 })
    }

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'employeeId es requerido'
      }, { status: 400 })
    }

    console.log(`[Process Employee Photo] Processing photo for employee ${employeeId}, gender: ${gender}`)

    // 1. Procesar con Gemini
    const result = await processEmployeePhoto(imageBase64, gender)

    if (!result.success) {
      console.error('[Process Employee Photo] Gemini processing failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo procesar la imagen'
      }, { status: 500 })
    }

    console.log('[Process Employee Photo] Gemini processing successful, saving to storage...')

    // 2. Crear cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const timestamp = Date.now()
    const randomSuffix = randomBytes(4).toString('hex')
    const basePath = `company-${companyId}/employee-photos`

    // 3. Guardar imagen original
    const cleanOriginalBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const originalBuffer = Buffer.from(cleanOriginalBase64, 'base64')
    const originalFileName = `employee-${employeeId}-${timestamp}-${randomSuffix}-original.jpg`
    const originalPath = `${basePath}/${originalFileName}`

    const { error: originalError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(originalPath, originalBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (originalError) {
      console.error('[Process Employee Photo] Error saving original:', originalError)
      return NextResponse.json({
        success: false,
        error: 'Error al guardar imagen original'
      }, { status: 500 })
    }

    // 4. Guardar imagen procesada
    const processedBuffer = Buffer.from(result.imageBase64!, 'base64')
    const processedFileName = `employee-${employeeId}-${timestamp}-${randomSuffix}-processed.jpg`
    const processedPath = `${basePath}/${processedFileName}`

    const { error: processedError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(processedPath, processedBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (processedError) {
      console.error('[Process Employee Photo] Error saving processed:', processedError)
      return NextResponse.json({
        success: false,
        error: 'Error al guardar imagen procesada'
      }, { status: 500 })
    }

    // 5. Generar URLs firmadas (válidas por 1 hora para preview)
    const { data: originalSignedUrl } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(originalPath, 3600)

    const { data: processedSignedUrl } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(processedPath, 3600)

    console.log('[Process Employee Photo] Successfully processed and saved employee photo')

    return NextResponse.json({
      success: true,
      data: {
        originalPath: originalPath,
        processedPath: processedPath,
        originalSignedUrl: originalSignedUrl?.signedUrl || null,
        processedSignedUrl: processedSignedUrl?.signedUrl || null,
        processedBase64: result.imageBase64 // Para preview inmediato
      }
    })

  } catch (error: any) {
    console.error('[Process Employee Photo] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al procesar imagen'
    }, { status: 500 })
  }
}
