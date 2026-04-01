import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/public/catalog/resolve?host=catalogo.servisumic.com
 * Resolves a hostname to a catalog slug
 */
export async function GET(request: NextRequest) {
  try {
    const host = request.nextUrl.searchParams.get('host') || ''

    if (!host) {
      return NextResponse.json({ success: false, error: 'Host required' }, { status: 400 })
    }

    // Try custom_domain first
    let result = await db.query(
      'SELECT slug FROM market_catalogs WHERE custom_domain = $1 AND is_active = true',
      [host]
    )

    if (result.rows.length > 0) {
      return NextResponse.json({ success: true, slug: result.rows[0].slug })
    }

    // Try without www
    const hostNoWww = host.replace(/^www\./, '')
    result = await db.query(
      'SELECT slug FROM market_catalogs WHERE custom_domain = $1 AND is_active = true',
      [hostNoWww]
    )

    if (result.rows.length > 0) {
      return NextResponse.json({ success: true, slug: result.rows[0].slug })
    }

    // Try extracting subdomain part (e.g., catalogo.servisumic.com → look for servisumic slug)
    const parts = host.split('.')
    if (parts.length >= 3 && parts[0] === 'catalogo') {
      // catalogo.servisumic.com → slug = servisumic
      const possibleSlug = parts[1]
      result = await db.query(
        'SELECT slug FROM market_catalogs WHERE (slug = $1 OR subdomain = $1) AND is_active = true',
        [possibleSlug]
      )
      if (result.rows.length > 0) {
        return NextResponse.json({ success: true, slug: result.rows[0].slug })
      }
    }

    // Try the full host as subdomain
    result = await db.query(
      'SELECT slug FROM market_catalogs WHERE subdomain = $1 AND is_active = true',
      [host]
    )

    if (result.rows.length > 0) {
      return NextResponse.json({ success: true, slug: result.rows[0].slug })
    }

    return NextResponse.json({ success: false, error: 'Catalog not found' }, { status: 404 })
  } catch (error) {
    console.error('[Catalog Resolve]', error)
    return NextResponse.json({ success: false, error: 'Error' }, { status: 500 })
  }
}
