import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Configurar cliente Supabase para URLs firmadas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-private-documents'

/**
 * GET /api/tracker
 * Búsqueda unificada de órdenes y empaques para el rastreador del call center
 *
 * Query params:
 * - q: término de búsqueda
 * - type: 'order' | 'phone' | 'empaque' | 'customer' | 'auto' (auto-detecta)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    const query = searchParams.get('q')?.trim()
    let searchType = searchParams.get('type') || 'auto'

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un término de búsqueda' },
        { status: 400 }
      )
    }

    // Normalize query: collapse multiple spaces into one
    const normalizedQuery = query.replace(/\s+/g, ' ')

    // Auto-detect search type based on query format
    if (searchType === 'auto') {
      if (/^(ORD|PKG|RET|DEL|OFF|PICKUP)\d*/i.test(normalizedQuery)) {
        searchType = 'order'
      } else if (/^(EMP|BOX)-/i.test(normalizedQuery)) {
        searchType = 'empaque'
      } else if (/^\+?\d[\d\s-]{6,}$/.test(normalizedQuery.replace(/\s/g, ''))) {
        searchType = 'phone'
      } else {
        searchType = 'customer'
      }
    }

    let orderResult = null
    let empaqueResult = null

    // Build company filter
    const companyFilter = !isSuperAdmin && companyId
      ? 'AND po.company_id = $2'
      : ''
    const companyParams = !isSuperAdmin && companyId ? [companyId] : []

    // Search based on type
    if (searchType === 'order' || searchType === 'auto') {
      // Search by order number
      const orderQuery = `
        SELECT
          po.id,
          po.ordernumber as "orderNumber",
          po.order_type as "orderType",
          po.status,
          po.customername as "customerName",
          po.firstname as "firstName",
          po.lastname as "lastName",
          po.phone,
          po.email,
          po.street,
          po.apartment,
          po.city,
          po.state,
          po.zipcode,
          po.country,
          po.address,
          po.customeraddress as "customerAddress",
          po.services,
          po.subtotal,
          po.taxamount as "taxAmount",
          po.totalamount as "totalAmount",
          po.boxcount as "boxCount",
          po.boxprice as "boxPrice",
          po.scheduleddate as "scheduledDate",
          po.timeslot as "timeSlot",
          po.warehouse_id as "warehouseId",
          po.warehouse_name as "warehouseName",
          po.routeid as "routeId",
          po.stopnumber as "stopNumber",
          po.latitude,
          po.longitude,
          po.notes,
          po.customernotes as "customerNotes",
          po.createdat as "createdAt",
          po.updatedat as "updatedAt",
          po.createdby as "createdBy",
          po.paymentmethod as "paymentMethod",
          po.boxes_delivered as "boxesDelivered",
          po.boxes_returned as "boxesReturned",
          po.pending_return as "pendingReturn",
          po.return_status as "returnStatus",
          po.parent_order_id as "parentOrderId",
          po.customerid as "customerId",
          po.company_id as "companyId",
          c.legalname as "companyName"
        FROM package_orders po
        LEFT JOIN companies c ON po.company_id = c.id
        WHERE UPPER(po.ordernumber) = UPPER($1)
        ${companyFilter}
        LIMIT 1
      `

      const result = await db.query(orderQuery, [query, ...companyParams])
      if (result.rows.length > 0) {
        orderResult = result.rows[0]
      }
    }

    if (searchType === 'phone' || (searchType === 'auto' && !orderResult)) {
      // Search by phone number
      const phoneClean = query.replace(/[\s-]/g, '')
      const phoneQuery = `
        SELECT
          po.id,
          po.ordernumber as "orderNumber",
          po.order_type as "orderType",
          po.status,
          po.customername as "customerName",
          po.firstname as "firstName",
          po.lastname as "lastName",
          po.phone,
          po.email,
          po.street,
          po.apartment,
          po.city,
          po.state,
          po.zipcode,
          po.country,
          po.address,
          po.customeraddress as "customerAddress",
          po.services,
          po.subtotal,
          po.taxamount as "taxAmount",
          po.totalamount as "totalAmount",
          po.boxcount as "boxCount",
          po.scheduleddate as "scheduledDate",
          po.timeslot as "timeSlot",
          po.warehouse_name as "warehouseName",
          po.latitude,
          po.longitude,
          po.notes,
          po.createdat as "createdAt",
          po.updatedat as "updatedAt",
          po.createdby as "createdBy",
          po.customerid as "customerId",
          po.company_id as "companyId",
          c.legalname as "companyName"
        FROM package_orders po
        LEFT JOIN companies c ON po.company_id = c.id
        WHERE REPLACE(REPLACE(po.phone, '-', ''), ' ', '') LIKE '%' || $1 || '%'
        ${companyFilter}
        ORDER BY po.createdat DESC
        LIMIT 1
      `

      const result = await db.query(phoneQuery, [phoneClean, ...companyParams])
      if (result.rows.length > 0) {
        orderResult = result.rows[0]
      }
    }

    if (searchType === 'empaque' || (searchType === 'auto' && !orderResult)) {
      // Search by empaque code
      const empaqueQuery = `
        SELECT
          e.id,
          e.codigo,
          e.tipo,
          e.box_type as "boxType",
          e.estado,
          e.cliente_id as "clienteId",
          e.orden_id as "ordenId",
          e.delivery_order_id as "deliveryOrderId",
          e.return_order_id as "returnOrderId",
          e.delivered_at as "deliveredAt",
          e.returned_at as "returnedAt",
          e.fecha_asignacion as "fechaAsignacion",
          e.descripcion,
          e.warehouse_name as "warehouseName",
          e.driver_name as "driverName",
          e.recipient_name as "recipientName",
          e.created_at as "createdAt",
          po.ordernumber as "orderNumber",
          po.customername as "customerName",
          po.phone as "customerPhone",
          po.status as "orderStatus"
        FROM empaques e
        LEFT JOIN package_orders po ON e.orden_id = po.id OR e.delivery_order_id = po.id
        WHERE UPPER(e.codigo) = UPPER($1)
        LIMIT 1
      `

      const result = await db.query(empaqueQuery, [query])
      if (result.rows.length > 0) {
        empaqueResult = result.rows[0]

        // If we found an empaque with an order, fetch the full order details
        if (empaqueResult.ordenId || empaqueResult.deliveryOrderId) {
          const orderId = empaqueResult.ordenId || empaqueResult.deliveryOrderId
          const orderDetailQuery = `
            SELECT
              po.id,
              po.ordernumber as "orderNumber",
              po.order_type as "orderType",
              po.status,
              po.customername as "customerName",
              po.firstname as "firstName",
              po.lastname as "lastName",
              po.phone,
              po.email,
              po.street,
              po.apartment,
              po.city,
              po.state,
              po.zipcode,
              po.country,
              po.address,
              po.customeraddress as "customerAddress",
              po.services,
              po.subtotal,
              po.taxamount as "taxAmount",
              po.totalamount as "totalAmount",
              po.scheduleddate as "scheduledDate",
              po.timeslot as "timeSlot",
              po.warehouse_name as "warehouseName",
              po.createdat as "createdAt",
              po.updatedat as "updatedAt",
              po.createdby as "createdBy",
              po.customerid as "customerId",
              c.legalname as "companyName"
            FROM package_orders po
            LEFT JOIN companies c ON po.company_id = c.id
            WHERE po.id = $1
            LIMIT 1
          `
          const orderDetailResult = await db.query(orderDetailQuery, [orderId])
          if (orderDetailResult.rows.length > 0) {
            orderResult = orderDetailResult.rows[0]
          }
        }
      }
    }

    if (searchType === 'customer' || (searchType === 'auto' && !orderResult && !empaqueResult)) {
      // Search by customer name - normalize spaces in database fields too
      const customerQuery = `
        SELECT
          po.id,
          po.ordernumber as "orderNumber",
          po.order_type as "orderType",
          po.status,
          po.customername as "customerName",
          po.firstname as "firstName",
          po.lastname as "lastName",
          po.phone,
          po.email,
          po.street,
          po.apartment,
          po.city,
          po.state,
          po.zipcode,
          po.country,
          po.address,
          po.customeraddress as "customerAddress",
          po.services,
          po.subtotal,
          po.taxamount as "taxAmount",
          po.totalamount as "totalAmount",
          po.scheduleddate as "scheduledDate",
          po.timeslot as "timeSlot",
          po.warehouse_name as "warehouseName",
          po.createdat as "createdAt",
          po.updatedat as "updatedAt",
          po.createdby as "createdBy",
          po.customerid as "customerId",
          po.company_id as "companyId",
          c.legalname as "companyName"
        FROM package_orders po
        LEFT JOIN companies c ON po.company_id = c.id
        WHERE (
          REGEXP_REPLACE(po.customername, '\\s+', ' ', 'g') ILIKE '%' || $1 || '%' OR
          TRIM(po.firstname) ILIKE '%' || $1 || '%' OR
          TRIM(po.lastname) ILIKE '%' || $1 || '%' OR
          REGEXP_REPLACE(CONCAT(TRIM(po.firstname), ' ', TRIM(po.lastname)), '\\s+', ' ', 'g') ILIKE '%' || $1 || '%'
        )
        ${companyFilter}
        ORDER BY po.createdat DESC
        LIMIT 1
      `

      const result = await db.query(customerQuery, [normalizedQuery, ...companyParams])
      if (result.rows.length > 0) {
        orderResult = result.rows[0]
      }
    }

    // If no results found
    if (!orderResult && !empaqueResult) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No se encontraron resultados para la búsqueda'
      })
    }

    // Fetch associated empaques for the order
    let empaques: any[] = []
    if (orderResult) {
      const empaquesQuery = `
        SELECT
          e.id,
          e.codigo,
          e.tipo,
          e.box_type as "boxType",
          e.estado,
          e.delivered_at as "deliveredAt",
          e.returned_at as "returnedAt",
          e.warehouse_name as "warehouseName",
          e.driver_name as "driverName",
          e.recipient_name as "recipientName"
        FROM empaques e
        WHERE e.orden_id = $1 OR e.delivery_order_id = $1 OR e.return_order_id = $1
        ORDER BY e.created_at DESC
      `
      const empaquesResult = await db.query(empaquesQuery, [orderResult.id])
      empaques = empaquesResult.rows
    } else if (empaqueResult) {
      empaques = [{
        id: empaqueResult.id,
        codigo: empaqueResult.codigo,
        tipo: empaqueResult.tipo,
        boxType: empaqueResult.boxType,
        estado: empaqueResult.estado,
        deliveredAt: empaqueResult.deliveredAt,
        returnedAt: empaqueResult.returnedAt,
        warehouseName: empaqueResult.warehouseName,
        driverName: empaqueResult.driverName,
        recipientName: empaqueResult.recipientName
      }]
    }

    // Build timeline from order events and empaques
    let timeline: any[] = []

    // Get creator user info if createdBy is an email
    let creatorName = 'Sistema'
    if (orderResult?.createdBy && orderResult.createdBy !== 'system') {
      try {
        const creatorQuery = `
          SELECT firstname, lastname, email
          FROM users
          WHERE email = $1 OR id::text = $1
          LIMIT 1
        `
        const creatorResult = await db.query(creatorQuery, [orderResult.createdBy])
        if (creatorResult.rows.length > 0) {
          const creator = creatorResult.rows[0]
          creatorName = `${creator.firstname || ''} ${creator.lastname || ''}`.trim() || creator.email
        } else {
          creatorName = orderResult.createdBy
        }
      } catch {
        creatorName = orderResult.createdBy
      }
    }

    if (orderResult) {
      // Add order creation event
      timeline.push({
        action: 'Orden Creada',
        date: orderResult.createdAt,
        user: creatorName,
        notes: `Tipo: ${getOrderTypeLabel(orderResult.orderType)}`,
        location: null
      })

      // Add status change if different from pending
      if (orderResult.status !== 'pending') {
        timeline.push({
          action: getStatusLabel(orderResult.status),
          date: orderResult.updatedAt || orderResult.createdAt,
          user: null,
          notes: null,
          location: orderResult.warehouseName
        })
      }
    }

    // Add empaque events based on their state
    for (const emp of empaques) {
      // Add delivery event if delivered
      if (emp.deliveredAt) {
        timeline.push({
          action: 'Empaque Entregado',
          date: emp.deliveredAt,
          user: emp.driverName || null,
          notes: `Empaque: ${emp.codigo}`,
          location: null
        })
      }
      // Add return event if returned
      if (emp.returnedAt) {
        timeline.push({
          action: 'Empaque Retornado',
          date: emp.returnedAt,
          user: emp.driverName || null,
          notes: `Empaque: ${emp.codigo}`,
          location: emp.warehouseName || null
        })
      }
    }

    // Sort timeline by date descending (most recent first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Fetch customer info if we have customerId
    let customer = null
    if (orderResult?.customerId) {
      const customerQuery = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          phone,
          email
        FROM customers
        WHERE id = $1
        LIMIT 1
      `
      const customerResult = await db.query(customerQuery, [orderResult.customerId])
      if (customerResult.rows.length > 0) {
        customer = customerResult.rows[0]
      }
    }

    // Fetch delivery proof if order exists
    let deliveryProof = null
    if (orderResult?.id) {
      try {
        const proofQuery = `
          SELECT
            id,
            order_id as "orderId",
            signature_data as "signatureData",
            signature_storage_path as "signatureStoragePath",
            signer_name as "signerName",
            signer_relation as "signerRelation",
            photos,
            delivery_latitude as "deliveryLatitude",
            delivery_longitude as "deliveryLongitude",
            notes,
            created_at as "createdAt",
            created_by_name as "createdByName"
          FROM delivery_proofs
          WHERE order_id = $1
          LIMIT 1
        `
        const proofResult = await db.query(proofQuery, [orderResult.id])

        if (proofResult.rows.length > 0) {
          const proof = proofResult.rows[0]

          // Parsear fotos
          let photos: any[] = []
          try {
            photos = typeof proof.photos === 'string'
              ? JSON.parse(proof.photos)
              : (proof.photos || [])
          } catch (e) {
            photos = []
          }

          // Generar URLs firmadas para las fotos
          if (photos.length > 0 && supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey, {
              auth: { autoRefreshToken: false, persistSession: false }
            })

            for (const photo of photos) {
              if (photo.storagePath) {
                try {
                  const { data } = await supabase.storage
                    .from(BUCKET_NAME)
                    .createSignedUrl(photo.storagePath, 3600)

                  if (data?.signedUrl) {
                    photo.signedUrl = data.signedUrl
                  }
                } catch (e) {
                  console.error('Error generating signed URL:', e)
                }
              }
            }
          }

          deliveryProof = {
            id: proof.id,
            hasSignature: !!proof.signatureData || !!proof.signatureStoragePath,
            signatureData: proof.signatureData,
            signerName: proof.signerName,
            signerRelation: proof.signerRelation,
            photos,
            location: {
              latitude: proof.deliveryLatitude,
              longitude: proof.deliveryLongitude
            },
            notes: proof.notes,
            createdAt: proof.createdAt,
            createdByName: proof.createdByName
          }

          // Agregar evento de entrega con comprobante al timeline
          timeline.push({
            action: 'Comprobante de Entrega Registrado',
            date: proof.createdAt,
            user: proof.createdByName || 'Sistema',
            notes: proof.signerName ? `Firmado por: ${proof.signerName}` : null,
            location: proof.deliveryLatitude && proof.deliveryLongitude
              ? `${parseFloat(proof.deliveryLatitude).toFixed(4)}, ${parseFloat(proof.deliveryLongitude).toFixed(4)}`
              : null
          })

          // Re-ordenar timeline
          timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }
      } catch (proofError) {
        console.error('Error fetching delivery proof:', proofError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order: orderResult,
        customer,
        empaques,
        timeline,
        deliveryProof
      },
      searchType
    })

  } catch (error) {
    console.error('Error in tracker search:', error)
    return NextResponse.json(
      { success: false, error: 'Error al buscar. Intente de nuevo.' },
      { status: 500 }
    )
  }
}

// Helper functions
function getOrderTypeLabel(type: string): string {
  const types: Record<string, string> = {
    'recogida': 'Recogida',
    'oficina': 'Oficina',
    'entrega_empaques': 'Entrega de Empaques',
    'retorno': 'Retorno'
  }
  return types[type] || type
}

function getStatusLabel(status: string): string {
  const statuses: Record<string, string> = {
    'pending': 'Pendiente',
    'reprogrammed': 'Reprogramado',
    'picked_up': 'Recogido',
    'in_transit': 'En Tránsito',
    'in_route': 'En Ruta',
    'delivered': 'Entregado',
    'completed': 'Completado',
    'cancelled': 'Cancelado'
  }
  return statuses[status] || status
}
