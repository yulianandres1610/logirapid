import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/companies/[id]
 * Obtiene los datos de una empresa específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de empresa inválido' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        phone,
        customer_service_phone as "customerServicePhone",
        email,
        website,
        address,
        city,
        state,
        country,
        zipcode as "zipCode",
        walletnumber as "walletNumber",
        currency,
        ismulticurrency as "isMultiCurrency",
        secondarycurrencies as "secondaryCurrencies",
        haslimits as "hasLimits",
        dailylimit as "dailyLimit",
        monthlylimit as "monthlyLimit",
        companytype as "companyType",
        enabledservices as "enabledServices",
        service_fees as "serviceFees",
        walletbalance as "walletBalance",
        transactionscount as "transactionsCount",
        userscount as "usersCount",
        logo_url as "logoUrl",
        subdomain,
        primary_color as "primaryColor",
        secondary_color as "secondaryColor",
        status,
        createdat as "createdAt"
      FROM companies
      WHERE id = $1
    `

    const result = await db.query(query, [companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/companies/[id]
 * Actualiza una empresa completa o solo el status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)
    const body = await request.json()

    if (isNaN(companyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de empresa inválido' },
        { status: 400 }
      )
    }

    const checkResult = await db.query(
      'SELECT id, legalname, status FROM companies WHERE id = $1',
      [companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    // Si solo se envía status, actualizar solo eso (caso simple)
    if (body.status && Object.keys(body).length === 1) {
      const newStatus = body.status

      if (!['active', 'inactive'].includes(newStatus)) {
        return NextResponse.json(
          { success: false, error: 'Status inválido' },
          { status: 400 }
        )
      }

      await db.query(
        'UPDATE companies SET status = $1 WHERE id = $2',
        [newStatus, companyId]
      )

      return NextResponse.json({
        success: true,
        message: `Empresa ${newStatus === 'active' ? 'activada' : 'desactivada'} exitosamente`
      })
    }

    // Actualización completa de la empresa
    const updateFields: string[] = []
    const values: any[] = []
    let paramCounter = 1

    // Mapeo de campos del frontend a columnas de la BD
    const fieldMapping: Record<string, string> = {
      legalName: 'legalname',
      einNumber: 'einnumber',
      phone: 'phone',
      customerServicePhone: 'customer_service_phone',
      email: 'email',
      website: 'website',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      zipCode: 'zipcode',
      walletNumber: 'walletnumber',
      currency: 'currency',
      isMultiCurrency: 'ismulticurrency',
      secondaryCurrencies: 'secondarycurrencies',
      hasLimits: 'haslimits',
      dailyLimit: 'dailylimit',
      monthlyLimit: 'monthlylimit',
      companyType: 'companytype',
      enabledServices: 'enabledservices',
      serviceFees: 'service_fees',
      logoUrl: 'logo_url',
      subdomain: 'subdomain',
      primaryColor: 'primary_color',
      secondaryColor: 'secondary_color',
      status: 'status'
    }

    // Construir query dinámicamente
    for (const [frontendKey, dbColumn] of Object.entries(fieldMapping)) {
      if (body[frontendKey] !== undefined) {
        updateFields.push(`${dbColumn} = $${paramCounter}`)

        // Convertir valores según tipo
        let value = body[frontendKey]

        // Convertir arrays y objetos a JSON para PostgreSQL
        if (['secondaryCurrencies', 'enabledServices', 'serviceFees', 'prices'].includes(frontendKey)) {
          value = JSON.stringify(value)
        }

        values.push(value)
        paramCounter++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      )
    }

    // Agregar companyId al final
    values.push(companyId)

    const updateQuery = `
      UPDATE companies
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING id, legalname
    `

    console.log('[PUT /api/companies/:id] Updating company:', companyId)
    console.log('[PUT /api/companies/:id] Fields:', updateFields)

    const result = await db.query(updateQuery, values)

    return NextResponse.json({
      success: true,
      message: 'Empresa actualizada exitosamente',
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error in PUT /api/companies/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      )
    }

    const checkResult = await db.query(
      'SELECT id, legalname, status FROM companies WHERE id = $1',
      [companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    const company = checkResult.rows[0]

    if (company.status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden eliminar empresas inactivas' },
        { status: 400 }
      )
    }

    const usersCheck = await db.query(
      'SELECT COUNT(*) as count FROM user_companies WHERE companyid = $1',
      [companyId]
    )

    const ordersCheck = await db.query(
      'SELECT COUNT(*) as count FROM package_orders WHERE companyid = $1',
      [companyId]
    )

    if (parseInt(usersCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar. Tiene ${usersCheck.rows[0].count} usuarios` },
        { status: 400 }
      )
    }

    if (parseInt(ordersCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar. Tiene ${ordersCheck.rows[0].count} órdenes` },
        { status: 400 }
      )
    }

    await db.query('DELETE FROM companies WHERE id = $1', [companyId])

    return NextResponse.json({
      success: true,
      message: 'Empresa eliminada exitosamente'
    })
  } catch (error) {
    console.error('Error in DELETE /api/companies/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}