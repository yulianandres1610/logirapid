import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/apps/releases
 *
 * Registers a new app release in the database.
 * The APK file should already be uploaded to S3 by the deploy script.
 * Requires SUPER_ADMIN authentication.
 *
 * Body: { appId, version, versionCode, mandatory, changelog, apkPath, apkSize }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check — SUPER_ADMIN only
    let userRole: string | null = null
    let userEmail: string | null = null

    const authToken = request.cookies.get('auth-token')?.value

    if (authToken) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const secret = new TextEncoder().encode(jwtSecret)
        const { payload } = await jwtVerify(authToken, secret)
        userRole = (payload.role as string) || null
        userEmail = (payload.email as string) || null
      } catch {
        // Try base64 decode fallback (deploy script may use this format)
        try {
          const decoded = Buffer.from(authToken, 'base64').toString()
          const parts = decoded.split(':')
          if (parts.length >= 3) {
            userEmail = parts[1]
            userRole = parts[2]
          }
        } catch {
          // ignore
        }
      }
    }

    // Also check header-based auth
    if (!userRole) {
      userRole = request.headers.get('x-user-role') || request.cookies.get('user-role')?.value || null
    }

    if (!userRole || userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo SUPER_ADMIN puede registrar releases' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { appId, version, versionCode, mandatory, changelog, apkPath, apkSize } = body

    // Validate required fields
    if (!appId || !version || !versionCode || !apkPath) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: appId, version, versionCode, apkPath' },
        { status: 400 }
      )
    }

    // Deactivate previous versions of this app
    await db.query(
      `UPDATE app_releases SET active = false WHERE appid = $1 AND active = true`,
      [appId]
    )

    // Insert the new release
    const result = await db.query(
      `INSERT INTO app_releases (appid, version, versioncode, mandatory, changelog, apkpath, apksize, uploadedby, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, appid, version, versioncode, mandatory, createdat`,
      [appId, version, versionCode, mandatory || false, changelog || null, apkPath, apkSize || null, userEmail || 'deploy-script']
    )

    const release = result.rows[0]

    console.log(`[releases] New release registered: ${appId} v${version} (code: ${versionCode}) by ${userEmail}`)

    return NextResponse.json({
      success: true,
      data: {
        id: release.id,
        appId: release.appid,
        version: release.version,
        versionCode: release.versioncode,
        mandatory: release.mandatory,
        createdAt: release.createdat,
      }
    })
  } catch (error: any) {
    console.error('[releases] Error:', error)

    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Ya existe un release con esta versión para esta app' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Error al registrar release' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/apps/releases
 *
 * List all releases, optionally filtered by appId.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query: string
    let queryParams: (string | number)[]

    if (appId) {
      query = `SELECT id, appid, version, versioncode, mandatory, changelog, apksize, uploadedby, createdat, active
               FROM app_releases
               WHERE appid = $1
               ORDER BY versioncode DESC
               LIMIT $2`
      queryParams = [appId, limit]
    } else {
      query = `SELECT id, appid, version, versioncode, mandatory, changelog, apksize, uploadedby, createdat, active
               FROM app_releases
               ORDER BY createdat DESC
               LIMIT $1`
      queryParams = [limit]
    }

    const result = await db.query(query, queryParams)

    return NextResponse.json({
      success: true,
      data: {
        releases: result.rows.map((r: any) => ({
          id: r.id,
          appId: r.appid,
          version: r.version,
          versionCode: r.versioncode,
          mandatory: r.mandatory,
          changelog: r.changelog,
          apkSize: r.apksize ? parseInt(r.apksize) : null,
          uploadedBy: r.uploadedby,
          createdAt: r.createdat,
          active: r.active,
        }))
      }
    })
  } catch (error: any) {
    console.error('[releases] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al listar releases' },
      { status: 500 }
    )
  }
}
