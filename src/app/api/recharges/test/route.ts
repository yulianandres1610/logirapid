import { NextResponse } from 'next/server'
import { getUnivCellClient } from '@/lib/univcell-client'

export async function GET() {
  const results: Record<string, any> = {
    configStatus: null,
    credits: { success: false, data: null, error: null },
    products: { success: false, data: null, error: null },
    promotions: { success: false, data: null, error: null },
    countries: { success: false, data: null, error: null },
  }

  try {
    const client = getUnivCellClient()

    // Check configuration
    results.configStatus = client.getConfigStatus()
    console.log('[UnivCell Test] Config status:', results.configStatus)

    if (!client.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'UnivCell API no está configurado. Asegurate de tener UNIVCELL_API_TOKEN o UNIVCELL_USERNAME/PASSWORD',
        results,
      })
    }

    // 1. Try to get credits (doesn't require user ID)
    console.log('[UnivCell Test] Testing /credits endpoint...')
    try {
      const credits = await client.getCredits()
      results.credits = { success: true, data: credits, error: null }
      console.log('[UnivCell Test] Credits:', credits)
    } catch (error: any) {
      results.credits = { success: false, data: null, error: error.message }
      console.log('[UnivCell Test] Credits error:', error.message)
    }

    // 2. Try to get available countries
    console.log('[UnivCell Test] Testing /countries/availability endpoint...')
    try {
      const countries = await client.getAvailableCountries()
      results.countries = {
        success: true,
        data: countries?.slice(0, 10),
        count: countries?.length,
        error: null
      }
      console.log('[UnivCell Test] Countries:', countries?.length)
    } catch (error: any) {
      results.countries = { success: false, data: null, error: error.message }
      console.log('[UnivCell Test] Countries error:', error.message)
    }

    // 2b. Try to get products by country (Cuba)
    console.log('[UnivCell Test] Testing /products/countries/CU endpoint...')
    try {
      const cubaProducts = await client.getProductsByCountry('CU')
      results.cubaProducts = {
        success: true,
        data: cubaProducts?.slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          description: p.description?.substring(0, 100),
        })),
        count: cubaProducts?.length,
        error: null
      }
      console.log('[UnivCell Test] Cuba Products:', cubaProducts?.length)
    } catch (error: any) {
      results.cubaProducts = { success: false, data: null, error: error.message }
      console.log('[UnivCell Test] Cuba Products error:', error.message)
    }

    // 3. Try to get products (requires user ID)
    console.log('[UnivCell Test] Testing products endpoint...')
    try {
      const products = await client.getProducts()
      results.products = {
        success: true,
        data: products?.slice(0, 5).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          country: p.country?.name || p.country_id,
        })),
        count: products?.length,
        error: null
      }
      console.log('[UnivCell Test] Products:', products?.length)
    } catch (error: any) {
      results.products = { success: false, data: null, error: error.message }
      console.log('[UnivCell Test] Products error:', error.message)
    }

    // 4. Try to get promotions
    console.log('[UnivCell Test] Testing promotions endpoint...')
    try {
      const promotions = await client.getPromotions()
      results.promotions = {
        success: true,
        data: promotions?.slice(0, 5),
        count: promotions?.length,
        error: null
      }
      console.log('[UnivCell Test] Promotions:', promotions?.length)
    } catch (error: any) {
      results.promotions = { success: false, data: null, error: error.message }
      console.log('[UnivCell Test] Promotions error:', error.message)
    }

    // Determine overall success
    const anySuccess = results.credits.success || results.products.success || results.countries.success

    return NextResponse.json({
      success: anySuccess,
      message: anySuccess
        ? 'Conexión parcial o completa con UnivCell API'
        : 'No se pudo conectar con ningún endpoint de UnivCell',
      results,
    })
  } catch (error: any) {
    console.error('[UnivCell Test] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error conectando con UnivCell',
        results,
      },
      { status: 500 }
    )
  }
}
