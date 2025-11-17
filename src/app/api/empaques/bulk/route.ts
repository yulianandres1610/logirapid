import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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
            supplier_id, supplier_name, label_setting_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING *`,
          [newCodigo, packageSizeId, 'caja', 'disponible', warehouseId, warehouseName, supplierId, supplierName, labelSettingId || null]
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
            supplier_id, supplier_name, label_setting_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING *`,
          [codigo, packageSizeId, 'caja', 'disponible', warehouseId, warehouseName, supplierId, supplierName, labelSettingId || null]
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
