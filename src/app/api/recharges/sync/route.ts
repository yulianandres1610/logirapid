import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import { getUnivCellClient } from '@/lib/univcell-client'
import { verify } from 'jsonwebtoken'

export async function POST() {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const authToken = cookieStore.get('auth-token')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo SUPER_ADMIN puede sincronizar productos' },
        { status: 403 }
      )
    }

    // Extract user ID from JWT token
    let userId: number | null = null
    if (authToken) {
      try {
        const decoded = verify(authToken, process.env.JWT_SECRET || '') as { userId: number }
        userId = decoded.userId
      } catch {
        // Token might be in old format userId:email:role
        const parts = authToken.split(':')
        if (parts.length >= 1 && !isNaN(parseInt(parts[0]))) {
          userId = parseInt(parts[0])
        }
      }
    }

    const client = getUnivCellClient()

    // Check if client is configured
    if (!client.isConfigured()) {
      const status = client.getConfigStatus()
      return NextResponse.json(
        {
          success: false,
          error: 'UnivCell API no está configurado correctamente',
          details: status,
        },
        { status: 400 }
      )
    }

    // First, check available countries to verify API access
    let availableCountries: any[] = []
    try {
      availableCountries = await client.getAvailableCountries()
      console.log('[Sync] Available countries:', availableCountries?.length)
    } catch (e: any) {
      console.log('[Sync] Could not get countries:', e.message)
    }

    // Create sync log
    const syncLogResult = await db.query(
      `INSERT INTO recharge_sync_logs (sync_type, synced_by, status)
       VALUES ('full', $1, 'in_progress')
       RETURNING id`,
      [userId]
    )
    const syncLogId = syncLogResult.rows[0].id

    let productsCreated = 0
    let productsUpdated = 0
    let promotionsSynced = 0
    const errors: string[] = []

    try {
      // Fetch products from UnivCell
      let products: any[] = []
      let apiAccessLimited = false

      try {
        products = await client.getProducts()
        console.log('[Sync] Products fetched:', products?.length)
      } catch (productsError: any) {
        console.log('[Sync] Products fetch error:', productsError.message)

        // Check if it's an authorization error
        if (productsError.message?.includes('Unauthorized') || productsError.message?.includes('User account')) {
          apiAccessLimited = true
          errors.push('Acceso limitado: Tu cuenta UnivCell no tiene permisos para obtener productos. Contacta a UnivCell para activar tu acceso de reseller.')
        } else {
          throw productsError
        }
      }

      // If we couldn't get products, return with countries info
      if (apiAccessLimited || products.length === 0) {
        await db.query(
          `UPDATE recharge_sync_logs
           SET errors = $2,
               completed_at = NOW(),
               status = 'limited_access'
           WHERE id = $1`,
          [syncLogId, JSON.stringify(errors)]
        )

        return NextResponse.json({
          success: false,
          apiAccessLimited: true,
          message: 'Tu cuenta UnivCell tiene acceso limitado. Contacta a soporte de UnivCell para activar el acceso completo de reseller.',
          data: {
            availableCountries: availableCountries.map((c: any) => ({
              code: c.sortname,
              name: c.name,
              phoneCode: c.phonecode,
            })),
            productsCreated: 0,
            productsUpdated: 0,
            errors,
          },
        })
      }

      for (const product of products) {
        try {
          // Check if product exists
          const existing = await db.query(
            'SELECT id FROM external_recharge_products WHERE external_id = $1',
            [product.id]
          )

          const countryCode = product.country?.sortname || ''
          const countryName = product.country?.name || ''

          if (existing.rows.length > 0) {
            // Update existing product
            await db.query(
              `UPDATE external_recharge_products
               SET name = $2,
                   slug = $3,
                   description = $4,
                   base_cost = $5,
                   country_code = $6,
                   country_name = $7,
                   phone_pattern = $8,
                   accepts_range = $9,
                   last_synced_at = NOW(),
                   updated_at = NOW()
               WHERE external_id = $1`,
              [
                product.id,
                product.name,
                product.slug,
                product.description || '',
                product.price, // Price is already in USD
                countryCode,
                countryName,
                product.pattern || '',
                product.range || false,
              ]
            )
            productsUpdated++
          } else {
            // Insert new product
            await db.query(
              `INSERT INTO external_recharge_products
               (external_id, name, slug, description, base_cost, country_code, country_name, phone_pattern, accepts_range)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                product.id,
                product.name,
                product.slug,
                product.description || '',
                product.price, // Price is already in USD
                countryCode,
                countryName,
                product.pattern || '',
                product.range || false,
              ]
            )
            productsCreated++
          }
        } catch (productError: any) {
          errors.push(`Error syncing product ${product.id}: ${productError.message}`)
        }
      }

      // Fetch and sync promotions
      try {
        const promotions = await client.getPromotions()

        // Mark all existing promotions as inactive first
        await db.query(
          `UPDATE recharge_promotions SET is_active = false WHERE is_active = true`
        )

        for (const promo of promotions) {
          try {
            // Get local product ID
            const productResult = await db.query(
              'SELECT id FROM external_recharge_products WHERE external_id = $1',
              [promo.product_id]
            )

            if (productResult.rows.length > 0) {
              const localProductId = productResult.rows[0].id

              // Check if promotion exists
              const existingPromo = await db.query(
                'SELECT id FROM recharge_promotions WHERE external_id = $1',
                [promo.id]
              )

              if (existingPromo.rows.length > 0) {
                await db.query(
                  `UPDATE recharge_promotions
                   SET external_product_id = $2,
                       min_amount = $3,
                       valid_from = $4,
                       valid_to = $5,
                       summary = $6,
                       description = $7,
                       is_active = true,
                       last_synced_at = NOW()
                   WHERE external_id = $1`,
                  [
                    promo.id,
                    localProductId,
                    promo.min_amount || null, // Amount is already in USD
                    promo.from,
                    promo.to,
                    promo.summary,
                    promo.description,
                  ]
                )
              } else {
                await db.query(
                  `INSERT INTO recharge_promotions
                   (external_id, external_product_id, min_amount, valid_from, valid_to, summary, description, is_active)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
                  [
                    promo.id,
                    localProductId,
                    promo.min_amount || null, // Amount is already in USD
                    promo.from,
                    promo.to,
                    promo.summary,
                    promo.description,
                  ]
                )
              }
              promotionsSynced++
            }
          } catch (promoError: any) {
            errors.push(`Error syncing promotion ${promo.id}: ${promoError.message}`)
          }
        }
      } catch (promoFetchError: any) {
        errors.push(`Error fetching promotions: ${promoFetchError.message}`)
      }

      // Update sync log
      await db.query(
        `UPDATE recharge_sync_logs
         SET products_synced = $2,
             promotions_synced = $3,
             errors = $4,
             completed_at = NOW(),
             status = 'completed'
         WHERE id = $1`,
        [
          syncLogId,
          productsCreated + productsUpdated,
          promotionsSynced,
          errors.length > 0 ? JSON.stringify(errors) : null,
        ]
      )

      return NextResponse.json({
        success: true,
        data: {
          productsCreated,
          productsUpdated,
          promotionsSynced,
          totalProducts: productsCreated + productsUpdated,
          errors: errors.length > 0 ? errors : undefined,
        },
        message: `Sincronizacion completada: ${productsCreated} productos nuevos, ${productsUpdated} actualizados, ${promotionsSynced} promociones`,
      })
    } catch (syncError: any) {
      // Update sync log with error
      await db.query(
        `UPDATE recharge_sync_logs
         SET errors = $2,
             completed_at = NOW(),
             status = 'error'
         WHERE id = $1`,
        [syncLogId, JSON.stringify([syncError.message])]
      )
      throw syncError
    }
  } catch (error: any) {
    console.error('[Recharge Sync Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error sincronizando productos',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get last sync info
    const lastSync = await db.query(
      `SELECT *
       FROM recharge_sync_logs
       ORDER BY started_at DESC
       LIMIT 1`
    )

    // Get product counts
    const productCount = await db.query(
      'SELECT COUNT(*) as count FROM external_recharge_products WHERE is_active = true'
    )

    const promotionCount = await db.query(
      `SELECT COUNT(*) as count FROM recharge_promotions
       WHERE is_active = true
       AND (valid_to IS NULL OR valid_to > NOW())`
    )

    return NextResponse.json({
      success: true,
      data: {
        lastSync: lastSync.rows[0] || null,
        activeProducts: parseInt(productCount.rows[0].count),
        activePromotions: parseInt(promotionCount.rows[0].count),
      },
    })
  } catch (error: any) {
    console.error('[Recharge Sync Status Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo estado de sincronizacion',
      },
      { status: 500 }
    )
  }
}
