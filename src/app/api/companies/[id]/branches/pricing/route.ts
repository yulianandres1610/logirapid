import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Branch-Specific Product Pricing API
 *
 * Allows matrix companies to set DIFFERENT prices for EACH branch
 * instead of a single precio_sucursales for all branches.
 *
 * GET: Returns pricing matrix (products x branches) for a matrix company
 * POST: Upsert branch-specific prices
 * DELETE: Remove a specific branch price (reverts to default)
 */

interface BranchPrice {
  branchId: number
  productId: number
  precioSucursal: number
  notes?: string
}

// GET - Fetch branch pricing matrix for a matrix company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const matrixCompanyId = parseInt(id)

    if (isNaN(matrixCompanyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

    // Step 1: Verify company exists and is a matrix (not a branch)
    const companyResult = await db.query(`
      SELECT id, legalname, is_branch, parent_company_id
      FROM companies
      WHERE id = $1
    `, [matrixCompanyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    if (company.is_branch) {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa es una sucursal. Solo empresas matriz pueden configurar precios por sucursal.'
      }, { status: 400 })
    }

    // Step 2: Get all branches for this matrix company
    const branchesResult = await db.query(`
      SELECT id, legalname, status
      FROM companies
      WHERE parent_company_id = $1
        AND is_branch = true
      ORDER BY legalname
    `, [matrixCompanyId])

    const branches = branchesResult.rows.map(b => ({
      id: b.id,
      name: b.legalname,
      status: b.status
    }))

    // Step 3: Get products with matrix pricing (to get default precio_sucursales)
    const productsResult = await db.query(`
      SELECT
        pc.id as product_id,
        pc.code,
        pc.name,
        pc.service_category,
        pc.product_type,
        cpp.precio_sucursales as default_price,
        cpp.precio_clientes
      FROM product_catalog pc
      LEFT JOIN company_product_pricing cpp
        ON cpp.product_id = pc.id
        AND cpp.company_id = $1
      WHERE pc.is_active = true
      ORDER BY pc.service_category, pc.display_order, pc.name
    `, [matrixCompanyId])

    // Step 4: Get all branch-specific pricing
    const branchPricingResult = await db.query(`
      SELECT
        bpp.branch_company_id,
        bpp.product_id,
        bpp.precio_sucursal,
        bpp.notes,
        bpp.updated_at
      FROM branch_product_pricing bpp
      WHERE bpp.matrix_company_id = $1
    `, [matrixCompanyId])

    // Build a map of branch pricing for quick lookup
    const branchPricingMap: Record<string, {
      precio: number,
      notes: string | null,
      updatedAt: string
    }> = {}

    for (const bp of branchPricingResult.rows) {
      const key = `${bp.branch_company_id}-${bp.product_id}`
      branchPricingMap[key] = {
        precio: parseFloat(bp.precio_sucursal),
        notes: bp.notes,
        updatedAt: bp.updated_at
      }
    }

    // Step 5: Build the response structure
    const products = productsResult.rows.map(p => {
      const branchPrices: Record<number, {
        precio: number
        isCustom: boolean
        notes?: string
      }> = {}

      for (const branch of branches) {
        const key = `${branch.id}-${p.product_id}`
        const customPrice = branchPricingMap[key]

        if (customPrice) {
          branchPrices[branch.id] = {
            precio: customPrice.precio,
            isCustom: true,
            notes: customPrice.notes || undefined
          }
        } else {
          // Use default precio_sucursales
          branchPrices[branch.id] = {
            precio: p.default_price ? parseFloat(p.default_price) : 0,
            isCustom: false
          }
        }
      }

      return {
        productId: p.product_id,
        code: p.code,
        name: p.name,
        serviceCategory: p.service_category,
        productType: p.product_type,
        defaultPrice: p.default_price ? parseFloat(p.default_price) : 0,
        precioClientes: p.precio_clientes ? parseFloat(p.precio_clientes) : null,
        branchPrices
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        matrixCompanyId,
        matrixCompanyName: company.legalname,
        branches,
        products,
        totalProducts: products.length,
        totalBranches: branches.length
      }
    })

  } catch (error: any) {
    console.error('Error fetching branch pricing:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener precios por sucursal'
    }, { status: 500 })
  }
}

