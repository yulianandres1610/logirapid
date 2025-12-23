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
          ps.service_code,
          ps.service_name,
          ps.status,
          ps.last_seen_at,
          (SELECT COUNT(*) FROM print_service_printers WHERE print_service_id = ps.id) as printer_count
        FROM print_services ps
        ORDER BY ps.company_id, ps.created_at DESC
      `)

      return NextResponse.json({
        success: true,
        data: {
          totalServices: allServices.rows.length,
          services: allServices.rows
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
      // Mark stuck jobs as failed
      const result = await db.query(`
        UPDATE print_jobs
        SET status = 'failed',
            error_message = 'Trabajo atascado - limpiado automáticamente',
            completed_at = NOW()
        WHERE company_id = $1
          AND status IN ('printing', 'sent')
          AND created_at < NOW() - INTERVAL '1 hour'
        RETURNING id, job_number
      `, [companyId])

      return NextResponse.json({
        success: true,
        message: `${result.rows.length} trabajos atascados marcados como fallidos`,
        data: {
          cleanedJobs: result.rows
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida',
      validActions: ['status', 'print-test', 'list-all', 'cleanup']
    })

  } catch (error) {
    console.error('[Print Test API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
