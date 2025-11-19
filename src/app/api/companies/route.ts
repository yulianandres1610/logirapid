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
        walletbalance as "walletBalance",
        transactionscount as "transactionsCount",
        userscount as "usersCount",
        logo_url as "logoUrl",
        subdomain,
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
      logoUrl,
      subdomain
    } = body

    // Validaciones básicas
    if (!legalName || !phone || !address || !city || !country || !einNumber) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    const query = `
      INSERT INTO companies (
        legalname, einnumber, phone, email, address, city, state, country, zipcode,
        walletnumber, currency, ismulticurrency, secondarycurrencies,
        haslimits, dailylimit, monthlylimit, companytype, enabledservices,
        logo_url, subdomain, status, createdat, walletbalance, transactionscount, userscount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, 'active', NOW(), 0, 0, 0
      ) RETURNING
        id,
        legalname as "legalName",
        einnumber as "einNumber",
        logo_url as "logoUrl",
        createdat as "createdAt"
    `

    const values = [
      legalName, einNumber, phone, email || '', address, city, state || '', country, zipCode || '',
      walletNumber || '', currency || 'USD', isMultiCurrency || false, JSON.stringify(secondaryCurrencies || []),
      hasLimits || false, dailyLimit || 0, monthlyLimit || 0, companyType || 'agency', JSON.stringify(enabledServices || []),
      logoUrl || null, subdomain || null
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