// POST - Upsert branch-specific prices
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const matrixCompanyId = parseInt(id)

    if (isNaN(matrixCompanyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { branchPricing, notes } = body as {
      branchPricing: BranchPrice[]
      notes?: string
    }

    if (!branchPricing || !Array.isArray(branchPricing) || branchPricing.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un array de precios por sucursal'
      }, { status: 400 })
    }

    // Verify company is a matrix
    const companyResult = await db.query(`
      SELECT id, is_branch FROM companies WHERE id = $1
    `, [matrixCompanyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    if (companyResult.rows[0].is_branch) {
      return NextResponse.json({
        success: false,
        error: 'Solo empresas matriz pueden configurar precios por sucursal'
      }, { status: 400 })
    }

    // Process each branch price
    const results: Array<{
      branchId: number
      productId: number
      success: boolean
      error?: string
    }> = []

    for (const bp of branchPricing) {
      try {
        // Validate branch belongs to this matrix
        const branchCheck = await db.query(`
          SELECT id FROM companies
          WHERE id = $1
            AND parent_company_id = $2
            AND is_branch = true
        `, [bp.branchId, matrixCompanyId])

        if (branchCheck.rows.length === 0) {
          results.push({
            branchId: bp.branchId,
            productId: bp.productId,
            success: false,
            error: 'Sucursal no pertenece a esta empresa matriz'
          })
          continue
        }

        // Validate product exists and get matrix company's cost
        const productCheck = await db.query(`
          SELECT
            pc.id,
            pc.name,
            COALESCE(cpp.mi_costo, pc.precio_mayorista) as mi_costo
          FROM product_catalog pc
          LEFT JOIN company_product_pricing cpp
            ON cpp.product_id = pc.id
            AND cpp.company_id = $2
          WHERE pc.id = $1 AND pc.is_active = true
        `, [bp.productId, matrixCompanyId])

        if (productCheck.rows.length === 0) {
          results.push({
            branchId: bp.branchId,
            productId: bp.productId,
            success: false,
            error: 'Producto no encontrado o inactivo'
          })
          continue
        }

        // Validate price is not below cost
        const miCosto = parseFloat(productCheck.rows[0].mi_costo || 0)
        if (bp.precioSucursal < miCosto) {
          results.push({
            branchId: bp.branchId,
            productId: bp.productId,
            success: false,
            error: `Precio ($${bp.precioSucursal}) no puede ser menor al costo ($${miCosto.toFixed(2)})`
          })
          continue
        }

        // Upsert the branch price
        await db.query(`
          INSERT INTO branch_product_pricing
            (matrix_company_id, branch_company_id, product_id, precio_sucursal, notes, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (matrix_company_id, branch_company_id, product_id)
          DO UPDATE SET
            precio_sucursal = EXCLUDED.precio_sucursal,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        `, [matrixCompanyId, bp.branchId, bp.productId, bp.precioSucursal, bp.notes || notes || null])

        results.push({
          branchId: bp.branchId,
          productId: bp.productId,
          success: true
        })

      } catch (err: any) {
        results.push({
          branchId: bp.branchId,
          productId: bp.productId,
          success: false,
          error: err.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: errorCount === 0,
      data: {
        results,
        successCount,
        errorCount,
        totalProcessed: results.length
      },
      message: errorCount === 0
        ? `${successCount} precios actualizados correctamente`
        : `${successCount} actualizados, ${errorCount} errores`
    })

  } catch (error: any) {
    console.error('Error saving branch pricing:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al guardar precios por sucursal'
    }, { status: 500 })
  }
}

// DELETE - Remove a specific branch price (reverts to default)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const matrixCompanyId = parseInt(id)

    if (isNaN(matrixCompanyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { branchId, productId } = body as { branchId: number, productId: number }

    if (!branchId || !productId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere branchId y productId'
      }, { status: 400 })
    }

    // Delete the specific branch price
    const result = await db.query(`
      DELETE FROM branch_product_pricing
      WHERE matrix_company_id = $1
        AND branch_company_id = $2
        AND product_id = $3
      RETURNING id
    `, [matrixCompanyId, branchId, productId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Precio específico no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Precio específico eliminado. La sucursal usará el precio default.',
      data: {
        deletedId: result.rows[0].id,
        branchId,
        productId
      }
    })

  } catch (error: any) {
    console.error('Error deleting branch price:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al eliminar precio por sucursal'
    }, { status: 500 })
  }
}
