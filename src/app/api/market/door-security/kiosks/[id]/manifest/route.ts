import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/market/door-security/kiosks/[id]/manifest
 * Dynamic PWA manifest for a specific kiosk.
 * When installed, the PWA opens directly to that kiosk's scanner page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await db.query(`
      SELECT id, name, location
      FROM market_door_kiosks
      WHERE id::text = $1 OR deviceid = $1
    `, [id])

    const kiosk = result.rows[0]
    const kioskName = kiosk?.name || 'Puerta'
    const kioskId = kiosk?.id || id

    const manifest = {
      name: `ServiSumic - ${kioskName}`,
      short_name: kioskName,
      description: `Control de acceso - ${kioskName}`,
      start_url: `/door-kiosk-scanner/${kioskId}`,
      display: 'standalone',
      background_color: '#1c1917',
      theme_color: '#e86c00',
      orientation: 'portrait',
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    }

    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-cache',
      }
    })
  } catch (error) {
    // Return a fallback manifest
    const manifest = {
      name: 'ServiSumic - Puerta',
      short_name: 'Puerta',
      start_url: `/door-kiosk-scanner/${(await params).id}`,
      display: 'standalone',
      background_color: '#1c1917',
      theme_color: '#e86c00',
      orientation: 'portrait',
      icons: [
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    }

    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: { 'Content-Type': 'application/manifest+json' }
    })
  }
}
