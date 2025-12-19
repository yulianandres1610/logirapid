import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        id,
        name,
        description,
        image_url as "imageUrl",
        category,
        cost_price as "costPrice",
        selling_price as "sellingPrice",
        currency,
        sku,
        barcode,
        supplier_name as "supplierName",
        supplier_contact as "supplierContact",
        supplier_reference as "supplierReference",
        quantity_on_hand as "quantityOnHand",
        quantity_expected as "quantityExpected",
        minimum_stock as "minimumStock",
        is_active as "isActive",
        unit_of_measure as "unitOfMeasure",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productId, parseInt(companyId)])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    // Get variants if any
    let variants: any[] = []
    try {
      const variantsResult = await db.query(`
        SELECT
          id,
          variant_name as "name",
          sku,
          barcode,
          cost_price as "costPrice",
          selling_price as "sellingPrice",
          quantity_on_hand as "quantityOnHand",
          image_url as "imageUrl",
          is_active as "isActive"
        FROM market_product_variants
        WHERE product_id = $1
        ORDER BY id
      `, [productId])
      variants = variantsResult.rows
    } catch {
      // Variants table may not exist
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.rows[0],
        variants
      }
    })
  } catch (error) {
    console.error('Error getting product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener producto'
    }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Verify product belongs to company
    const checkResult = await db.query(
      'SELECT id FROM market_products WHERE id = $1 AND company_id = $2',
      [productId, parseInt(companyId)]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      description,
      category,
      unitOfMeasure,
      imageUrl,
      costPrice,
      sellingPrice,
      currency,
      sku,
      barcode,
      supplierName,
      supplierContact,
      supplierReference,
      minimumStock,
      isActive
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es requerido' }, { status: 400 })
    }

    // Check for duplicate SKU (excluding current product)
    if (sku) {
      const skuCheck = await db.query(
        'SELECT id FROM market_products WHERE company_id = $1 AND sku = $2 AND id != $3',
        [parseInt(companyId), sku, productId]
      )
      if (skuCheck.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'El SKU ya existe' }, { status: 400 })
      }
    }

    // Check for duplicate barcode (excluding current product)
    if (barcode) {
      const barcodeCheck = await db.query(
        'SELECT id FROM market_products WHERE company_id = $1 AND barcode = $2 AND id != $3',
        [parseInt(companyId), barcode, productId]
      )
      if (barcodeCheck.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'El código de barras ya existe' }, { status: 400 })
      }
    }

    await db.query(`
      UPDATE market_products SET
        name = $1,
        description = $2,
        category = $3,
        unit_of_measure = $4,
        image_url = $5,
        cost_price = $6,
        selling_price = $7,
        currency = $8,
        sku = $9,
        barcode = $10,
        supplier_name = $11,
        supplier_contact = $12,
        supplier_reference = $13,
        minimum_stock = $14,
        is_active = $15,
        updated_at = NOW()
      WHERE id = $16 AND company_id = $17
    `, [
      name,
      description || null,
      category || null,
      unitOfMeasure || 'unidad',
      imageUrl || null,
      costPrice || 0,
      sellingPrice || 0,
      currency || 'USD',
      sku || null,
      barcode || null,
      supplierName || null,
      supplierContact || null,
      supplierReference || null,
      minimumStock || 5,
      isActive !== false,
      productId,
      parseInt(companyId)
    ])

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar producto'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Verify product belongs to company
    const checkResult = await db.query(
      'SELECT id FROM market_products WHERE id = $1 AND company_id = $2',
      [productId, parseInt(companyId)]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    // Delete variants first
    try {
      await db.query('DELETE FROM market_product_variants WHERE product_id = $1', [productId])
    } catch {
      // Variants table may not exist
    }

    // Delete product
    await db.query(
      'DELETE FROM market_products WHERE id = $1 AND company_id = $2',
      [productId, parseInt(companyId)]
    )

    return NextResponse.json({
      success: true,
      message: 'Producto eliminado correctamente'
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar producto'
    }, { status: 500 })
  }
}
