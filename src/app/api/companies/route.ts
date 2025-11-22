import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todas las empresas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')
    const includeBranches = searchParams.get('includeBranches') === 'true'

    let query = `
      SELECT
        c.id,
        c.legalname as "legalName",
        c.einnumber as "einNumber",
        c.phone,
        c.customer_service_phone as "customerServicePhone",
        c.email,
        c.website,
        c.address,
        c.city,
        c.state,
        c.country,
        c.zipcode as "zipCode",
        c.walletnumber as "walletNumber",
        c.currency,
        c.ismulticurrency as "isMultiCurrency",
        c.secondarycurrencies as "secondaryCurrencies",
        c.haslimits as "hasLimits",
        c.dailylimit as "dailyLimit",
        c.monthlylimit as "monthlyLimit",
        c.companytype as "companyType",
        c.enabledservices as "enabledServices",
        c.service_fees as "serviceFees",
        c.walletbalance as "walletBalance",
        c.transactionscount as "transactionsCount",
        c.userscount as "usersCount",
        c.logo_url as "logoUrl",
        c.subdomain,
        c.primary_color as "primaryColor",
        c.secondary_color as "secondaryColor",
        c.status,
        c.createdat as "createdAt",
        c.parent_company_id as "parentCompanyId",
        c.is_branch as "isBranch",
        parent.legalname as "parentCompanyName"
      FROM companies c
      LEFT JOIN companies parent ON c.parent_company_id = parent.id
    `

    // Filtrar por empresa matriz si se especifica
    if (parentId) {
      query += ` WHERE c.parent_company_id = $1`
    } else if (!includeBranches) {
      // Si no se especifica parentId y no se quieren incluir sucursales,
      // solo mostrar empresas principales (sin parent_company_id)
      query += ` WHERE c.parent_company_id IS NULL`
    }

    query += ` ORDER BY c.legalname ASC`

    const result = parentId
      ? await db.query(query, [parentId])
      : await db.query(query)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting companies:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener empresas'
    }, { status: 500 })
  }
}

// POST: Crear una nueva empresa o sucursal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      legalName,
      einNumber,
      phone,
      customerServicePhone,
      email,
      website,
      address,
      city,
      state,
      country,
      zipCode,
      walletNumber,
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
      parentCompanyId,
      isBranch
    } = body

    // Validaciones básicas
    if (!legalName || !phone || !address || !city || !country || !einNumber) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Convertir serviceFees al formato JSONB esperado por PostgreSQL
    const serviceFeesFormatted: any = {}
    if (serviceFees && typeof serviceFees === 'object') {
      Object.keys(serviceFees).forEach(serviceId => {
        const fee = serviceFees[serviceId]
        serviceFeesFormatted[serviceId] = {
          percentage: fee.percentage || 0,
          fixed: fee.fixed || 0
        }
      })
    } else {
      // Valores por defecto para todos los servicios
      const defaultFees = { percentage: 0, fixed: 0 }
      serviceFeesFormatted.wallet = defaultFees
      serviceFeesFormatted.recharge = defaultFees
      serviceFeesFormatted.remittance = defaultFees
      serviceFeesFormatted.paqueteria = defaultFees
      serviceFeesFormatted.tracker = defaultFees
      serviceFeesFormatted.exchange = defaultFees
      serviceFeesFormatted.marketplace = defaultFees
    }

    const query = `
      INSERT INTO companies (
        legalname, einnumber, phone, customer_service_phone, email, website, address, city, state, country, zipcode,
        walletnumber, currency, ismulticurrency, secondarycurrencies,
        haslimits, dailylimit, monthlylimit, companytype, enabledservices,
        service_fees, logo_url, subdomain, primary_color, secondary_color,
        parent_company_id, is_branch,
        status, createdat, walletbalance, transactionscount, userscount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27,
        'active', NOW(), 0, 0, 0
      ) RETURNING
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        logo_url as "logoUrl",
        parent_company_id as "parentCompanyId",
        is_branch as "isBranch",
        createdat as "createdAt"
    `

    const values = [
      legalName,
      einNumber,
      phone,
      customerServicePhone || null,
      email || '',
      website || null,
      address,
      city,
      state || '',
      country,
      zipCode || '',
      walletNumber || '',
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
      parentCompanyId || null,
      isBranch || false
    ]

    const result = await db.query(query, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('Error creating company:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al crear empresa'
    }, { status: 500 })
  }
}
