import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUnivCellClient } from '@/lib/univcell-client'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    // Only SUPER_ADMIN can see credits
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const client = getUnivCellClient()

    if (!client.isConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          credits: null,
          currency: 'USD',
          configured: false,
          message: 'UnivCell API no esta configurado',
        },
      })
    }

    try {
      const credits = await client.getCredits()

      return NextResponse.json({
        success: true,
        data: {
          credits,
          currency: 'USD',
          configured: true,
        },
      })
    } catch (apiError: any) {
      console.error('[UnivCell Credits API Error]:', apiError)
      return NextResponse.json({
        success: true,
        data: {
          credits: null,
          currency: 'USD',
          configured: true,
          error: apiError.message,
        },
      })
    }
  } catch (error: any) {
    console.error('[Recharge Credits Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo creditos',
      },
      { status: 500 }
    )
  }
}
