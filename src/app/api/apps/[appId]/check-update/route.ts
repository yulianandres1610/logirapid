import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { createSignedUrl } from '@/lib/storage-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Auto-migrate: create app_releases table if not exists
let migrationDone = false
async function ensureTable() {
  if (migrationDone) return
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_releases (
        id SERIAL PRIMARY KEY,
        appid VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        versioncode INTEGER NOT NULL,
        mandatory BOOLEAN DEFAULT false,
        changelog TEXT,
        apkpath VARCHAR(500) NOT NULL,
        apksize BIGINT,
        uploadedby VARCHAR(200),
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT true
      )
    `)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_releases_app_version
      ON app_releases(appid, version)
    `)
    migrationDone = true
  } catch (err) {
    console.error('[app_releases] Migration error:', err)
  }
}

/**
 * GET /api/apps/[appId]/check-update?versionCode=10100
 *
 * No authentication required — the app may not be logged in yet.
 * Returns update info + presigned download URL if a newer version exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    await ensureTable()

    const { appId } = await params
    const { searchParams } = new URL(request.url)
    const currentVersionCode = parseInt(searchParams.get('versionCode') || '0')

    if (!appId) {
      return NextResponse.json(
        { success: false, error: 'appId es requerido' },
        { status: 400 }
      )
    }

    // Get the latest active release for this app
    const result = await db.query(
      `SELECT id, appid, version, versioncode, mandatory, changelog, apkpath, apksize, createdat
       FROM app_releases
       WHERE appid = $1 AND active = true
       ORDER BY versioncode DESC
       LIMIT 1`,
      [appId]
    )

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { updateAvailable: false }
      })
    }

    const release = result.rows[0]

    // Check if the server version is newer
    if (release.versioncode <= currentVersionCode) {
      return NextResponse.json({
        success: true,
        data: { updateAvailable: false }
      })
    }

    // Generate presigned URL for APK download (1 hour expiration)
    let downloadUrl: string
    try {
      downloadUrl = await createSignedUrl('app-releases', release.apkpath, 3600)
    } catch (err) {
      console.error('[check-update] Error generating signed URL:', err)
      return NextResponse.json(
        { success: false, error: 'Error generando URL de descarga' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        updateAvailable: true,
        version: release.version,
        versionCode: release.versioncode,
        mandatory: release.mandatory,
        changelog: release.changelog,
        downloadUrl,
        apkSize: release.apksize ? parseInt(release.apksize) : null,
        releasedAt: release.createdat,
      }
    })
  } catch (error: any) {
    console.error('[check-update] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al verificar actualizaciones' },
      { status: 500 }
    )
  }
}
