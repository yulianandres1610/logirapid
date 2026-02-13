import { NextRequest, NextResponse } from 'next/server'
import * as storageAdapter from '@/lib/storage-adapter'
import { cookies } from 'next/headers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

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
    if (!storageAdapter.isConfigured()) {
      console.error('❌ [EMPLOYEE PHOTO] Storage configuration missing')
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

    // First check if file exists
    const fileData = await storageAdapter.list(BUCKET_NAME, storagePath.split('/').slice(0, -1).join('/'), {
      limit: 1,
      search: storagePath.split('/').pop()
    })

    console.log(`🔍 [EMPLOYEE PHOTO] File check for: ${storagePath}`, {
      fileData
    })

    // Generate signed URL
    let signedUrl: string
    try {
      signedUrl = await storageAdapter.createSignedUrl(BUCKET_NAME, storagePath, URL_EXPIRATION_SECONDS)
    } catch (signedError: any) {
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
        signedUrl,
        expiresIn: URL_EXPIRATION_SECONDS
      })
    }

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl)

  } catch (error: any) {
    console.error('❌ [EMPLOYEE PHOTO] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
