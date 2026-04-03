import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80)
}

// Ensure table exists
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_catalogs (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      store_name VARCHAR(255) NOT NULL,
      description TEXT,
      logo_url TEXT,
      banner_url TEXT,
      primary_color VARCHAR(20) DEFAULT '#f97316',
      phone VARCHAR(50),
      whatsapp VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      province VARCHAR(100),
      facebook_url TEXT,
      instagram_url TEXT,
      telegram_url TEXT,
      categories JSONB DEFAULT '[]',
      show_stock BOOLEAN DEFAULT true,
      show_usd_price BOOLEAN DEFAULT true,
      show_cup_price BOOLEAN DEFAULT true,
      custom_domain VARCHAR(255),
      subdomain VARCHAR(100),
      domain_verified BOOLEAN DEFAULT false,
      dns_instructions JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  // Add new columns if missing
  try {
    await db.query(`ALTER TABLE market_catalogs ADD COLUMN IF NOT EXISTS logo_mobile_url TEXT`)
    await db.query(`ALTER TABLE market_catalogs ADD COLUMN IF NOT EXISTS logo_desktop_url TEXT`)
  } catch { /* already exists */ }
}

/**
 * GET /api/market/catalog/config
 * Get catalog config for the current company
 */
export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    await ensureTable()
    const result = await db.query('SELECT * FROM market_catalogs WHERE company_id = $1', [payload.companyId])

    // Always get available categories from inventory
    const catResult = await db.query(
      `SELECT DISTINCT category FROM market_products WHERE company_id = $1 AND is_active = true AND category IS NOT NULL AND category != '' ORDER BY category`,
      [payload.companyId]
    )
    const availableCategories = catResult.rows.map((r: any) => r.category)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: { exists: false, availableCategories } })
    }

    const catalog = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        exists: true,
        ...catalog,
        categories: catalog.categories || [],
        availableCategories,
        catalogUrl: catalog.custom_domain
          ? `https://${catalog.custom_domain}`
          : `/catalog/${catalog.slug}`,
        publicUrl: `/catalog/${catalog.slug}`
      }
    })
  } catch (error) {
    console.error('[Catalog Config GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 })
  }
}

/**
 * POST /api/market/catalog/config
 * Create or update catalog config
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    await ensureTable()
    const body = await request.json()
    const {
      storeName, description, logoUrl, bannerUrl, primaryColor,
      logoMobileUrl, logoDesktopUrl,
      phone, whatsapp, email, address, city, province,
      facebookUrl, instagramUrl, telegramUrl,
      categories, showStock, showUsdPrice, showCupPrice,
      customDomain, isActive
    } = body

    if (!storeName) {
      return NextResponse.json({ success: false, error: 'El nombre de la tienda es requerido' }, { status: 400 })
    }

    // Check if catalog exists
    const existing = await db.query('SELECT id, slug FROM market_catalogs WHERE company_id = $1', [payload.companyId])

    let slug: string
    let dnsInstructions: any = null

    if (existing.rows.length > 0) {
      slug = existing.rows[0].slug
    } else {
      // Generate unique slug
      slug = slugify(storeName)
      const slugCheck = await db.query('SELECT id FROM market_catalogs WHERE slug = $1', [slug])
      if (slugCheck.rows.length > 0) {
        slug = slug + '-' + payload.companyId
      }
    }

    // Generate DNS instructions if custom domain
    if (customDomain) {
      dnsInstructions = {
        domain: customDomain,
        records: [
          { type: 'CNAME', name: '@', value: 'cname.vercel-dns.com', note: 'Algunos proveedores no permiten CNAME en @, usa A record: 76.76.21.21' },
          { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', note: '' }
        ],
        aRecord: { type: 'A', name: '@', value: '76.76.21.21', note: 'Alternativa si no puedes poner CNAME en @' },
        note: 'Los cambios DNS pueden tardar hasta 48 horas. Después de configurar el DNS, agrega el dominio en el panel de Vercel del proyecto.'
      }
    }

    if (existing.rows.length > 0) {
      // Update
      await db.query(`
        UPDATE market_catalogs SET
          store_name = $1, description = $2, logo_url = $3, banner_url = $4, primary_color = $5,
          phone = $6, whatsapp = $7, email = $8, address = $9, city = $10, province = $11,
          facebook_url = $12, instagram_url = $13, telegram_url = $14,
          categories = $15, show_stock = $16, show_usd_price = $17, show_cup_price = $18,
          custom_domain = $19, dns_instructions = $20, is_active = $21,
          logo_mobile_url = $23, logo_desktop_url = $24, updated_at = NOW()
        WHERE company_id = $22
      `, [
        storeName, description || null, logoUrl || null, bannerUrl || null, primaryColor || '#f97316',
        phone || null, whatsapp || null, email || null, address || null, city || null, province || null,
        facebookUrl || null, instagramUrl || null, telegramUrl || null,
        JSON.stringify(categories || []), showStock !== false, showUsdPrice !== false, showCupPrice !== false,
        customDomain || null, dnsInstructions ? JSON.stringify(dnsInstructions) : null, isActive !== false,
        payload.companyId,
        logoMobileUrl || null, logoDesktopUrl || null
      ])
    } else {
      // Insert
      await db.query(`
        INSERT INTO market_catalogs (
          company_id, slug, store_name, description, logo_url, banner_url, primary_color,
          phone, whatsapp, email, address, city, province,
          facebook_url, instagram_url, telegram_url,
          categories, show_stock, show_usd_price, show_cup_price,
          custom_domain, subdomain, dns_instructions, is_active,
          logo_mobile_url, logo_desktop_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
      `, [
        payload.companyId, slug, storeName, description || null, logoUrl || null, bannerUrl || null, primaryColor || '#f97316',
        phone || null, whatsapp || null, email || null, address || null, city || null, province || null,
        facebookUrl || null, instagramUrl || null, telegramUrl || null,
        JSON.stringify(categories || []), showStock !== false, showUsdPrice !== false, showCupPrice !== false,
        customDomain || null, slug, dnsInstructions ? JSON.stringify(dnsInstructions) : null, isActive !== false,
        logoMobileUrl || null, logoDesktopUrl || null
      ])
    }

    return NextResponse.json({
      success: true,
      data: {
        slug,
        catalogUrl: customDomain ? `https://${customDomain}` : `/catalog/${slug}`,
        dnsInstructions
      }
    })
  } catch (error) {
    console.error('[Catalog Config POST]', error)
    return NextResponse.json({ success: false, error: 'Error al guardar configuración' }, { status: 500 })
  }
}
