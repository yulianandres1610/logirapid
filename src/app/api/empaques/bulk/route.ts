import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Generar código de empaque
function generateEmpaqueCode(packageSizeName: string, warehouseCity: string): string {
  // Obtener iniciales del tamaño (primeras 3 letras en mayúsculas)
  const sizeInitials = packageSizeName.substring(0, 3).toUpperCase()

  // Obtener iniciales de la ciudad (primeras 5 letras en mayúsculas)
  const cityInitials = warehouseCity.substring(0, 5).toUpperCase()

  // Generar números aleatorios (7 dígitos)
  const randomNumbers = Math.floor(Math.random() * 10000000).toString().padStart(7, '0')

  return `EMP${sizeInitials}${cityInitials}${randomNumbers}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      quantity,
      packageSizeId,
      supplierId,
      supplierName,
      warehouseId,
      warehouseName,
      warehouseCity,
      usuarioId,
      usuarioNombre,
      labelSettingId
    } = body

    // Get company filter
    const { isSuperAdmin, companyId: userCompanyId } = getCompanyFilter(request)

    // For SUPER_ADMIN, get company_id from the warehouse
    // For normal users, use their company_id
    let companyId = userCompanyId

    // If SUPER_ADMIN and no company_id from cookies, get it from warehouse
    if (isSuperAdmin && !companyId && warehouseId) {
      const warehouseResult = await db.query(
        'SELECT company_id FROM warehouses WHERE id = $1',
        [warehouseId]
      )

      if (warehouseResult.rows.length > 0) {
        companyId = warehouseResult.rows[0].company_id
        console.log(`📦 [empaques/bulk] SUPER_ADMIN: Using warehouse's company_id: ${companyId}`)
      }
    }

    // If still no company_id, reject
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la empresa. Seleccione un almacén válido.' },
        { status: 400 }
      )
    }

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { success: false, error: 'La cantidad debe ser mayor a 0' },
        { status: 400 }
      )
    }

    if (!packageSizeId) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar un tamaño de empaque' },
        { status: 400 }
      )
    }

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'Debe seleccionar un proveedor' },
        { status: 400 }
      )
    }

    // Agregar columna label_setting_id si no existe (migración)
    try {
      await db.query(`
        ALTER TABLE empaques ADD COLUMN IF NOT EXISTS label_setting_id INTEGER
      `)
    } catch (error) {
      // Columna ya existe
    }

    // Obtener información del tamaño de paquete
    const packageSizeResult = await db.query(
      'SELECT name FROM package_sizes WHERE id = $1',
      [packageSizeId]
    )

    if (packageSizeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tamaño de paquete no encontrado' },
        { status: 404 }
      )
    }

    const packageSizeName = packageSizeResult.rows[0].name

    const createdEmpaques = []

    // Crear las cajas una por una
    for (let i = 0; i < quantity; i++) {
      // Generar código único
      const codigo = generateEmpaqueCode(packageSizeName, warehouseCity || warehouseName)

      // Verificar que el código no exista (muy raro pero posible)
      const existingCheck = await db.query(
        'SELECT id FROM empaques WHERE codigo = $1',
        [codigo]
      )

      if (existingCheck.rows.length > 0) {
        // Si existe, generar nuevo código
        const newCodigo = generateEmpaqueCode(packageSizeName, warehouseCity || warehouseName)

        const result = await db.query(
          `INSERT INTO empaques (
            codigo, package_size_id, tipo, estado, warehouse_id, warehouse_name,
            supplier_id, supplier_name, label_setting_id, company_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING *`,
          [newCodigo, packageSizeId, 'caja', 'disponible', warehouseId, warehouseName, supplierId, supplierName, labelSettingId || null, companyId]
        )

        createdEmpaques.push(result.rows[0])

        // Crear trazabilidad
        await db.query(
          `INSERT INTO empaques_trazabilidad (
            empaque_id, accion, ubicacion, warehouse_id, warehouse_name,
            usuario_id, usuario_nombre, notas
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            result.rows[0].id,
            'creado',
            warehouseName,
            warehouseId,
            warehouseName,
            usuarioId,
            usuarioNombre,
            `Caja creada en lote. Proveedor: ${supplierName}`
          ]
        )
      } else {
        const result = await db.query(
          `INSERT INTO empaques (
            codigo, package_size_id, tipo, estado, warehouse_id, warehouse_name,
            supplier_id, supplier_name, label_setting_id, company_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING *`,
          [codigo, packageSizeId, 'caja', 'disponible', warehouseId, warehouseName, supplierId, supplierName, labelSettingId || null, companyId]
        )

        createdEmpaques.push(result.rows[0])

        // Crear trazabilidad
        await db.query(
          `INSERT INTO empaques_trazabilidad (
            empaque_id, accion, ubicacion, warehouse_id, warehouse_name,
            usuario_id, usuario_nombre, notas
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            result.rows[0].id,
            'creado',
            warehouseName,
            warehouseId,
            warehouseName,
            usuarioId,
            usuarioNombre,
            `Caja creada en lote. Proveedor: ${supplierName}`
          ]
        )
      }
    }

    return NextResponse.json({
      success: true,
      empaques: createdEmpaques,
      count: createdEmpaques.length
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating bulk empaques:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear las cajas' },
      { status: 500 }
    )
  }
}
