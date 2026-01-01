import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-private-documents'
const URL_EXPIRATION_SECONDS = 3600 // 1 hour

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/order-invoices/[orderId]?type=consignment|purchase
 * Get invoices for an order with signed URLs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const orderType = searchParams.get('type') as 'consignment' | 'purchase'

    if (!orderType || !['consignment', 'purchase'].includes(orderType)) {
      return NextResponse.json({
        success: false,
        error: 'El parametro type es requerido (consignment o purchase)'
      }, { status: 400 })
    }

    // Auth check
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get invoices from database
    const columnName = orderType === 'consignment' ? 'consignment_order_id' : 'purchase_id'
    const result = await db.query(
      `SELECT id, file_name, original_name, storage_path, file_type, file_size, created_at
       FROM order_invoices
       WHERE ${columnName} = $1 AND company_id = $2
       ORDER BY created_at DESC`,
      [parseInt(orderId), payload.companyId]
    )

    // Generate signed URLs for each invoice
    const invoicesWithUrls = await Promise.all(
      result.rows.map(async (invoice) => {
        let signedUrl = null
        try {
          const { data } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(invoice.storage_path, URL_EXPIRATION_SECONDS)

          if (data?.signedUrl) {
            signedUrl = data.signedUrl
          }
        } catch (error) {
          console.error(`[ORDER INVOICES] Error generating signed URL for ${invoice.id}:`, error)
        }

        return {
          id: invoice.id,
          fileName: invoice.file_name,
          originalName: invoice.original_name,
          fileType: invoice.file_type,
          fileSize: invoice.file_size,
          signedUrl,
          createdAt: invoice.created_at
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoicesWithUrls,
        count: invoicesWithUrls.length
      }
    })

  } catch (error: any) {
    console.error('[ORDER INVOICES] Error fetching invoices:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener facturas'
    }, { status: 500 })
  }
}


/**
 * DELETE /api/order-invoices/[orderId]?invoiceId=123
 * Delete a specific invoice
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    if (!invoiceId) {
      return NextResponse.json({
        success: false,
        error: 'invoiceId es requerido'
      }, { status: 400 })
    }

    // Auth check
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get invoice to delete (verify ownership)
    const invoiceResult = await db.query(
      `SELECT id, storage_path FROM order_invoices
       WHERE id = $1 AND company_id = $2`,
      [parseInt(invoiceId), payload.companyId]
    )

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Delete from Supabase Storage
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([invoice.storage_path])

      if (error) {
        console.error('[ORDER INVOICES] Error deleting from storage:', error)
        // Continue to delete from DB anyway
      }
    } catch (storageError) {
      console.error('[ORDER INVOICES] Error deleting from storage:', storageError)
    }

    // Delete from database
    await db.query('DELETE FROM order_invoices WHERE id = $1', [invoice.id])

    return NextResponse.json({
      success: true,
      message: 'Factura eliminada'
    })

  } catch (error: any) {
    console.error('[ORDER INVOICES] Error deleting invoice:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al eliminar factura'
    }, { status: 500 })
  }
}
