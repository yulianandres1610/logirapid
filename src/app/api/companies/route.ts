import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todas las empresas
export async function GET(request: NextRequest) {
  try {
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
      ORDER BY legalname ASC
    `

    const result = await db.query(query)

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

// POST: Crear una nueva empresa
export async function POST(request: NextRequest) {
  try {
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
      secondaryColor
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
        legalname, einnumber, phone, customer_service_phone, email, address, city, state, country, zipcode,
        walletnumber, currency, ismulticurrency, secondarycurrencies,
        haslimits, dailylimit, monthlylimit, companytype, enabledservices,
        service_fees, logo_url, subdomain, primary_color, secondary_color,
        status, createdat, walletbalance, transactionscount, userscount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24,
        'active', NOW(), 0, 0, 0
      ) RETURNING
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        logo_url as "logoUrl",
        createdat as "createdAt"
    `

    const values = [
      legalName, einNumber, phone, customerServicePhone || null, email || '', address, city, state || '', country, zipCode || '',
      walletNumber || '', currency || 'USD', isMultiCurrency || false, JSON.stringify(secondaryCurrencies || []),
      hasLimits || false, dailyLimit || 0, monthlyLimit || 0, companyType || 'agency', JSON.stringify(enabledServices || []),
      JSON.stringify(serviceFeesFormatted), logoUrl || null, subdomain || null, primaryColor || '#CC0A46', secondaryColor || '#0A46CC'
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