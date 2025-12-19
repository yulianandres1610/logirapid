import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    const companyId = cookieStore.get('user-company-id')?.value

    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Código requerido' }, { status: 400 })
    }

    const searchCode = code.trim()

    // Search product by barcode, sku, or id
    const query = `
      SELECT
        mp.id,
        mp.name,
        mp.sku,
        mp.barcode,
        mp.image_url as "imageUrl",
        mp.quantity_on_hand as "quantityOnHand",
        mp.cost_price as "costPrice",
        mp.selling_price as "sellingPrice",
        mp.unit_of_measure as "unitOfMeasure",
        mc.name as "categoryName"
      FROM market_products mp
      LEFT JOIN market_categories mc ON mp.category_id = mc.id
      WHERE mp.company_id = $1
        AND mp.is_active = true
        AND (
          LOWER(mp.barcode) = LOWER($2)
          OR LOWER(mp.sku) = LOWER($2)
          OR mp.id::text = $2
        )
      LIMIT 1
    `

    const result = await db.query(query, [parseInt(companyId), searchCode])

    if (result.rows.length === 0) {
      // Try partial match
      const partialQuery = `
        SELECT
          mp.id,
          mp.name,
          mp.sku,
          mp.barcode,
          mp.image_url as "imageUrl",
          mp.quantity_on_hand as "quantityOnHand",
          mp.cost_price as "costPrice",
          mp.selling_price as "sellingPrice",
          mp.unit_of_measure as "unitOfMeasure",
          mc.name as "categoryName"
        FROM market_products mp
        LEFT JOIN market_categories mc ON mp.category_id = mc.id
        WHERE mp.company_id = $1
          AND mp.is_active = true
          AND (
            LOWER(mp.barcode) LIKE LOWER($2)
            OR LOWER(mp.sku) LIKE LOWER($2)
            OR LOWER(mp.name) LIKE LOWER($2)
          )
        ORDER BY
          CASE
            WHEN LOWER(mp.barcode) = LOWER($3) THEN 1
            WHEN LOWER(mp.sku) = LOWER($3) THEN 2
            ELSE 3
          END
        LIMIT 1
      `

      const partialResult = await db.query(partialQuery, [
        parseInt(companyId),
        `%${searchCode}%`,
        searchCode
      ])

      if (partialResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Producto no encontrado: ${searchCode}`
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: partialResult.rows[0]
      })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error scanning product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al buscar producto'
    }, { status: 500 })
  }
}
