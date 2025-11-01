import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanies } from '@/lib/database'

// GET: Obtener todas las empresas
export async function GET(request: NextRequest) {
  try {
    const companies = getAllCompanies()

    return NextResponse.json({
      success: true,
      data: companies
    })

  } catch (error) {
    console.error('Error getting companies:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener empresas'
    }, { status: 500 })
  }
}