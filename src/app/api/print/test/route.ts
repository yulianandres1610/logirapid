import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/print/test
 * Test endpoint to verify print system is working
 *
 * WARNING: This endpoint should be removed after testing!
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const companyId = searchParams.get('companyId') || '1'

    if (action === 'list-all') {
      // List ALL print services across all companies (for debugging)
      const allServices = await db.query(`
        SELECT
          ps.id,
          ps.company_id,
          ps.warehouse_id,
          ps.service_code,
          ps.service_name,
          ps.status,
          ps.last_seen_at,
          (SELECT COUNT(*) FROM print_service_printers WHERE print_service_id = ps.id) as printer_count
        FROM print_services ps
        ORDER BY ps.company_id, ps.created_at DESC
      `)

      // Get printers details
      const printers = await db.query(`
        SELECT
          psp.id,
          psp.print_service_id,
          psp.printer_name,
          psp.printer_type,
          psp.connection_type,
          psp.is_online,
          psp.is_default,
          psp.supports_escpos,
          psp.supported_document_types
        FROM print_service_printers psp
        ORDER BY psp.print_service_id
      `)

      return NextResponse.json({
        success: true,
        data: {
          totalServices: allServices.rows.length,
          services: allServices.rows,
          printers: printers.rows
        }
      })
    }

    if (action === 'status') {
      // Get print services status
      const services = await db.query(`
        SELECT
          ps.id,
          ps.service_code,
          ps.service_name,
          ps.status,
          ps.last_seen_at,
          (SELECT COUNT(*) FROM print_service_printers WHERE print_service_id = ps.id) as printer_count
        FROM print_services ps
        WHERE ps.company_id = $1
        ORDER BY ps.created_at DESC
      `, [companyId])

      // Get pending jobs
      const pendingJobs = await db.query(`
        SELECT COUNT(*) as count FROM print_jobs
        WHERE company_id = $1 AND status IN ('pending', 'sent')
      `, [companyId])

      // Get recent jobs
      const recentJobs = await db.query(`
        SELECT
          id, job_number, document_type, status,
          error_message, created_at, completed_at
        FROM print_jobs
        WHERE company_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [companyId])

      return NextResponse.json({
        success: true,
        data: {
          services: services.rows,
          pendingJobsCount: parseInt(pendingJobs.rows[0]?.count) || 0,
          recentJobs: recentJobs.rows
        }
      })
    }

    if (action === 'print-test') {
      // Find an active service
      const serviceResult = await db.query(`
        SELECT ps.id as service_id, psp.id as printer_id, psp.printer_name
        FROM print_services ps
        JOIN print_service_printers psp ON psp.print_service_id = ps.id
        WHERE ps.company_id = $1 AND ps.status = 'active'
        ORDER BY psp.is_default DESC
        LIMIT 1
      `, [companyId])

      if (serviceResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay servicios de impresión activos. Verifica que el servicio Electron esté corriendo.',
          hint: 'El servicio debe estar en estado "active" y tener al menos una impresora registrada.'
        })
      }

      const { service_id, printer_id, printer_name } = serviceResult.rows[0]

      // Create a test purchase invoice job
      const jobNumber = `TEST-${Date.now()}`
      const testDocumentData = {
        companyName: 'LogiRapid Test',
        companyAddress: 'Dirección de Prueba',
        supplierName: 'Proveedor de Prueba',
        supplierRuc: 'RUC-12345',
        supplierAddress: 'Calle del Proveedor 123',
        invoiceNumber: 'FAC-TEST-001',
        purchaseNumber: 'OC-TEST-001',
        date: new Date().toLocaleDateString('es-ES'),
        warehouseName: 'Almacén Principal',
        receivedBy: 'Usuario de Prueba',
        items: [
          { name: 'Producto de Prueba 1', sku: 'SKU001', quantity: 5, unitCost: 10.00, total: 50.00 },
          { name: 'Producto de Prueba 2', sku: 'SKU002', quantity: 3, unitCost: 25.00, total: 75.00 },
          { name: 'Producto de Prueba 3', sku: 'SKU003', quantity: 10, unitCost: 5.50, total: 55.00 }
        ],
        subtotal: 180.00,
        tax: 18.00,
        taxRate: 10,
        total: 198.00,
        paymentStatus: 'pending',
        notes: 'Esta es una factura de prueba generada automáticamente.'
      }

      // Insert the job
      const result = await db.query(`
        INSERT INTO print_jobs (
          job_number, company_id, print_service_id, printer_id,
          document_type, source_type, document_data, copies,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
        RETURNING id
      `, [
        jobNumber,
        companyId,
        service_id,
        printer_id,
        'purchase_invoice',
        'test',
        JSON.stringify(testDocumentData),
        1
      ])

      // Log the job creation
      await db.query(`
        INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
        VALUES ($1, 'created', $2, NOW())
      `, [result.rows[0].id, JSON.stringify({ test: true })])

      return NextResponse.json({
        success: true,
        message: 'Trabajo de impresión de prueba creado',
        data: {
          jobId: result.rows[0].id,
          jobNumber,
          documentType: 'purchase_invoice',
          printerName: printer_name,
          serviceId: service_id,
          printerId: printer_id
        },
        nextStep: 'El servicio Electron debería recoger este trabajo en los próximos 5-10 segundos.'
      })
    }

    if (action === 'cleanup') {
      // Mark stuck jobs as failed (including recent ones with force param)
      const force = searchParams.get('force') === 'true'
      const intervalClause = force ? '' : "AND created_at < NOW() - INTERVAL '1 hour'"

      const result = await db.query(`
        UPDATE print_jobs
        SET status = 'failed',
            error_message = 'Trabajo atascado - limpiado automáticamente',
            completed_at = NOW()
        WHERE company_id = $1
          AND status IN ('printing', 'sent')
          ${intervalClause}
        RETURNING id, job_number, document_type
      `, [companyId])

      return NextResponse.json({
        success: true,
        message: `${result.rows.length} trabajos atascados marcados como fallidos`,
        data: {
          cleanedJobs: result.rows
        }
      })
    }

    if (action === 'print-sales-report') {
      // Find an active service
      const serviceResult = await db.query(`
        SELECT ps.id as service_id, psp.id as printer_id, psp.printer_name
        FROM print_services ps
        JOIN print_service_printers psp ON psp.print_service_id = ps.id
        WHERE ps.company_id = $1 AND ps.status = 'active'
        ORDER BY psp.is_default DESC
        LIMIT 1
      `, [companyId])

      if (serviceResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay servicios de impresión activos.'
        })
      }

      const { service_id, printer_id, printer_name } = serviceResult.rows[0]

      const jobNumber = `TEST-SR-${Date.now()}`
      const testSalesData = {
        companyName: 'LogiRapid Test',
        terminalName: 'Terminal de Prueba',
        warehouseName: 'Almacén Principal',
        reportTitle: 'REPORTE DE VENTAS - PRUEBA',
        reportDate: new Date().toLocaleDateString('es-ES'),
        generatedAt: new Date().toLocaleString('es-ES'),
        generatedBy: 'Sistema de Pruebas',
        totalTransactions: 25,
        totalProducts: 150,
        grossSales: 5000.00,
        discounts: 250.00,
        taxes: 475.00,
        netSales: 5225.00,
        salesByPayment: [
          { paymentMethod: 'Efectivo', transactionCount: 15, total: 3000.00 },
          { paymentMethod: 'Tarjeta', transactionCount: 10, total: 2225.00 }
        ],
        topProducts: [
          { name: 'Producto Popular 1', quantity: 50, total: 1500.00 },
          { name: 'Producto Popular 2', quantity: 35, total: 1050.00 },
          { name: 'Producto Popular 3', quantity: 30, total: 900.00 }
        ],
        notes: 'Este es un reporte de prueba generado automáticamente.'
      }

      const result = await db.query(`
        INSERT INTO print_jobs (
          job_number, company_id, print_service_id, printer_id,
          document_type, source_type, document_data, copies,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
        RETURNING id
      `, [
        jobNumber,
        companyId,
        service_id,
        printer_id,
        'sales_report',
        'test',
        JSON.stringify(testSalesData),
        1
      ])

      return NextResponse.json({
        success: true,
        message: 'Trabajo de reporte de ventas creado',
        data: {
          jobId: result.rows[0].id,
          jobNumber,
          documentType: 'sales_report',
          printerName: printer_name
        }
      })
    }

    if (action === 'add-warehouse-operation-support') {
      // Add warehouse_operation to all printers' supported_document_types
      const result = await db.query(`
        UPDATE print_service_printers
        SET supported_document_types = array_append(
          CASE
            WHEN 'warehouse_operation' = ANY(supported_document_types) THEN supported_document_types
            ELSE supported_document_types
          END,
          'warehouse_operation'
        )
        WHERE NOT ('warehouse_operation' = ANY(supported_document_types))
        RETURNING id, printer_name, supported_document_types
      `)

      return NextResponse.json({
        success: true,
        message: `${result.rows.length} impresoras actualizadas con soporte para warehouse_operation`,
        data: {
          updatedPrinters: result.rows
        }
      })
    }

    if (action === 'print-warehouse-operation') {
      // Find an active service
      const serviceResult = await db.query(`
        SELECT ps.id as service_id, psp.id as printer_id, psp.printer_name
        FROM print_services ps
        JOIN print_service_printers psp ON psp.print_service_id = ps.id
        WHERE ps.company_id = $1 AND ps.status = 'active'
        ORDER BY psp.is_default DESC
        LIMIT 1
      `, [companyId])

      if (serviceResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay servicios de impresión activos.'
        })
      }

      const { service_id, printer_id, printer_name } = serviceResult.rows[0]

      const jobNumber = `TEST-WO-${Date.now()}`
      const testWarehouseData = {
        operationType: 'reception',
        operationNumber: 'OP-TEST-001',
        warehouse: {
          id: 1,
          name: 'Almacén Principal',
          code: 'ALM-001'
        },
        destinationWarehouse: null,
        products: [
          { productId: 1, name: 'Producto de Prueba 1', sku: 'SKU-001', quantity: 10, currentStock: 50 },
          { productId: 2, name: 'Producto de Prueba 2', sku: 'SKU-002', quantity: 5, currentStock: 25 },
          { productId: 3, name: 'Producto de Prueba 3', sku: 'SKU-003', quantity: 15, currentStock: 100 }
        ],
        scrapReason: null,
        adjustmentReason: null,
        notes: 'Documento de prueba para verificar impresión de operaciones de almacén',
        createdAt: new Date().toISOString()
      }

      const result = await db.query(`
        INSERT INTO print_jobs (
          job_number, company_id, print_service_id, printer_id,
          document_type, source_type, document_data, copies,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
        RETURNING id
      `, [
        jobNumber,
        companyId,
        service_id,
        printer_id,
        'warehouse_operation',
        'test',
        JSON.stringify(testWarehouseData),
        1
      ])

      await db.query(`
        INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
        VALUES ($1, 'created', $2, NOW())
      `, [result.rows[0].id, JSON.stringify({ test: true, operationType: 'reception' })])

      return NextResponse.json({
        success: true,
        message: 'Trabajo de impresión de operación de almacén creado',
        data: {
          jobId: result.rows[0].id,
          jobNumber,
          documentType: 'warehouse_operation',
          operationType: 'reception',
          printerName: printer_name
        },
        nextStep: 'El servicio de impresión debería procesar este trabajo en los próximos segundos.'
      })
    }

    if (action === 'print-label-test') {
      const serviceCode = searchParams.get('serviceCode')
      const printerName = searchParams.get('printerName')

      if (!serviceCode) {
        return NextResponse.json({
          success: false,
          error: 'serviceCode es requerido (ej: PRS-2026-1369)'
        }, { status: 400 })
      }

      // Find service by code
      const serviceResult = await db.query(
        'SELECT id, company_id, status FROM print_services WHERE service_code = $1',
        [serviceCode]
      )

      if (serviceResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Servicio ${serviceCode} no encontrado`
        }, { status: 404 })
      }

      const service = serviceResult.rows[0]

      // Find printer by name or get first label printer
      let printerQuery = `
        SELECT id, printer_name, printer_type, is_online
        FROM print_service_printers
        WHERE print_service_id = $1
      `
      const printerParams: (number | string)[] = [service.id]

      if (printerName) {
        printerQuery += ` AND printer_name ILIKE $2`
        printerParams.push(`%${printerName}%`)
      } else {
        printerQuery += ` AND (printer_type IN ('label_barcode', 'label_4x6') OR printer_name ILIKE '%label%' OR printer_name ILIKE '%barcode%' OR printer_name ILIKE '%etiqueta%')`
      }
      printerQuery += ' LIMIT 1'

      const printerResult = await db.query(printerQuery, printerParams)

      if (printerResult.rows.length === 0) {
        // Show available printers for debugging
        const allPrinters = await db.query(
          'SELECT id, printer_name, printer_type, is_online FROM print_service_printers WHERE print_service_id = $1',
          [service.id]
        )
        return NextResponse.json({
          success: false,
          error: printerName
            ? `Impresora "${printerName}" no encontrada en servicio ${serviceCode}`
            : `No se encontró impresora de etiquetas en servicio ${serviceCode}`,
          availablePrinters: allPrinters.rows
        }, { status: 404 })
      }

      const printer = printerResult.rows[0]

      // Create a test product_label job
      const jobNumber = `TEST-LBL-${Date.now()}`
      const testLabelData = {
        productName: 'PRODUCTO DE PRUEBA',
        sku: 'TEST-SKU-001',
        barcode: '2001234567890',
        barcodeType: 'ean13',
        includePrice: true,
        priceCUP: 2500,
        currency: 'CUP',
        unitOfMeasure: 'unidad',
        category: 'Test',
        description: 'Etiqueta de prueba',
        labelSize: 'medium'
      }

      const result = await db.query(`
        INSERT INTO print_jobs (
          job_number, company_id, print_service_id, printer_id,
          document_type, source_type, document_data, copies,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
        RETURNING id
      `, [
        jobNumber,
        service.company_id,
        service.id,
        printer.id,
        'product_label',
        'test',
        JSON.stringify(testLabelData),
        1
      ])

      await db.query(`
        INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
        VALUES ($1, 'created', $2, NOW())
      `, [result.rows[0].id, JSON.stringify({ test: true, serviceCode, printerName: printer.printer_name })])

      return NextResponse.json({
        success: true,
        message: `Etiqueta de prueba enviada a ${printer.printer_name}`,
        data: {
          jobId: result.rows[0].id,
          jobNumber,
          documentType: 'product_label',
          serviceCode,
          serviceStatus: service.status,
          printerName: printer.printer_name,
          printerType: printer.printer_type,
          printerOnline: printer.is_online
        },
        nextStep: 'El servicio de impresión debería procesar este trabajo en los próximos segundos.'
      })
    }

    if (action === 'diagnose') {
      const serviceCode = searchParams.get('serviceCode')

      if (!serviceCode) {
        return NextResponse.json({
          success: false,
          error: 'serviceCode es requerido'
        }, { status: 400 })
      }

      const serviceResult = await db.query(
        'SELECT id, company_id, status, last_seen_at FROM print_services WHERE service_code = $1',
        [serviceCode]
      )

      if (serviceResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: `Servicio ${serviceCode} no encontrado` }, { status: 404 })
      }

      const service = serviceResult.rows[0]
      const now = new Date()
      const lastSeen = service.last_seen_at ? new Date(service.last_seen_at) : null
      const isConnected = lastSeen && (now.getTime() - lastSeen.getTime()) < 120000 // 2 min

      // Get printers
      const printers = await db.query(
        'SELECT id, printer_name, printer_type, is_online, is_default FROM print_service_printers WHERE print_service_id = $1',
        [service.id]
      )

      // Get job stats
      const jobStats = await db.query(`
        SELECT status, COUNT(*) as count
        FROM print_jobs
        WHERE print_service_id = $1
        GROUP BY status
      `, [service.id])

      // Get last 10 jobs
      const recentJobs = await db.query(`
        SELECT id, job_number, document_type, status, error_message, attempts, max_attempts, created_at, sent_at, completed_at
        FROM print_jobs
        WHERE print_service_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [service.id])

      return NextResponse.json({
        success: true,
        data: {
          service: {
            id: service.id,
            code: serviceCode,
            status: service.status,
            lastSeenAt: service.last_seen_at,
            isConnected,
            timeSinceLastSeen: lastSeen ? `${Math.round((now.getTime() - lastSeen.getTime()) / 1000)}s` : 'never'
          },
          printers: printers.rows,
          jobStats: jobStats.rows,
          recentJobs: recentJobs.rows
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida',
      validActions: ['status', 'print-test', 'print-label-test', 'print-sales-report', 'print-warehouse-operation', 'list-all', 'cleanup', 'diagnose']
    })

  } catch (error) {
    console.error('[Print Test API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
