import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/test-print-invoice
 *
 * Sends a test purchase invoice print job to all available thermal printers.
 */
export async function GET() {
  try {
    // Find all active print services with their printers
    const servicesResult = await db.query(`
      SELECT ps.id as service_id, ps.service_name, ps.service_code, ps.company_id,
             pp.id as printer_id, pp.printer_name, pp.printer_type, pp.is_online
      FROM print_services ps
      JOIN print_service_printers pp ON pp.print_service_id = ps.id
      WHERE ps.status = 'active'
        AND pp.is_online = true
        AND (pp.printer_type = 'thermal_80mm' OR pp.printer_type = 'standard')
      ORDER BY ps.id, pp.printer_type
    `)

    if (servicesResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron impresoras térmicas o estándar online'
      }, { status: 404 })
    }

    // Test purchase invoice data
    const testInvoiceData = {
      companyName: 'LogiRapid Market',
      supplierName: 'Proveedor de Prueba',
      supplierRuc: 'TEST-001',
      supplierAddress: 'Calle de Prueba 123',
      supplierPhone: '+1 555-0100',
      invoiceNumber: 'TEST-PRINT-001',
      purchaseNumber: 'PUR-TEST-001',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      receivedBy: 'Test User',
      warehouseName: 'Almacén Principal',
      items: [
        { name: 'Producto de Prueba A', sku: 'SKU-001', quantity: 5, unitCost: 2.50, total: 12.50 },
        { name: 'Producto de Prueba B', sku: 'SKU-002', quantity: 10, unitCost: 1.75, total: 17.50 },
        { name: 'Producto de Prueba C', sku: 'SKU-003', quantity: 3, unitCost: 8.00, total: 24.00 }
      ],
      subtotal: 54.00,
      tax: 0,
      taxRate: 0,
      discount: 0,
      shipping: 0,
      total: 54.00,
      paymentMethod: 'Efectivo',
      paymentStatus: 'PAGADO',
      amountPaid: 54.00,
      amountDue: 0,
      notes: 'Impresion de prueba - Verificando conectividad'
    }

    const jobsSent: Array<{
      serviceCode: string
      serviceName: string
      printerName: string
      printerType: string
      jobNumber: string
    }> = []

    // Send a print job to each available printer
    for (const row of servicesResult.rows) {
      const year = new Date().getFullYear()
      const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
      const jobNumber = `PRJ-${year}-${random}`

      await db.query(`
        INSERT INTO print_jobs (
          job_number, company_id, print_service_id, printer_id,
          document_type, source_type, source_id, document_data,
          copies, priority, status, requested_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, NOW())
      `, [
        jobNumber,
        row.company_id,
        row.service_id,
        row.printer_id,
        'purchase_invoice',
        null, // source_type
        null, // source_id
        JSON.stringify(testInvoiceData),
        1,    // copies
        1,    // priority
        1     // requested_by (system user)
      ])

      jobsSent.push({
        serviceCode: row.service_code,
        serviceName: row.service_name,
        printerName: row.printer_name,
        printerType: row.printer_type,
        jobNumber
      })
    }

    return NextResponse.json({
      success: true,
      message: `Se enviaron ${jobsSent.length} trabajos de impresión de prueba`,
      data: {
        totalJobs: jobsSent.length,
        jobs: jobsSent
      }
    })

  } catch (error) {
    console.error('[Test Print Invoice] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar trabajos de impresión'
    }, { status: 500 })
  }
}
