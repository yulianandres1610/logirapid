import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener todos los tipos de contenido
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    let query = `
      SELECT
        id,
        name,
        icon,
        description,
        active,
        display_order as "displayOrder",
        color,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM package_content_types
    `

    if (activeOnly) {
      query += ' WHERE active = true'
    }

    query += ' ORDER BY display_order ASC, name ASC'

    const result = await db.query(query)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting package content types:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener tipos de contenido'
    }, { status: 500 })
  }
}

// POST: Crear nuevo tipo de contenido
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos requeridos
    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    // Verificar si el nombre ya existe
    const existingType = await db.query(
      'SELECT id FROM package_content_types WHERE name = $1',
      [body.name]
    )

    if (existingType.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un tipo de contenido con este nombre'
      }, { status: 400 })
    }

    const insertQuery = `
      INSERT INTO package_content_types (
        name, icon, description, active, display_order, color
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      RETURNING
        id,
        name,
        icon,
        description,
        active,
        display_order as "displayOrder",
        color,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `

    const values = [
      body.name,
      body.icon || null,
      body.description || null,
      body.active !== undefined ? body.active : true,
      body.displayOrder || 0,
      body.color || '#3B82F6'
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Tipo de contenido creado exitosamente'
    })

  } catch (error) {
    console.error('Error creating package content type:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear tipo de contenido'
    }, { status: 500 })
  }
}

// PUT: Actualizar tipo de contenido existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del tipo de contenido'
      }, { status: 400 })
    }

    // Build UPDATE query dynamically
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping = {
      name: 'name',
      icon: 'icon',
      description: 'description',
      active: 'active',
      displayOrder: 'display_order',
      color: 'color'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key as keyof typeof fieldMapping]) {
        updateFields.push(`${fieldMapping[key as keyof typeof fieldMapping]} = $${valueIndex}`)
        values.push(value)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add id to values
    values.push(id)

    const updateQuery = `
      UPDATE package_content_types
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        name,
        icon,
        description,
        active,
        display_order as "displayOrder",
        color,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el tipo de contenido'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Tipo de contenido actualizado exitosamente'
    })

  } catch (error) {
    console.error('Error updating package content type:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar tipo de contenido'
    }, { status: 500 })
  }
}

// DELETE: Eliminar tipo de contenido (soft delete - marca como inactivo)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del tipo de contenido'
      }, { status: 400 })
    }

    // Soft delete - marcar como inactivo en lugar de eliminar
    const updateQuery = `
      UPDATE package_content_types
      SET active = false
      WHERE id = $1
      RETURNING id
    `

    const result = await db.query(updateQuery, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el tipo de contenido'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Tipo de contenido desactivado exitosamente'
    })

  } catch (error) {
    console.error('Error deleting package content type:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar tipo de contenido'
    }, { status: 500 })
  }
}
