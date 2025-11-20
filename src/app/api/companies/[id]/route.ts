import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET: Obtener una empresa por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const query = `
      SELECT
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        phone,
        customer_service_phone as "customerServicePhone",
        email,
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

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error getting company:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener empresa'
    }, { status: 500 })
  }
}

// PUT: Actualizar una empresa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      legalName,
      einNumber,
      phone,
      customerServicePhone,
      email,
      address,
      city,
      state,
      country,
      zipCode,
      currency,
      isMultiCurrency,
      secondaryCurrencies,
      hasLimits,
      dailyLimit,
      monthlyLimit,
      companyType,
      enabledServices,
      serviceFees,
      logoUrl,
      subdomain,
      primaryColor,
      secondaryColor,
      status
    } = body

    // Convertir serviceFees al formato JSONB esperado
    const serviceFeesFormatted: any = {}
    if (serviceFees && typeof serviceFees === 'object') {
      Object.keys(serviceFees).forEach(serviceId => {
        const fee = serviceFees[serviceId]
        serviceFeesFormatted[serviceId] = {
          percentage: fee.percentage || 0,
          fixed: fee.fixed || 0
        }
      })
    }

    const query = `
      UPDATE companies SET
        legalname = $1,
        einnumber = $2,
        phone = $3,
        customer_service_phone = $4,
        email = $5,
        address = $6,
        city = $7,
        state = $8,
        country = $9,
        zipcode = $10,
        currency = $11,
        ismulticurrency = $12,
        secondarycurrencies = $13,
        haslimits = $14,
        dailylimit = $15,
        monthlylimit = $16,
        companytype = $17,
        enabledservices = $18,
        service_fees = $19,
        logo_url = $20,
        subdomain = $21,
        primary_color = $22,
        secondary_color = $23,
        status = $24
      WHERE id = $25
      RETURNING
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        logo_url as "logoUrl"
    `

    const values = [
      legalName,
      einNumber,
      phone,
      customerServicePhone || null,
      email || '',
      address,
      city,
      state || '',
      country,
      zipCode || '',
      currency || 'USD',
      isMultiCurrency || false,
      JSON.stringify(secondaryCurrencies || []),
      hasLimits || false,
      dailyLimit || 0,
      monthlyLimit || 0,
      companyType || 'agency',
      JSON.stringify(enabledServices || []),
      JSON.stringify(serviceFeesFormatted),
      logoUrl || null,
      subdomain || null,
      primaryColor || '#CC0A46',
      secondaryColor || '#0A46CC',
      status || 'active',
      id
    ]

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('Error updating company:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al actualizar empresa'
    }, { status: 500 })
  }
}

// DELETE: Eliminar (soft delete) una empresa
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verificar si la empresa tiene usuarios activos
    const usersCheck = await db.query(
      'SELECT COUNT(*) as count FROM user_companies WHERE companyId = $1',
      [id]
    )

    const userCount = parseInt(usersCheck.rows[0]?.count || '0')

    if (userCount > 0) {
      return NextResponse.json({
        success: false,
        error: `No se puede eliminar la empresa. Tiene ${userCount} usuario(s) asociado(s).`
      }, { status: 400 })
    }

    // Soft delete - cambiar status a inactive
    const query = `
      UPDATE companies
      SET status = 'inactive'
      WHERE id = $1
      RETURNING id
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Empresa eliminada exitosamente'
    })

  } catch (error: any) {
    console.error('Error deleting company:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al eliminar empresa'
    }, { status: 500 })
  }
}
