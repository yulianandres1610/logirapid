/**
 * Job Processor - Handles the print queue and document generation
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { apiClient, PrintJob } from './api-client'
import { printerService, DetectedPrinter } from './printer-service'
import { generatePosReceipt, ReceiptData } from '../documents/pos-receipt'
import { generateShippingLabel, ShippingLabelData } from '../documents/shipping-label'
import { generateProductLabel, ProductLabelData } from '../documents/product-label'
import { generateProductLabelZpl, generateShippingLabelZpl } from '../documents/product-label-zpl'
import { generateProductLabelTspl } from '../documents/product-label-tspl'
import { generateLotLabelZpl, LotLabelData } from '../documents/lot-label-zpl'
import { generatePurchaseInvoice, PurchaseInvoiceData } from '../documents/purchase-invoice'
import { generatePurchaseInvoicePdf } from '../documents/purchase-invoice-pdf'
import { generatePurchaseInvoiceEscpos } from '../documents/purchase-invoice-escpos'
import { generateSalesReport, SalesReportData } from '../documents/sales-report'
import { generateSalesReportPdf } from '../documents/sales-report-pdf'
import { generateInventoryCountReport, InventoryCountReportData } from '../documents/inventory-count-report'
import { generateInventoryCountReportPdf } from '../documents/inventory-count-report-pdf'
import { generateCashRegisterReport, CashRegisterReportData } from '../documents/cash-register-report'
import { generateCashRegisterReportPdf } from '../documents/cash-register-report-pdf'
import { generateWarehouseOperation, WarehouseOperationData } from '../documents/warehouse-operation'
import { generateWarehouseOperationPdf } from '../documents/warehouse-operation-pdf'
import { generateConsignmentReceipt, ConsignmentReceiptData } from '../documents/consignment-receipt'
import { generateConsignmentReceiptEscpos } from '../documents/consignment-receipt-escpos'
import { generateUnifiedReception, UnifiedReceptionData } from '../documents/unified-reception'
import { generateUnifiedReceptionEscpos } from '../documents/unified-reception-escpos'
import { generateTransferReceipt, TransferReceiptData } from '../documents/transfer-receipt'
import { generateAuditCountReport, AuditCountReportData } from '../documents/audit-count-report'
import { generateWeightLabelZpl, WeightLabelData } from '../documents/weight-label-zpl'
import { generateWeightLabelPdf, WeightLabelPdfData } from '../documents/weight-label-pdf'
import { generateWeightLabelTspl, WeightLabelTsplData } from '../documents/weight-label-tspl'
import { generateProductionOrder, ProductionOrderData } from '../documents/production-order'
import { generateProductionOrderPdf, ProductionOrderPdfData } from '../documents/production-order-pdf'
import { generateSessionCloseReport, SessionCloseReportData } from '../documents/session-close-report'
import { generateAssetLabelTspl, AssetLabelData } from '../documents/asset-label-tspl'
import { generateAssetLabelZpl } from '../documents/asset-label-zpl'
import { generateWholesaleInvoiceEscpos, WholesaleInvoiceData } from '../documents/wholesale-invoice-escpos'

const execAsync = promisify(exec)

interface ProcessingJob {
  job: PrintJob
  startedAt: Date
  attempts: number
}

class JobProcessor {
  private processing: Map<number, ProcessingJob> = new Map()
  private pollInterval: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isRunning = false
  private pollIntervalMs = 5000
  private heartbeatIntervalMs = 30000
  private lastKnownPrinterNames: Set<string> = new Set()

  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('[Job Processor] ====================================')
    console.log('[Job Processor] Starting Job Processor...')
    console.log('[Job Processor] Platform:', process.platform)
    console.log('[Job Processor] ====================================')
    this.isRunning = true

    // Initial registration
    await this.registerService()

    // Start polling for jobs
    this.pollInterval = setInterval(() => this.pollJobs(), this.pollIntervalMs)

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs)

    // Poll immediately
    this.pollJobs()
  }

  async stop(): Promise<void> {
    console.log('[Job Processor] Stopping...')
    this.isRunning = false

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Send disconnect webhook
    await apiClient.sendWebhook('service.disconnected', {})
  }

  private async registerService(): Promise<void> {
    console.log('[Job Processor] Registering service with server...')

    // Detect printers
    const printers = await printerService.detectPrinters()
    console.log(`[Job Processor] Detected ${printers.length} printers:`)
    printers.forEach((p, i) => {
      console.log(`[Job Processor]   [${i + 1}] ${p.printerName}`)
      console.log(`[Job Processor]       - Type: ${p.printerType}`)
      console.log(`[Job Processor]       - Is Zebra: ${p.isZebra}`)
      console.log(`[Job Processor]       - RAW Queue: ${p.rawQueueName || 'none'}`)
    })

    // Store printer names for change detection
    this.lastKnownPrinterNames = new Set(printers.map(p => p.printerName))

    // Register with server
    const result = await apiClient.register(printers)

    if (result.success && result.data) {
      console.log(`[Job Processor] ✓ Registered successfully!`)
      console.log(`[Job Processor]   - Service Code: ${result.data.serviceCode}`)
      console.log(`[Job Processor]   - Pending Jobs: ${result.data.pendingJobs}`)

      // Update intervals if server provides them
      if (result.data.configuration) {
        this.pollIntervalMs = result.data.configuration.pollInterval
        this.heartbeatIntervalMs = result.data.configuration.heartbeatInterval
      }
    } else {
      console.error('[Job Processor] Registration failed:', result.error)
    }
  }

  private async sendHeartbeat(): Promise<void> {
    // Check if printers have changed and re-register if needed
    const currentPrinters = await printerService.detectPrinters()
    const currentNames = new Set(currentPrinters.map(p => p.printerName))

    // Check if printers have changed
    const printersChanged = currentNames.size !== this.lastKnownPrinterNames.size ||
      [...currentNames].some(name => !this.lastKnownPrinterNames.has(name))

    if (printersChanged) {
      console.log('[Job Processor] Printer change detected, re-registering...')
      console.log('[Job Processor] Previous printers:', [...this.lastKnownPrinterNames])
      console.log('[Job Processor] Current printers:', [...currentNames])

      this.lastKnownPrinterNames = currentNames

      // Re-register with updated printer list
      const registerResult = await apiClient.register(currentPrinters)
      if (registerResult.success) {
        console.log('[Job Processor] Printers synced with server')
      } else {
        console.error('[Job Processor] Failed to sync printers:', registerResult.error)
      }
    }

    const result = await apiClient.heartbeat()

    if (result.success && result.data) {
      // Adjust poll interval based on urgency
      if (result.data.urgentJobs > 0 && result.data.nextPoll < this.pollIntervalMs) {
        // Poll faster for urgent jobs
        if (this.pollInterval) {
          clearInterval(this.pollInterval)
          this.pollInterval = setInterval(() => this.pollJobs(), result.data.nextPoll)
        }
      }
    }
  }

  private async pollJobs(): Promise<void> {
    if (!this.isRunning) return

    try {
      const result = await apiClient.getPendingJobs(5)

      if (result.success && result.data?.jobs) {
        if (result.data.jobs.length > 0) {
          console.log(`[Job Processor] Poll: Found ${result.data.jobs.length} pending jobs`)
        }
        for (const job of result.data.jobs) {
          // Don't process if already processing
          if (this.processing.has(job.id)) continue

          this.processJob(job)
        }
      } else if (!result.success) {
        console.error('[Job Processor] Poll error:', result.error)
      }
    } catch (error) {
      console.error('[Job Processor] Poll failed:', error)
    }
  }

  private async processJob(job: PrintJob): Promise<void> {
    console.log(`[Job Processor] ========================================`)
    console.log(`[Job Processor] Processing job ${job.jobNumber}`)
    console.log(`[Job Processor] Document type: ${job.documentType}`)
    console.log(`[Job Processor] Requested printer: ${job.printerName || '(auto-select)'}`)
    console.log(`[Job Processor] Copies: ${job.copies || 1}`)

    this.processing.set(job.id, {
      job,
      startedAt: new Date(),
      attempts: 1
    })

    try {
      // Update status to printing
      console.log(`[Job Processor] Updating status to 'printing'...`)
      await apiClient.updateJobStatus(job.id, 'printing')

      // Find appropriate printer
      const printer = this.findPrinter(job)
      if (!printer) {
        const availablePrinters = printerService.getPrinters()
        console.error(`[Job Processor] No suitable printer found!`)
        console.error(`[Job Processor] Available printers: ${availablePrinters.map(p => `${p.printerName} (${p.printerType})`).join(', ') || 'none'}`)
        throw new Error(`No suitable printer found for ${job.documentType}. Available: ${availablePrinters.length}`)
      }

      console.log(`[Job Processor] Selected printer: ${printer.printerName}`)
      console.log(`[Job Processor]   - System name: ${printer.systemName}`)
      console.log(`[Job Processor]   - Type: ${printer.printerType}`)
      console.log(`[Job Processor]   - Connection: ${printer.connectionType}`)
      console.log(`[Job Processor]   - Supports ESC/POS: ${printer.supportsEscpos}`)
      console.log(`[Job Processor]   - Is online: ${printer.isOnline}`)

      // Check if printer is online
      const isOnline = await printerService.checkPrinterOnline(printer.systemName)
      if (!isOnline) {
        console.warn(`[Job Processor] Warning: Printer ${printer.printerName} appears to be offline`)
      }

      // Generate document (pass printer to determine format: PDF vs ESC/POS)
      console.log(`[Job Processor] Generating document...`)
      const documentBuffer = await this.generateDocument(job, printer)
      if (!documentBuffer) {
        throw new Error('Failed to generate document - buffer is null')
      }
      console.log(`[Job Processor] Document generated: ${documentBuffer.length} bytes`)

      // Print the document
      console.log(`[Job Processor] Sending to printer...`)
      await this.printDocument(printer, documentBuffer, job)

      // Update status to completed
      console.log(`[Job Processor] Updating status to 'completed'...`)
      await apiClient.updateJobStatus(job.id, 'completed')

      console.log(`[Job Processor] ✓ Job ${job.jobNumber} completed successfully`)
      console.log(`[Job Processor] ========================================`)
    } catch (error) {
      console.error(`[Job Processor] ✗ Job ${job.jobNumber} FAILED:`, error)
      console.error(`[Job Processor] ========================================`)

      await apiClient.updateJobStatus(
        job.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
        'PRINT_ERROR'
      )
    } finally {
      this.processing.delete(job.id)
    }
  }

  private findPrinter(job: PrintJob): DetectedPrinter | undefined {
    // If job specifies a printer name, use that
    if (job.printerName) {
      const printer = printerService.getPrinterByName(job.printerName)
      if (printer) return printer
    }

    // Otherwise, find by document type
    switch (job.documentType) {
      case 'pos_receipt':
      case 'sales_report':
      case 'inventory_count_report':
      case 'audit_count_report':
      case 'cash_register_report':
      case 'session_close_report':
        // Prefer thermal printers for receipts and reports
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      case 'shipping_label':
      case 'product_label':
      case 'lot_label':
      case 'weight_label':
      case 'asset_label':
        // Prefer label printers (Zebra) for labels
        return printerService.getLabelPrinters()[0] || printerService.getDefaultPrinter()

      case 'purchase_invoice':
      case 'invoice':
      case 'consignment_receipt':
      case 'wholesale_invoice':
      case 'production_materials_receipt':
      case 'production_reception_receipt':
        // For invoices, consignments, and production receipts, prefer thermal printers (ESC/POS format)
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      case 'warehouse_operation':
      case 'transfer_receipt':
      case 'production_order':
        // These documents should print on STANDARD printer (not Zebra label printer)
        return printerService.getStandardPrinters()[0] || printerService.getDefaultPrinter()

      case 'unified_reception':
        // Reception receipts should print on THERMAL receipt printer (80mm)
        // Using ESC/POS format with barcodes for products and order
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      default:
        return printerService.getDefaultPrinter()
    }
  }

  private async generateDocument(job: PrintJob, printer: DetectedPrinter): Promise<Buffer | null> {
    const data = job.documentData as Record<string, unknown>
    const usePdf = !printer.supportsEscpos || printer.printerType === 'standard'

    // For label printers, determine format:
    // - Zebra printers: use ZPL (Zebra Programming Language)
    // - Other label printers (TSC, 4BARCODE, etc.): use TSPL (TSC Printer Language)
    // - On Windows: always works natively via raw printing
    // - On macOS: use Python USB script to bypass CUPS driver filters
    // - On Linux: only if we have a RAW queue
    const hasRawQueue = !!printer.rawQueueName
    const isLabelPrinter = printer.printerType === 'label_barcode' || printer.isZebra
    const canUseRawPrinting = process.platform === 'win32' ||
      process.platform === 'darwin' ||
      hasRawQueue
    const useZpl = printer.isZebra && canUseRawPrinting
    const useTspl = !printer.isZebra && isLabelPrinter && canUseRawPrinting

    console.log(`[Job Processor] Generating ${job.documentType}:`)
    console.log(`[Job Processor]   - Printer: ${printer.printerName}`)
    console.log(`[Job Processor]   - Is Zebra: ${printer.isZebra}`)
    console.log(`[Job Processor]   - Is Label Printer: ${isLabelPrinter}`)
    console.log(`[Job Processor]   - Platform: ${process.platform}`)
    console.log(`[Job Processor]   - Has RAW queue: ${hasRawQueue} (${printer.rawQueueName || 'none'})`)
    console.log(`[Job Processor]   - Use ZPL (Zebra): ${useZpl}`)
    console.log(`[Job Processor]   - Use TSPL (TSC/4BARCODE): ${useTspl}`)
    console.log(`[Job Processor]   - Use PDF: ${!useZpl && !useTspl}`)

    switch (job.documentType) {
      case 'pos_receipt':
        // POS receipts are always ESC/POS (thermal printer required)
        return generatePosReceipt(data as unknown as ReceiptData)

      case 'shipping_label':
        // For Zebra printers on Windows, use ZPL; on macOS/Linux use PDF (CUPS handles conversion)
        if (useZpl) {
          console.log(`[Job Processor] Generating shipping label as ZPL for Zebra printer (Windows)`)
          return generateShippingLabelZpl(data as unknown as ShippingLabelData)
        }
        console.log(`[Job Processor] Generating shipping label as PDF (CUPS will convert to raster)`)
        return generateShippingLabel(data as unknown as ShippingLabelData)

      case 'product_label':
        // For Zebra printers, use ZPL
        if (useZpl) {
          console.log(`[Job Processor] Generating product label as ZPL for Zebra printer`)
          return generateProductLabelZpl(data as unknown as ProductLabelData)
        }
        // For other label printers (TSC, 4BARCODE, etc.), use TSPL
        if (useTspl) {
          console.log(`[Job Processor] Generating product label as TSPL for ${printer.printerName}`)
          return generateProductLabelTspl(data as unknown as ProductLabelData)
        }
        // Fallback to PDF
        console.log(`[Job Processor] Generating product label as PDF`)
        return generateProductLabel(data as unknown as ProductLabelData)

      case 'lot_label':
        // Lot labels are always ZPL for Zebra printers
        if (useZpl) {
          console.log(`[Job Processor] Generating lot label as ZPL for Zebra printer`)
          return generateLotLabelZpl(data as unknown as LotLabelData)
        }
        // Fallback to product label PDF format if not Zebra
        console.log(`[Job Processor] Generating lot label as PDF (fallback)`)
        return generateProductLabel({
          productName: (data as LotLabelData).productName,
          sku: (data as LotLabelData).lotNumber,
          barcode: (data as LotLabelData).lotNumber,
          description: `Lote: ${(data as LotLabelData).lotNumber}\nProveedor: ${(data as LotLabelData).supplierName}`
        } as ProductLabelData)

      case 'weight_label':
        // Weight labels are ZPL for Zebra printers (3x2 or 2x1 inch format)
        if (useZpl) {
          console.log(`[Job Processor] Generating weight label as ZPL for Zebra printer`)
          return generateWeightLabelZpl(data as unknown as WeightLabelData)
        }
        // For other label printers (TSC, 4BARCODE, etc.), use TSPL
        if (useTspl) {
          console.log(`[Job Processor] Generating weight label as TSPL for ${printer.printerName}`)
          return generateWeightLabelTspl(data as unknown as WeightLabelTsplData)
        }
        // Fallback to PDF for standard printers
        console.log(`[Job Processor] Generating weight label as PDF for standard printer`)
        return generateWeightLabelPdf(data as unknown as WeightLabelPdfData)

      case 'asset_label':
        // Asset labels: ZPL for Zebra printers, TSPL for TSC/4BARCODE printers
        if (useZpl) {
          console.log(`[Job Processor] Generating asset label as ZPL for Zebra ${printer.printerName}`)
          return generateAssetLabelZpl(data as unknown as AssetLabelData)
        }
        // For TSC/4BARCODE/Chinese printers, use TSPL
        if (useTspl || isLabelPrinter) {
          console.log(`[Job Processor] Generating asset label as TSPL for ${printer.printerName}`)
          return generateAssetLabelTspl(data as unknown as AssetLabelData)
        }
        // Fallback to TSPL for other label printers
        console.log(`[Job Processor] Generating asset label as TSPL (fallback) for ${printer.printerName}`)
        return generateAssetLabelTspl(data as unknown as AssetLabelData)

      case 'purchase_invoice':
      case 'invoice':
        // Use ESC/POS for thermal printers (80mm ticket format)
        // Use PDF only for standard printers
        if (printer.printerType === 'thermal_80mm' || printer.supportsEscpos) {
          console.log(`[Job Processor] Using ESC/POS format for purchase invoice on thermal printer`)
          return generatePurchaseInvoiceEscpos(data as unknown as PurchaseInvoiceData)
        }
        // Fallback to PDF for standard printers
        console.log(`[Job Processor] Using PDF format for purchase invoice on standard printer`)
        return generatePurchaseInvoicePdf(data as unknown as PurchaseInvoiceData)

      case 'sales_report':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateSalesReportPdf(data as unknown as SalesReportData)
        }
        return generateSalesReport(data as unknown as SalesReportData)

      case 'inventory_count_report':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateInventoryCountReportPdf(data as unknown as InventoryCountReportData)
        }
        return generateInventoryCountReport(data as unknown as InventoryCountReportData)

      case 'audit_count_report':
        // Audit count reports use ESC/POS for thermal printers
        // Use the same PDF as inventory_count_report for standard printers (or create specialized one)
        if (usePdf) {
          return generateInventoryCountReportPdf(data as unknown as InventoryCountReportData)
        }
        return generateAuditCountReport(data as unknown as AuditCountReportData)

      case 'cash_register_report':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateCashRegisterReportPdf(data as unknown as CashRegisterReportData)
        }
        return generateCashRegisterReport(data as unknown as CashRegisterReportData)

      case 'session_close_report':
        // Session close report - ESC/POS for thermal printers
        // Similar to cash_register_report but with different data structure
        return generateSessionCloseReport(data as unknown as SessionCloseReportData)

      case 'warehouse_operation':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateWarehouseOperationPdf(data as unknown as WarehouseOperationData)
        }
        return generateWarehouseOperation(data as unknown as WarehouseOperationData)

      case 'consignment_receipt':
        // Use ESC/POS for thermal printers (80mm ticket format)
        if (printer.printerType === 'thermal_80mm' || printer.supportsEscpos) {
          console.log(`[Job Processor] Using ESC/POS format for consignment receipt on thermal printer`)
          return generateConsignmentReceiptEscpos(data as unknown as ConsignmentReceiptData)
        }
        // Fallback to PDF for standard printers
        return generateConsignmentReceipt(data as unknown as ConsignmentReceiptData)

      case 'wholesale_invoice':
        // Use ESC/POS for thermal printers (80mm ticket format)
        if (printer.printerType === 'thermal_80mm' || printer.supportsEscpos) {
          console.log(`[Job Processor] Using ESC/POS format for wholesale invoice on thermal printer`)
          return generateWholesaleInvoiceEscpos(data as unknown as WholesaleInvoiceData)
        }
        // Fallback to consignment receipt PDF format for standard printers
        return generateConsignmentReceipt(data as unknown as ConsignmentReceiptData)

      case 'unified_reception':
        // Use ESC/POS for thermal printers (80mm ticket format with barcodes)
        // Use PDF only for standard printers
        if (printer.printerType === 'thermal_80mm' || printer.supportsEscpos) {
          console.log(`[Job Processor] Using ESC/POS format for unified reception on thermal printer`)
          return generateUnifiedReceptionEscpos(data as unknown as UnifiedReceptionData)
        }
        // Fallback to PDF for standard printers
        console.log(`[Job Processor] Using PDF format for unified reception on standard printer`)
        return generateUnifiedReception(data as unknown as UnifiedReceptionData)

      case 'transfer_receipt':
        // Always PDF for transfer receipts (has barcodes)
        return generateTransferReceipt(data as unknown as TransferReceiptData)

      case 'production_order':
      case 'production_materials_receipt':
      case 'production_reception_receipt':
        // Production documents - use thermal format similar to purchase invoice
        // For thermal printers use ESC/POS, for standard use PDF
        if (printer.printerType === 'thermal_80mm' || printer.supportsEscpos) {
          console.log(`[Job Processor] Generating ${job.documentType} as ESC/POS for thermal printer`)
          return generateProductionOrder(data as unknown as ProductionOrderData)
        }
        // Fallback to PDF for standard printers
        console.log(`[Job Processor] Generating ${job.documentType} as PDF`)
        return generateProductionOrderPdf(data as unknown as ProductionOrderPdfData)

      default:
        console.error(`[Job Processor] Unknown document type: ${job.documentType}`)
        return null
    }
  }

  private async printDocument(
    printer: DetectedPrinter,
    documentBuffer: Buffer,
    job: PrintJob
  ): Promise<void> {
    const copies = job.copies || 1

    // Check if we have a RAW queue for Zebra printers (allows ZPL on any platform)
    const hasRawQueue = !!printer.rawQueueName

    console.log(`[Job Processor] printDocument called:`)
    console.log(`[Job Processor]   - Document type: ${job.documentType}`)
    console.log(`[Job Processor]   - Printer type: ${printer.printerType}`)
    console.log(`[Job Processor]   - Is Zebra: ${printer.isZebra}`)
    console.log(`[Job Processor]   - Platform: ${process.platform}`)
    console.log(`[Job Processor]   - Has RAW queue: ${hasRawQueue} (${printer.rawQueueName || 'none'})`)
    console.log(`[Job Processor]   - Supports ESC/POS: ${printer.supportsEscpos}`)
    console.log(`[Job Processor]   - Buffer size: ${documentBuffer.length} bytes`)
    console.log(`[Job Processor]   - Copies: ${copies}`)

    // Determine print method
    // For label printers (Zebra, TSC, 4BARCODE, etc.):
    // - Use raw printing (ZPL for Zebra, TSPL for others)
    // - On Windows: send directly to printer
    // - On macOS: use Python USB script (bypasses CUPS)
    // - On Linux: use RAW queue if available
    const isLabelPrinter = printer.printerType === 'label_barcode' || printer.isZebra
    const isLabelJob = ['product_label', 'shipping_label', 'lot_label', 'weight_label', 'asset_label'].includes(job.documentType)
    const canUseRaw = process.platform === 'win32' || process.platform === 'darwin' || hasRawQueue
    // Use raw printing for BOTH Zebra (ZPL) AND other label printers (TSPL)
    const useRawLabelPrint = isLabelPrinter && canUseRaw && isLabelJob
    // ESC/POS documents that should always use raw printing on thermal printers
    const escposDocuments = [
      'pos_receipt', 'unified_reception', 'purchase_invoice', 'invoice',
      'consignment_receipt', 'wholesale_invoice', 'production_order',
      'production_materials_receipt', 'production_reception_receipt'
    ]
    const useEscPos = printer.supportsEscpos &&
                      printer.printerType !== 'standard' &&
                      escposDocuments.includes(job.documentType)
    const isReceiptOrReport = ['purchase_invoice', 'invoice', 'sales_report',
                               'inventory_count_report', 'audit_count_report', 'cash_register_report',
                               'session_close_report', 'warehouse_operation', 'unified_reception', 'consignment_receipt',
                               'wholesale_invoice', 'production_order', 'production_materials_receipt', 'production_reception_receipt'].includes(job.documentType)
    const isPdfOnly = ['transfer_receipt'].includes(job.documentType)

    console.log(`[Job Processor] Print method selection:`)
    console.log(`[Job Processor]   - useRawLabelPrint (ZPL/TSPL): ${useRawLabelPrint}`)
    console.log(`[Job Processor]   - useEscPos: ${useEscPos}`)
    console.log(`[Job Processor]   - isReceiptOrReport: ${isReceiptOrReport}`)
    console.log(`[Job Processor]   - isPdfOnly: ${isPdfOnly}`)
    console.log(`[Job Processor]   - printer.supportsEscpos: ${printer.supportsEscpos}`)
    console.log(`[Job Processor]   - printer.printerType: ${printer.printerType}`)
    console.log(`[Job Processor]   - Document in ESC/POS list: ${escposDocuments.includes(job.documentType)}`)

    // Print all copies in a single job for better performance
    if (useRawLabelPrint) {
      // Raw printing for label printers (ZPL for Zebra, TSPL for TSC/4BARCODE/etc.)
      const format = printer.isZebra ? 'ZPL' : 'TSPL'
      console.log(`[Job Processor] Using ${format}/RAW method for ${printer.printerName} (${copies} copies)`)
      console.log(`[Job Processor] RAW queue: ${printer.rawQueueName || '(direct)'}`)
      await this.printRawLabel(printer, documentBuffer, copies)
    } else if (isPdfOnly) {
      // PDF printing for PDF-only documents
      console.log(`[Job Processor] Using PDF method for ${printer.printerName} (${copies} copies)`)
      await this.printPdf(printer, documentBuffer, undefined, copies)
    } else if (useEscPos || (isReceiptOrReport && printer.supportsEscpos && printer.printerType !== 'standard')) {
      // Direct ESC/POS printing for thermal printers
      console.log(`[Job Processor] Using ESC/POS method for ${printer.printerName} (${copies} copies)`)
      await this.printEscPos(printer, documentBuffer, copies)
    } else {
      // PDF printing through system for standard/network printers
      console.log(`[Job Processor] Using PDF method (fallback) for ${printer.printerName} (${copies} copies)`)
      await this.printPdf(printer, documentBuffer, undefined, copies)
    }

    console.log(`[Job Processor] All ${copies} copies sent to printer in single job`)
  }

  private async printRawLabel(printer: DetectedPrinter, data: Buffer, copies: number = 1): Promise<void> {
    // Raw label data (ZPL for Zebra, TSPL for others) is sent directly to printer
    const ext = printer.isZebra ? 'zpl' : 'tspl'
    const tempFile = join(tmpdir(), `print-${uuidv4()}.${ext}`)

    // For ZPL, add ^PQ (Print Quantity) command for multiple copies
    // This is much faster than sending the same data multiple times
    let printData = data
    if (printer.isZebra && copies > 1) {
      const zplContent = data.toString('utf8')
      // Insert ^PQ{copies},0,1,Y before ^XZ (print quantity, pause, replicates, override)
      // ^PQ{q},{p},{r},{o} - q=quantity, p=pause(0=no), r=replicates(1=each), o=override(Y=yes)
      const modifiedZpl = zplContent.replace(/\^XZ/g, `^PQ${copies},0,1,Y\n^XZ`)
      printData = Buffer.from(modifiedZpl, 'utf8')
      console.log(`[Job Processor] ZPL modified with ^PQ${copies} for ${copies} copies`)
    } else if (!printer.isZebra && copies > 1) {
      // For TSPL, concatenate the data multiple times
      const tsplContent = data.toString('utf8')
      printData = Buffer.from(tsplContent.repeat(copies), 'utf8')
      console.log(`[Job Processor] TSPL duplicated ${copies} times`)
    }

    await writeFile(tempFile, printData)

    const format = printer.isZebra ? 'ZPL' : 'TSPL'
    console.log(`[Job Processor] ${format} file created: ${tempFile} (${printData.length} bytes, ${copies} copies)`)
    console.log(`[Job Processor] ${format} content preview: ${printData.toString('utf8').substring(0, 300)}...`)

    try {
      if (process.platform === 'win32') {
        // Windows: Use PowerShell to send raw ZPL to printer via Windows Spooler
        const escapedPrinter = printer.systemName.replace(/'/g, "''").replace(/"/g, '`"')
        const escapedFile = tempFile.replace(/\\/g, '/')

        console.log(`[Job Processor] Windows ZPL: Sending to "${printer.systemName}"`)

        // Create PowerShell script file to avoid command line escaping issues
        const psScriptFile = join(tmpdir(), `zpl-print-script-${uuidv4()}.ps1`)
        const psScript = `
$printerName = '${escapedPrinter}'
$filePath = '${escapedFile}'

# Read the ZPL file
$bytes = [System.IO.File]::ReadAllBytes($filePath)

# Use Windows Spooler API directly
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrint {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter;
        int dwWritten = 0;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "ZPL Label";
        di.pDatatype = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            return false;
        }

        if (StartDocPrinter(hPrinter, 1, ref di) == 0) {
            ClosePrinter(hPrinter);
            return false;
        }

        StartPagePrinter(hPrinter);
        bool success = WritePrinter(hPrinter, pBytes, pBytes.Length, out dwWritten);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return success;
    }
}
"@

$result = [RawPrint]::SendBytesToPrinter($printerName, $bytes)
if ($result) {
    Write-Host "ZPL sent successfully"
    exit 0
} else {
    Write-Error "Failed to send ZPL to printer"
    exit 1
}
`
        await writeFile(psScriptFile, psScript, 'utf8')

        try {
          const { stdout, stderr } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${psScriptFile}"`,
            { encoding: 'utf8' }
          )
          console.log(`[Job Processor] PowerShell ZPL output: ${stdout || '(empty)'}`)
          if (stderr && !stderr.includes('ZPL sent successfully')) {
            console.warn(`[Job Processor] PowerShell ZPL stderr: ${stderr}`)
          }
        } finally {
          setTimeout(() => unlink(psScriptFile).catch(() => {}), 5000)
        }
      } else if (process.platform === 'darwin') {
        // macOS: Use Python script with libusb for direct USB communication
        // This bypasses CUPS driver filters completely for reliable ZPL printing
        const scriptPath = join(__dirname, '../../scripts/zebra_print.py')

        console.log(`[Job Processor] Using Python USB direct for macOS`)
        console.log(`[Job Processor] Script: ${scriptPath}`)

        try {
          const { stdout, stderr } = await execAsync(
            `python3 '${scriptPath}' '${tempFile}'`,
            { encoding: 'utf8' }
          )

          console.log(`[Job Processor] Python USB output: ${stdout || stderr}`)

          if (stderr && stderr.includes('ERROR')) {
            throw new Error(stderr)
          }
        } catch (pythonError) {
          // Fallback to CUPS USB backend
          console.log(`[Job Processor] Python USB failed, trying CUPS backend...`)
          const deviceUri = await this.getZebraDeviceUri(printer)

          if (deviceUri) {
            const { stdout, stderr } = await execAsync(
              `cat '${tempFile}' | /usr/libexec/cups/backend/usb 1 user "ZPL Print" 1 ''`,
              {
                encoding: 'utf8',
                env: { ...process.env, DEVICE_URI: deviceUri }
              }
            )
            console.log(`[Job Processor] CUPS backend output: ${stdout || stderr}`)
          } else {
            // Last resort: lp command
            const queueName = printer.rawQueueName || printer.systemName
            const printerName = queueName.replace(/'/g, "'\\''")
            const { stdout } = await execAsync(`lp -d '${printerName}' -o raw '${tempFile}'`, {
              encoding: 'utf8'
            })
            console.log(`[Job Processor] lp output: ${stdout}`)
          }
        }
      } else {
        // Linux: use lp with raw option
        const queueName = printer.rawQueueName || printer.systemName
        const printerName = queueName.replace(/'/g, "'\\''")

        console.log(`[Job Processor] Using queue: ${queueName}`)
        console.log(`[Job Processor] Executing: lp -d '${printerName}' -o raw '${tempFile}'`)

        const { stdout, stderr } = await execAsync(`lp -d '${printerName}' -o raw '${tempFile}'`, {
          encoding: 'utf8'
        })

        if (stderr) {
          console.error(`[Job Processor] ZPL print stderr: ${stderr}`)
          throw new Error(`ZPL print error: ${stderr}`)
        }

        console.log(`[Job Processor] ZPL print stdout: ${stdout || '(empty)'}`)
      }

      console.log(`[Job Processor] ZPL sent successfully to ${printer.printerName}`)
    } catch (error) {
      console.error(`[Job Processor] ZPL print failed:`, error)
      throw error
    } finally {
      setTimeout(() => {
        unlink(tempFile).catch(() => {})
      }, 5000)
    }
  }

  /**
   * Get the USB device URI for a Zebra printer on macOS
   */
  private async getZebraDeviceUri(printer: DetectedPrinter): Promise<string | null> {
    try {
      // Get device URI from lpstat
      const { stdout } = await execAsync(`lpstat -v | grep -i zebra`, { encoding: 'utf8' })
      const lines = stdout.split('\n')

      for (const line of lines) {
        // Parse: "dispositivo para PrinterName: usb://..."
        const match = line.match(/:\s*(usb:\/\/[^\s]+)/)
        if (match) {
          return match[1]
        }
      }

      return null
    } catch {
      return null
    }
  }

  private async printEscPos(printer: DetectedPrinter, data: Buffer, copies: number = 1): Promise<void> {
    // For USB thermal printers, send raw ESC/POS data
    // For multiple copies, concatenate the data (ESC/POS doesn't have native copies command)
    let printData = data
    if (copies > 1) {
      const chunks: Buffer[] = []
      for (let i = 0; i < copies; i++) {
        chunks.push(data)
      }
      printData = Buffer.concat(chunks)
      console.log(`[Job Processor] ESC/POS data concatenated for ${copies} copies`)
    }

    const tempFile = join(tmpdir(), `print-${uuidv4()}.bin`)
    await writeFile(tempFile, printData)

    console.log(`[Job Processor] ESC/POS temp file: ${tempFile} (${printData.length} bytes, ${copies} copies)`)
    console.log(`[Job Processor] ESC/POS data preview (first 100 bytes hex): ${printData.slice(0, 100).toString('hex')}`)

    try {
      if (process.platform === 'win32') {
        // Windows: Use PowerShell to send raw data to printer via Windows Spooler
        const escapedPrinter = printer.systemName.replace(/'/g, "''").replace(/"/g, '`"')
        const escapedFile = tempFile.replace(/\\/g, '/')

        console.log(`[Job Processor] Windows ESC/POS: Sending to "${printer.systemName}"`)

        // Create a simple PowerShell script file to avoid command line escaping issues
        const psScriptFile = join(tmpdir(), `print-script-${uuidv4()}.ps1`)
        const psScript = `
$printerName = '${escapedPrinter}'
$filePath = '${escapedFile}'

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrint {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendRawData(string printerName, byte[] data) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFO di = new DOCINFO();
        di.pDocName = "ESC/POS Receipt";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            Console.WriteLine("ERROR: OpenPrinter failed - " + Marshal.GetLastWin32Error());
            return false;
        }

        if (!StartDocPrinter(hPrinter, 1, ref di)) {
            Console.WriteLine("ERROR: StartDocPrinter failed - " + Marshal.GetLastWin32Error());
            ClosePrinter(hPrinter);
            return false;
        }

        if (!StartPagePrinter(hPrinter)) {
            Console.WriteLine("ERROR: StartPagePrinter failed - " + Marshal.GetLastWin32Error());
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        int written = 0;
        bool success = WritePrinter(hPrinter, data, data.Length, out written);

        if (!success) {
            Console.WriteLine("ERROR: WritePrinter failed - " + Marshal.GetLastWin32Error());
        }

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        return success && written == data.Length;
    }
}
"@

try {
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $result = [RawPrint]::SendRawData($printerName, $bytes)
    if ($result) {
        Write-Host "SUCCESS"
    } else {
        Write-Host "FAILED"
        exit 1
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}
`
        await writeFile(psScriptFile, psScript)

        try {
          const { stdout, stderr } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${psScriptFile}"`,
            { encoding: 'utf8', timeout: 30000 }
          )

          console.log(`[Job Processor] PowerShell raw print output: ${stdout || stderr}`)

          if (!stdout.includes('SUCCESS')) {
            throw new Error(`Raw print failed: ${stderr || stdout}`)
          }
        } finally {
          // Clean up script file
          unlink(psScriptFile).catch(() => {})
        }
      } else {
        // On macOS/Linux, use lp command with raw option
        const printerName = printer.systemName.replace(/'/g, "'\\''")
        await execAsync(`lp -d '${printerName}' -o raw '${tempFile}'`)
      }

      console.log(`[Job Processor] ESC/POS data sent successfully`)
    } finally {
      // Clean up temp file after a short delay
      setTimeout(() => {
        unlink(tempFile).catch(() => {})
      }, 5000)
    }
  }

  private async printPdf(printer: DetectedPrinter, data: Buffer, mediaSize?: string, copies: number = 1): Promise<void> {
    const tempFile = join(tmpdir(), `print-${uuidv4()}.pdf`)
    await writeFile(tempFile, data)

    console.log(`[Job Processor] PDF file created: ${tempFile} (${data.length} bytes)`)
    console.log(`[Job Processor] Sending to printer: ${printer.systemName} (${printer.printerType})`)
    console.log(`[Job Processor] Copies: ${copies}`)
    if (mediaSize) {
      console.log(`[Job Processor] Using media size: ${mediaSize}`)
    }

    try {
      if (process.platform === 'win32') {
        // Windows: Use PowerShell script file for reliable PDF printing
        console.log(`[Job Processor] Windows PDF: Attempting to print to "${printer.systemName}"`)

        // Create a PowerShell script file to avoid escaping issues
        const psScriptFile = join(tmpdir(), `pdf-print-${uuidv4()}.ps1`)
        const printerName = printer.systemName
        const pdfPath = tempFile

        // PowerShell script that uses multiple methods to print PDF
        // Build paths without backticks (use single quotes in PowerShell)
        const psScript = [
          "param(",
          `    [string]$PrinterName = '${printerName.replace(/'/g, "''")}',`,
          `    [string]$PdfPath = '${pdfPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}',`,
          `    [int]$Copies = ${copies}`,
          ")",
          "",
          "$ErrorActionPreference = 'Stop'",
          "$success = $false",
          "",
          "Write-Host \"Attempting to print: $PdfPath\"",
          "Write-Host \"To printer: $PrinterName\"",
          "Write-Host \"Copies: $Copies\"",
          "",
          "# Check if file exists",
          "if (-not (Test-Path $PdfPath)) {",
          "    Write-Host \"ERROR: PDF file not found: $PdfPath\"",
          "    exit 1",
          "}",
          "",
          "# Check if printer exists",
          "$printerObj = Get-WmiObject -Query \"SELECT * FROM Win32_Printer WHERE Name='$PrinterName'\" -ErrorAction SilentlyContinue",
          "if (-not $printerObj) {",
          "    Write-Host \"ERROR: Printer not found: $PrinterName\"",
          "    Write-Host \"Available printers:\"",
          "    Get-WmiObject -Query \"SELECT Name FROM Win32_Printer\" | ForEach-Object { Write-Host \"  - $($_.Name)\" }",
          "    exit 1",
          "}",
          "Write-Host \"Printer found: $PrinterName\"",
          "",
          "# Method 1: Use Out-Printer with PDF reader (most reliable)",
          "try {",
          "    Write-Host \"Method 1: Using Start-Process with PrintTo verb\"",
          "    ",
          "    # Get the default application for PDF files",
          "    $pdfAssoc = (Get-ItemProperty -Path 'Registry::HKEY_CLASSES_ROOT\\.pdf' -ErrorAction SilentlyContinue).'(default)'",
          "    Write-Host \"PDF association: $pdfAssoc\"",
          "    ",
          "    # Set the printer as default temporarily",
          "    $currentDefault = (Get-WmiObject -Query \"SELECT * FROM Win32_Printer WHERE Default=True\" -ErrorAction SilentlyContinue).Name",
          "    Write-Host \"Current default printer: $currentDefault\"",
          "    ",
          "    # Set target printer as default",
          "    $printerObj.SetDefaultPrinter() | Out-Null",
          "    Write-Host \"Set $PrinterName as default printer\"",
          "    Start-Sleep -Milliseconds 500",
          "    ",
          "    # Print each copy",
          "    for ($copy = 1; $copy -le $Copies; $copy++) {",
          "        Write-Host \"Printing copy $copy of $Copies...\"",
          "        ",
          "        # Use PrintTo verb which prints to default printer",
          "        $psi = New-Object System.Diagnostics.ProcessStartInfo",
          "        $psi.FileName = $PdfPath",
          "        $psi.Verb = 'PrintTo'",
          "        $psi.Arguments = $PrinterName",
          "        $psi.CreateNoWindow = $true",
          "        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden",
          "        $psi.UseShellExecute = $true",
          "        ",
          "        $proc = [System.Diagnostics.Process]::Start($psi)",
          "        ",
          "        # Wait for process to complete or timeout",
          "        $timeout = 30",
          "        $waited = 0",
          "        while (-not $proc.HasExited -and $waited -lt $timeout) {",
          "            Start-Sleep -Seconds 1",
          "            $waited++",
          "        }",
          "        ",
          "        if (-not $proc.HasExited) {",
          "            Write-Host \"Process still running after $timeout seconds, killing...\"",
          "            $proc.Kill()",
          "        }",
          "        ",
          "        # Small delay between copies",
          "        if ($copy -lt $Copies) {",
          "            Start-Sleep -Milliseconds 200",
          "        }",
          "    }",
          "    ",
          "    # Restore original default printer",
          "    if ($currentDefault -and $currentDefault -ne $PrinterName) {",
          "        $origPrinter = Get-WmiObject -Query \"SELECT * FROM Win32_Printer WHERE Name='$currentDefault'\" -ErrorAction SilentlyContinue",
          "        if ($origPrinter) {",
          "            $origPrinter.SetDefaultPrinter() | Out-Null",
          "            Write-Host \"Restored default printer: $currentDefault\"",
          "        }",
          "    }",
          "    ",
          "    $success = $true",
          "    Write-Host \"SUCCESS:PRINTTO\"",
          "    exit 0",
          "} catch {",
          "    Write-Host \"PrintTo method failed: $_\"",
          "}",
          "",
          "# Method 2: Use SumatraPDF if available (best for silent printing)",
          "$sumatraPaths = @(",
          "    \"$env:LOCALAPPDATA\\SumatraPDF\\SumatraPDF.exe\",",
          "    \"$env:ProgramFiles\\SumatraPDF\\SumatraPDF.exe\",",
          "    \"${env:ProgramFiles(x86)}\\SumatraPDF\\SumatraPDF.exe\"",
          ")",
          "foreach ($sumatra in $sumatraPaths) {",
          "    if (Test-Path $sumatra) {",
          "        Write-Host \"Method 2: Using SumatraPDF: $sumatra ($Copies copies)\"",
          "        try {",
          "            # SumatraPDF supports -print-settings for copies",
          "            $printSettings = \"$Copies" + "x\"",
          "            $proc = Start-Process -FilePath $sumatra -ArgumentList \"-print-to\", \"`\"$PrinterName`\"\", \"-print-settings\", $printSettings, \"-silent\", \"`\"$PdfPath`\"\" -PassThru -Wait -NoNewWindow",
          "            if ($proc.ExitCode -eq 0) {",
          "                $success = $true",
          "                Write-Host \"SUCCESS:SUMATRA\"",
          "                exit 0",
          "            } else {",
          "                Write-Host \"SumatraPDF exited with code: $($proc.ExitCode)\"",
          "            }",
          "        } catch {",
          "            Write-Host \"SumatraPDF failed: $_\"",
          "        }",
          "    }",
          "}",
          "",
          "# Method 3: Use Adobe Acrobat Reader",
          "$adobePaths = @(",
          "    \"$env:ProgramFiles\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe\",",
          "    \"${env:ProgramFiles(x86)}\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe\",",
          "    \"$env:ProgramFiles\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe\",",
          "    \"${env:ProgramFiles(x86)}\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe\"",
          ")",
          "foreach ($adobe in $adobePaths) {",
          "    if (Test-Path $adobe) {",
          "        Write-Host \"Method 3: Using Adobe: $adobe ($Copies copies)\"",
          "        try {",
          "            for ($copy = 1; $copy -le $Copies; $copy++) {",
          "                Write-Host \"  Printing copy $copy of $Copies...\"",
          "                $proc = Start-Process -FilePath $adobe -ArgumentList '/t', \"`\"$PdfPath`\"\", \"`\"$PrinterName`\"\" -PassThru",
          "                Start-Sleep -Seconds 5",
          "                Get-Process -Name 'AcroRd32', 'Acrobat' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
          "            }",
          "            $success = $true",
          "            Write-Host \"SUCCESS:ADOBE\"",
          "            exit 0",
          "        } catch {",
          "            Write-Host \"Adobe failed: $_\"",
          "        }",
          "    }",
          "}",
          "",
          "# Method 4: Use Foxit Reader",
          "$foxitPaths = @(",
          "    \"${env:ProgramFiles(x86)}\\Foxit Software\\Foxit Reader\\FoxitReader.exe\",",
          "    \"$env:ProgramFiles\\Foxit Software\\Foxit Reader\\FoxitReader.exe\",",
          "    \"${env:ProgramFiles(x86)}\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe\",",
          "    \"$env:ProgramFiles\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe\"",
          ")",
          "foreach ($foxit in $foxitPaths) {",
          "    if (Test-Path $foxit) {",
          "        Write-Host \"Method 4: Using Foxit: $foxit ($Copies copies)\"",
          "        try {",
          "            for ($copy = 1; $copy -le $Copies; $copy++) {",
          "                Write-Host \"  Printing copy $copy of $Copies...\"",
          "                $proc = Start-Process -FilePath $foxit -ArgumentList '/t', \"`\"$PdfPath`\"\", \"`\"$PrinterName`\"\" -PassThru",
          "                Start-Sleep -Seconds 5",
          "                Get-Process -Name 'FoxitReader', 'FoxitPDFReader' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
          "            }",
          "            $success = $true",
          "            Write-Host \"SUCCESS:FOXIT\"",
          "            exit 0",
          "        } catch {",
          "            Write-Host \"Foxit failed: $_\"",
          "        }",
          "    }",
          "}",
          "",
          "if (-not $success) {",
          "    Write-Host \"FAILED:ALL - No print method succeeded\"",
          "    Write-Host \"Please install a PDF reader (Adobe Reader, Foxit, or SumatraPDF) to enable PDF printing\"",
          "    exit 1",
          "}",
        ].join('\n')
        await writeFile(psScriptFile, psScript, 'utf8')

        try {
          const { stdout, stderr } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${psScriptFile}"`,
            { encoding: 'utf8', timeout: 60000 }
          )

          console.log(`[Job Processor] Windows PDF print output: ${stdout || '(empty)'}`)
          if (stderr) {
            console.log(`[Job Processor] Windows PDF print stderr: ${stderr}`)
          }

          if (stdout.includes('FAILED:ALL') || (!stdout.includes('SUCCESS') && stderr && stderr.includes('failed'))) {
            throw new Error('All PDF printing methods failed')
          }
        } finally {
          // Clean up script file
          setTimeout(() => unlink(psScriptFile).catch(() => {}), 5000)
        }
      } else if (process.platform === 'darwin') {
        // macOS: use lp command and capture output
        const printerName = printer.systemName.replace(/'/g, "'\\''")

        // Build options string
        const options: string[] = []
        // Add copies option (-n)
        if (copies > 1) {
          options.push(`-n ${copies}`)
        }
        if (mediaSize) {
          options.push(`-o media=${mediaSize}`)
        }
        // For label printers, disable fit-to-page to maintain exact size
        if (printer.printerType === 'label' || printer.isZebra) {
          options.push('-o fit-to-page')
        }
        const optionsStr = options.length > 0 ? options.join(' ') + ' ' : ''

        const cmd = `lp -d '${printerName}' ${optionsStr}'${tempFile}'`
        console.log(`[Job Processor] Executing: ${cmd}`)

        const { stdout, stderr } = await execAsync(cmd, {
          encoding: 'utf8'
        })

        if (stderr) {
          console.error(`[Job Processor] lp stderr: ${stderr}`)
          throw new Error(`Print command error: ${stderr}`)
        }

        console.log(`[Job Processor] lp stdout: ${stdout || '(empty)'}`)

        // lp returns "request id is PRINTER-XXX" on success
        if (!stdout.includes('request id')) {
          console.warn(`[Job Processor] Unexpected lp output, job may not have been queued`)
        }

        // Wait a moment and check if the job was actually queued
        await new Promise(resolve => setTimeout(resolve, 1000))

        try {
          const { stdout: queueStatus } = await execAsync(`lpstat -o '${printerName}' 2>/dev/null || echo ""`, {
            encoding: 'utf8'
          })
          console.log(`[Job Processor] Queue status: ${queueStatus || '(empty - job may have completed)'}`)
        } catch {
          // lpstat check is optional
        }
      } else {
        // Linux: use lp command with -n for copies
        const copiesOption = copies > 1 ? `-n ${copies} ` : ''
        const { stdout, stderr } = await execAsync(`lp -d "${printer.systemName}" ${copiesOption}"${tempFile}"`, {
          encoding: 'utf8'
        })
        if (stderr) {
          console.error(`[Job Processor] lp stderr: ${stderr}`)
          throw new Error(`Print command error: ${stderr}`)
        }
        console.log(`[Job Processor] lp stdout: ${stdout || '(empty)'}`)
      }

      console.log(`[Job Processor] Print job sent successfully to ${printer.printerName} (${copies} copies)`)
    } catch (error) {
      console.error(`[Job Processor] Print failed:`, error)
      throw error
    } finally {
      // Clean up temp file after a delay (to ensure printing starts)
      setTimeout(() => {
        unlink(tempFile).catch(() => {})
      }, 10000) // Extended to 10 seconds
    }
  }

  /**
   * Print PDF label on non-Zebra label printers (TSC, 4BARCODE, etc.)
   * Uses specific media sizes for 2x1 and 3x2 inch labels
   */
  private async printPdfLabel(printer: DetectedPrinter, data: Buffer, labelSize: string, copies: number = 1): Promise<void> {
    const tempFile = join(tmpdir(), `print-label-${uuidv4()}.pdf`)
    await writeFile(tempFile, data)

    console.log(`[Job Processor] PDF Label file created: ${tempFile} (${data.length} bytes)`)
    console.log(`[Job Processor] Label size: ${labelSize}`)
    console.log(`[Job Processor] Sending to label printer: ${printer.systemName} (${printer.printerType})`)
    console.log(`[Job Processor] Copies: ${copies}`)

    // Map label sizes to media dimensions
    // Label printers typically use custom media sizes
    const mediaSizes: Record<string, { width: number; height: number; name: string }> = {
      '2x1': { width: 144, height: 72, name: 'Custom.144x72pt' },   // 2x1 inches in points
      '3x2': { width: 216, height: 144, name: 'Custom.216x144pt' }, // 3x2 inches in points
      '4x6': { width: 288, height: 432, name: 'Custom.288x432pt' }, // 4x6 inches in points
    }

    const media = mediaSizes[labelSize] || mediaSizes['3x2']
    console.log(`[Job Processor] Using media: ${media.name} (${media.width}x${media.height} points)`)

    try {
      if (process.platform === 'win32') {
        // Windows: Use SumatraPDF or default PDF viewer with PrintTo
        console.log(`[Job Processor] Windows Label PDF: Printing to "${printer.systemName}"`)

        const psScriptFile = join(tmpdir(), `label-print-${uuidv4()}.ps1`)
        const printerName = printer.systemName
        const pdfPath = tempFile

        // PowerShell script for label printing
        const psScript = [
          "param(",
          `    [string]$PrinterName = '${printerName.replace(/'/g, "''")}',`,
          `    [string]$PdfPath = '${pdfPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}',`,
          `    [int]$Copies = ${copies}`,
          ")",
          "",
          "$ErrorActionPreference = 'Stop'",
          "",
          "Write-Host \"Printing PDF label: $PdfPath\"",
          "Write-Host \"To printer: $PrinterName\"",
          "Write-Host \"Copies: $Copies\"",
          "",
          "if (-not (Test-Path $PdfPath)) {",
          "    Write-Host \"ERROR: PDF file not found\"",
          "    exit 1",
          "}",
          "",
          "# Set the printer as default temporarily",
          "$printerObj = Get-WmiObject -Query \"SELECT * FROM Win32_Printer WHERE Name='$PrinterName'\" -ErrorAction SilentlyContinue",
          "if ($printerObj) {",
          "    $printerObj.SetDefaultPrinter() | Out-Null",
          "    Write-Host \"Set $PrinterName as default printer\"",
          "}",
          "",
          "Start-Sleep -Milliseconds 500",
          "",
          "for ($copy = 1; $copy -le $Copies; $copy++) {",
          "    Write-Host \"Printing copy $copy of $Copies...\"",
          "    $psi = New-Object System.Diagnostics.ProcessStartInfo",
          "    $psi.FileName = $PdfPath",
          "    $psi.Verb = 'PrintTo'",
          "    $psi.Arguments = $PrinterName",
          "    $psi.CreateNoWindow = $true",
          "    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden",
          "    $psi.UseShellExecute = $true",
          "    ",
          "    $proc = [System.Diagnostics.Process]::Start($psi)",
          "    $proc.WaitForExit(30000)",
          "    ",
          "    if (-not $proc.HasExited) {",
          "        $proc.Kill()",
          "    }",
          "    Start-Sleep -Milliseconds 500",
          "}",
          "",
          "Write-Host \"SUCCESS: Label print job sent\""
        ].join("\n")

        await writeFile(psScriptFile, psScript)

        const { stdout, stderr } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`,
          { encoding: 'utf8', timeout: 60000 }
        )

        console.log(`[Job Processor] Windows label print output: ${stdout || '(empty)'}`)
        if (stderr) {
          console.log(`[Job Processor] Windows label print stderr: ${stderr}`)
        }

        // Clean up script file
        setTimeout(() => unlink(psScriptFile).catch(() => {}), 5000)

      } else if (process.platform === 'darwin') {
        // macOS: use lp with specific media size options for label printers
        const printerName = printer.systemName.replace(/'/g, "'\\''")

        // Build options for label printing
        const options: string[] = []
        if (copies > 1) {
          options.push(`-n ${copies}`)
        }
        // Use custom media size for the label
        options.push(`-o media=${media.name}`)
        // Disable fit-to-page to maintain exact size
        options.push('-o fit-to-page=false')
        // Print at actual size without scaling
        options.push('-o scaling=100')
        // Set orientation to portrait
        options.push('-o orientation-requested=3')

        const optionsStr = options.join(' ')
        const cmd = `lp -d '${printerName}' ${optionsStr} '${tempFile}'`
        console.log(`[Job Processor] Executing: ${cmd}`)

        const { stdout, stderr } = await execAsync(cmd, { encoding: 'utf8' })

        if (stderr && !stderr.includes('request id')) {
          console.error(`[Job Processor] lp stderr: ${stderr}`)
        }
        console.log(`[Job Processor] lp stdout: ${stdout || '(empty)'}`)

      } else {
        // Linux: use lp with custom media size
        const options: string[] = []
        if (copies > 1) {
          options.push(`-n ${copies}`)
        }
        options.push(`-o media=${media.name}`)
        options.push('-o fit-to-page=false')

        const optionsStr = options.join(' ')
        const { stdout, stderr } = await execAsync(
          `lp -d "${printer.systemName}" ${optionsStr} "${tempFile}"`,
          { encoding: 'utf8' }
        )

        if (stderr) {
          console.error(`[Job Processor] lp stderr: ${stderr}`)
        }
        console.log(`[Job Processor] lp stdout: ${stdout || '(empty)'}`)
      }

      console.log(`[Job Processor] Label print job sent successfully to ${printer.printerName} (${copies} copies)`)
    } catch (error) {
      console.error(`[Job Processor] Label print failed:`, error)
      throw error
    } finally {
      setTimeout(() => {
        unlink(tempFile).catch(() => {})
      }, 10000)
    }
  }

  isActive(): boolean {
    return this.isRunning
  }

  getProcessingCount(): number {
    return this.processing.size
  }

  getProcessingJobs(): ProcessingJob[] {
    return Array.from(this.processing.values())
  }
}

export const jobProcessor = new JobProcessor()
