import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/test-print-invoice
 *
 * Sends a test purchase invoice print job to all available thermal/standard printers.
 */
export async function GET() {
  const debugLog: string[] = []

  try {
    debugLog.push('Step 1: Querying print services...')

    // Step 1: Get active print services
    const servicesResult = await db.query(`
      SELECT id, service_code, service_name, company_id, status
      FROM print_services
      WHERE status = 'active'
    `)

    debugLog.push(`Found ${servicesResult.rows.length} active services`)

    if (servicesResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay servicios de impresión activos',
        debug: debugLog
      }, { status: 404 })
    }

    // Step 2: Get online printers for those services
    const serviceIds = servicesResult.rows.map((s: { id: number }) => s.id)
    debugLog.push(`Step 2: Querying printers for service IDs: ${serviceIds.join(', ')}`)

    const printersResult = await db.query(`
      SELECT id, print_service_id, printer_name, printer_type, is_online, is_default
      FROM print_service_printers
      WHERE print_service_id = ANY($1)
        AND is_online = true
    `, [serviceIds])

    debugLog.push(`Found ${printersResult.rows.length} online printers`)

    if (printersResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay impresoras online',
        debug: debugLog,
        services: servicesResult.rows
      }, { status: 404 })
    }

    // Step 3: Filter to thermal and standard printers
    const compatiblePrinters = printersResult.rows.filter(
      (p: { printer_type: string }) => p.printer_type === 'thermal_80mm' || p.printer_type === 'standard'
    )

    debugLog.push(`Compatible printers (thermal/standard): ${compatiblePrinters.length}`)

    if (compatiblePrinters.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay impresoras térmicas o estándar online',
        debug: debugLog,
        allPrinters: printersResult.rows
      }, { status: 404 })
    }

    // Step 4: Create test invoice data
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
      warehouseName: 'Almacen Principal',
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

    // Step 5: Send print jobs
    const jobsSent: Array<{
      serviceName: string
      printerName: string
      printerType: string
      jobNumber: string
    }> = []

    for (const printer of compatiblePrinters) {
      const service = servicesResult.rows.find((s: { id: number }) => s.id === printer.print_service_id)
      if (!service) continue

      const year = new Date().getFullYear()
      const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
      const jobNumber = `PRJ-${year}-${random}`

      debugLog.push(`Step 5: Creating job ${jobNumber} for ${printer.printer_name} (${printer.printer_type})`)

      try {
        await db.query(`
          INSERT INTO print_jobs (
            job_number, company_id, print_service_id, printer_id,
            document_type, document_data, copies, priority, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'pending', NOW())
        `, [
          jobNumber,
          service.company_id,
          service.id,
          printer.id,
          'purchase_invoice',
          JSON.stringify(testInvoiceData),
          1,
          1
        ])

        jobsSent.push({
          serviceName: service.service_name,
          printerName: printer.printer_name,
          printerType: printer.printer_type,
          jobNumber
        })

        debugLog.push(`Job ${jobNumber} created successfully`)
      } catch (insertErr: any) {
        debugLog.push(`Error creating job: ${insertErr.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se enviaron ${jobsSent.length} trabajos de impresion de prueba`,
      data: {
        totalJobs: jobsSent.length,
        jobs: jobsSent
      },
      debug: debugLog
    })

  } catch (error: any) {
    debugLog.push(`FATAL ERROR: ${error.message}`)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al enviar trabajos de impresion',
      debug: debugLog
    }, { status: 500 })
  }
}
