import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { generateDocument } from '@/lib/print-generators'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (!authToken) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    let payload: JWTPayload
    try {
      payload = jwt.verify(authToken, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    const body = await request.json()
    const { documentType, documentData } = body

    if (!documentType || !documentData) {
      return NextResponse.json({ success: false, error: 'documentType y documentData son requeridos' }, { status: 400 })
    }

    // Inject brand data
    const enrichedData = { ...documentData }
    if (!enrichedData.brandPrimaryColor || !enrichedData.brandDisplayName) {
      try {
        const companyResult = await db.query(
          'SELECT name, logo_url, primary_color FROM companies WHERE id = $1',
          [payload.companyId]
        )
        if (companyResult.rows.length > 0) {
          const company = companyResult.rows[0]
          if (!enrichedData.brandDisplayName) enrichedData.brandDisplayName = company.name
          if (!enrichedData.brandPrimaryColor && company.primary_color) enrichedData.brandPrimaryColor = company.primary_color
          if (!enrichedData.brandLogo && company.logo_url) enrichedData.brandLogo = company.logo_url
        }
      } catch {}
    }

    // Generate as PDF (standard printer)
    const result = await generateDocument(documentType, enrichedData, 'standard')

    if (result.format !== 'pdf') {
      return NextResponse.json({ success: false, error: 'Solo se puede previsualizar documentos PDF' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: { pdf: result.data, format: 'pdf' }
    })
  } catch (error) {
    console.error('[Print Jobs Preview]', error)
    return NextResponse.json({ success: false, error: 'Error al generar preview: ' + String(error) }, { status: 500 })
  }
}
