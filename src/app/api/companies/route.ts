import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import {
  inheritFeesFromParent,
  getParentEnabledServices,
  validateBranchServices,
  getParentSubdomain,
  getParentContactInfo
} from '@/lib/branch-utils'

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
        c.label_logo_url as "labelLogoUrl",
        c.subdomain,
        c.primary_color as "primaryColor",
        c.secondary_color as "secondaryColor",
        c.status,
        c.createdat as "createdAt",
        c.parent_company_id as "parentCompanyId",
        c.is_branch as "isBranch",
        c.is_provider as "isProvider",
        c.provider_type as "providerType",
        c.provider_categories as "providerCategories",
        c.provider_services as "providerServices",
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
      labelLogoUrl,
      subdomain,
      primaryColor,
      secondaryColor,
      parentCompanyId,
      isBranch,
      isProvider,
      providerType,
      providerCategories,
      providerServices,
      // Campos para Brokers y coordenadas
      latitude,
      longitude,
      broker_province,
      broker_municipality,
      broker_address,
      broker_delivery_start,
      broker_delivery_end,
      broker_contact_phone,
      broker_bank_accounts
    } = body

    // Log para depurar datos de broker
    console.log('[Companies API] Datos de broker recibidos:', {
      companyType,
      latitude,
      longitude,
      broker_province,
      broker_municipality,
      broker_address,
      broker_delivery_start,
      broker_delivery_end,
      broker_contact_phone
    })

    // Validaciones básicas
    if (!legalName || !phone || !address || !city || !country || !einNumber) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Variables para almacenar configuración final
    let finalServiceFees: any
    let finalEnabledServices = enabledServices || []
    let finalSubdomain = subdomain
    let finalCustomerServicePhone = customerServicePhone
    let finalWebsite = website

    // Si es una sucursal, heredar configuración de la empresa matriz
    if (isBranch && parentCompanyId) {
      console.log(`[BRANCH] Creando sucursal para empresa matriz ID: ${parentCompanyId}`)

      // 1. Heredar fees de la empresa matriz (las sucursales NO configuran sus propios fees)
      const parentFees = await inheritFeesFromParent(parentCompanyId)
      if (!parentFees) {
        return NextResponse.json({
          success: false,
          error: 'No se pudieron obtener los fees de la empresa matriz'
        }, { status: 400 })
      }
      finalServiceFees = parentFees
      console.log('[BRANCH] Fees heredados de empresa matriz')

      // 2. Validar que los servicios sean un subset de los de la empresa matriz
      const parentServices = await getParentEnabledServices(parentCompanyId)
      const validation = validateBranchServices(finalEnabledServices, parentServices)

      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: `Los siguientes servicios no están habilitados en la empresa matriz: ${validation.invalidServices.join(', ')}`
        }, { status: 400 })
      }
      console.log('[BRANCH] Servicios validados contra empresa matriz')

      // 3. Las sucursales usan el MISMO subdominio que la empresa matriz
      const parentSubdomain = await getParentSubdomain(parentCompanyId)
      finalSubdomain = parentSubdomain
      console.log(`[BRANCH] Subdominio copiado de empresa matriz: ${finalSubdomain}`)

      // 4. Las sucursales usan el MISMO teléfono de soporte y website que la empresa matriz
      const parentContact = await getParentContactInfo(parentCompanyId)
      finalCustomerServicePhone = parentContact.customerServicePhone
      finalWebsite = parentContact.website
      console.log(`[BRANCH] Teléfono de soporte copiado: ${finalCustomerServicePhone}`)
      console.log(`[BRANCH] Website copiado: ${finalWebsite}`)

    } else {
      // Es una empresa matriz o independiente
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
        finalServiceFees = serviceFeesFormatted
      } else {
        // Valores por defecto para todos los servicios
        const defaultFees = { percentage: 0, fixed: 0 }
        finalServiceFees = {
          wallet: defaultFees,
          recharge: defaultFees,
          remittance: defaultFees,
          paqueteria: defaultFees,
          tracker: defaultFees,
          exchange: defaultFees,
          marketplace: defaultFees
        }
      }
    }

    const query = `
      INSERT INTO companies (
        legalname, einnumber, phone, customer_service_phone, email, website, address, city, state, country, zipcode,
        walletnumber, currency, ismulticurrency, secondarycurrencies,
        haslimits, dailylimit, monthlylimit, companytype, enabledservices,
        service_fees, logo_url, label_logo_url, subdomain, primary_color, secondary_color,
        parent_company_id, is_branch,
        is_provider, provider_type, provider_categories, provider_services,
        latitude, longitude, broker_province, broker_municipality, broker_address,
        broker_delivery_hours, broker_contact_phone, broker_bank_accounts,
        status, createdat, walletbalance, transactionscount, userscount
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26,
        $27, $28,
        $29, $30, $31, $32,
        $33, $34, $35, $36, $37,
        $38, $39, $40,
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

    // Combinar horarios de entrega si están definidos
    const brokerDeliveryHours = broker_delivery_start && broker_delivery_end
      ? `${broker_delivery_start} - ${broker_delivery_end}`
      : null

    const values = [
      legalName,
      einNumber,
      phone,
      finalCustomerServicePhone || null, // Usar phone de soporte heredado o configurado
      email || '',
      finalWebsite || null, // Usar website heredado o configurado
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
      JSON.stringify(finalEnabledServices), // Usar servicios validados
      JSON.stringify(finalServiceFees), // Usar fees heredados o configurados
      logoUrl || null,
      labelLogoUrl || null,
      finalSubdomain, // Usar subdominio heredado o configurado
      primaryColor || '#CC0A46',
      secondaryColor || '#0A46CC',
      parentCompanyId || null,
      isBranch || false,
      isProvider || false,
      providerType || null,
      JSON.stringify(providerCategories || []),
      JSON.stringify(providerServices || []),
      // Campos para Brokers y coordenadas
      latitude || null,
      longitude || null,
      broker_province || null,
      broker_municipality || null,
      broker_address || null,
      brokerDeliveryHours,
      broker_contact_phone || null,
      JSON.stringify(broker_bank_accounts || [])
    ]

    // Log para depurar valores de broker que se van a insertar
    console.log('[Companies API] Valores de broker a insertar:', {
      latitude: values[32],
      longitude: values[33],
      broker_province: values[34],
      broker_municipality: values[35],
      broker_address: values[36],
      brokerDeliveryHours: values[37],
      broker_contact_phone: values[38]
    })

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
