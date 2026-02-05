import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents'
const URL_EXPIRATION_SECONDS = 3600 // 1 hour

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  const userRole = cookieStore.get('user-role')?.value
  return {
    companyId: companyId ? parseInt(companyId) : null,
    isSuperAdmin: userRole === 'SUPER_ADMIN'
  }
}

/**
 * GET /api/employee-photos/[...path]
 * Generates a signed URL for employee photos stored in Supabase Storage
 *
 * Path format: /api/employee-photos/company-31/employee-photos/filename.jpg
 * Or redirect to the signed URL directly
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const storagePath = path.join('/')

    console.log(`🖼️ [EMPLOYEE PHOTO] Request for: ${storagePath}`)

    // Check configuration
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [EMPLOYEE PHOTO] Supabase configuration missing')
      return NextResponse.json(
        { success: false, error: 'Storage configuration not available' },
        { status: 500 }
      )
    }

    // Get user permissions
    const { companyId: userCompanyId, isSuperAdmin } = await getCompanyId()

    // Extract company ID from path (format: company-{id}/...)
    const companyMatch = storagePath.match(/^company-(\d+)\//)
    if (!companyMatch) {
      console.error('❌ [EMPLOYEE PHOTO] Invalid path format:', storagePath)
      return NextResponse.json(
        { success: false, error: 'Invalid path format' },
        { status: 400 }
      )
    }

    const pathCompanyId = parseInt(companyMatch[1])

    // Permission check
    if (!isSuperAdmin) {
      if (!userCompanyId) {
        console.warn('⚠️ [EMPLOYEE PHOTO] User has no company assigned')
        return NextResponse.json(
          { success: false, error: 'No company assigned' },
          { status: 403 }
        )
      }

      if (userCompanyId !== pathCompanyId) {
        console.warn(`🚫 [EMPLOYEE PHOTO] Access denied: user company ${userCompanyId} != path company ${pathCompanyId}`)
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // First check if file exists
    const { data: fileData, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: storagePath.split('/').pop()
      })

    console.log(`🔍 [EMPLOYEE PHOTO] File check for: ${storagePath}`, {
      fileData,
      listError: listError?.message
    })

    // Generate signed URL
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, URL_EXPIRATION_SECONDS)

    if (signedError || !signedUrlData) {
      console.error('❌ [EMPLOYEE PHOTO] Error generating signed URL:', signedError?.message, 'for path:', storagePath)
      return NextResponse.json(
        { success: false, error: 'Photo not found', path: storagePath },
        { status: 404 }
      )
    }

    console.log(`✅ [EMPLOYEE PHOTO] Redirecting to signed URL`)

    // Check if client wants JSON response or redirect
    const acceptHeader = request.headers.get('accept') || ''
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        expiresIn: URL_EXPIRATION_SECONDS
      })
    }

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrlData.signedUrl)

  } catch (error: any) {
    console.error('❌ [EMPLOYEE PHOTO] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
