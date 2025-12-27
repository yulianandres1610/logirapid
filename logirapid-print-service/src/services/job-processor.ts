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
import { generatePurchaseInvoice, PurchaseInvoiceData } from '../documents/purchase-invoice'
import { generatePurchaseInvoicePdf } from '../documents/purchase-invoice-pdf'
import { generateSalesReport, SalesReportData } from '../documents/sales-report'
import { generateSalesReportPdf } from '../documents/sales-report-pdf'
import { generateInventoryCountReport, InventoryCountReportData } from '../documents/inventory-count-report'
import { generateInventoryCountReportPdf } from '../documents/inventory-count-report-pdf'
import { generateCashRegisterReport, CashRegisterReportData } from '../documents/cash-register-report'
import { generateCashRegisterReportPdf } from '../documents/cash-register-report-pdf'
import { generateWarehouseOperation, WarehouseOperationData } from '../documents/warehouse-operation'
import { generateWarehouseOperationPdf } from '../documents/warehouse-operation-pdf'
import { generateConsignmentReceipt, ConsignmentReceiptData } from '../documents/consignment-receipt'
import { generateUnifiedReception, UnifiedReceptionData } from '../documents/unified-reception'

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

  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('[Job Processor] Starting...')
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
    console.log('[Job Processor] Registering service...')

    // Detect printers
    const printers = await printerService.detectPrinters()

    // Register with server
    const result = await apiClient.register(printers)

    if (result.success && result.data) {
      console.log(`[Job Processor] Registered successfully. ${result.data.pendingJobs} pending jobs.`)

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
        for (const job of result.data.jobs) {
          // Don't process if already processing
          if (this.processing.has(job.id)) continue

          this.processJob(job)
        }
      }
    } catch (error) {
      console.error('[Job Processor] Poll failed:', error)
    }
  }

  private async processJob(job: PrintJob): Promise<void> {
    console.log(`[Job Processor] Processing job ${job.jobNumber} (${job.documentType})`)

    this.processing.set(job.id, {
      job,
      startedAt: new Date(),
      attempts: 1
    })

    try {
      // Update status to printing
      await apiClient.updateJobStatus(job.id, 'printing')

      // Find appropriate printer
      const printer = this.findPrinter(job)
      if (!printer) {
        throw new Error('No suitable printer found')
      }

      // Generate document (pass printer to determine format: PDF vs ESC/POS)
      const documentBuffer = await this.generateDocument(job, printer)
      if (!documentBuffer) {
        throw new Error('Failed to generate document')
      }

      // Print the document
      await this.printDocument(printer, documentBuffer, job)

      // Update status to completed
      await apiClient.updateJobStatus(job.id, 'completed')

      console.log(`[Job Processor] Job ${job.jobNumber} completed successfully`)
    } catch (error) {
      console.error(`[Job Processor] Job ${job.jobNumber} failed:`, error)

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
      case 'cash_register_report':
        // Prefer thermal printers for receipts and reports
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      case 'shipping_label':
      case 'product_label':
        // Prefer label printers
        return printerService.getLabelPrinters()[0] || printerService.getDefaultPrinter()

      case 'purchase_invoice':
      case 'invoice':
        // For invoices, prefer thermal printers but fall back to any
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      case 'warehouse_operation':
      case 'consignment_receipt':
      case 'unified_reception':
        // For warehouse operations and receipts, prefer thermal printers but fall back to any
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      default:
        return printerService.getDefaultPrinter()
    }
  }

  private async generateDocument(job: PrintJob, printer: DetectedPrinter): Promise<Buffer | null> {
    const data = job.documentData as Record<string, unknown>
    const usePdf = !printer.supportsEscpos || printer.printerType === 'standard'

    console.log(`[Job Processor] Generating ${job.documentType} as ${usePdf ? 'PDF' : 'ESC/POS'} for printer ${printer.printerName}`)

    switch (job.documentType) {
      case 'pos_receipt':
        // POS receipts are always ESC/POS (thermal printer required)
        return generatePosReceipt(data as unknown as ReceiptData)

      case 'shipping_label':
        return generateShippingLabel(data as unknown as ShippingLabelData)

      case 'product_label':
        return generateProductLabel(data as unknown as ProductLabelData)

      case 'purchase_invoice':
      case 'invoice':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generatePurchaseInvoicePdf(data as unknown as PurchaseInvoiceData)
        }
        return generatePurchaseInvoice(data as unknown as PurchaseInvoiceData)

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

      case 'cash_register_report':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateCashRegisterReportPdf(data as unknown as CashRegisterReportData)
        }
        return generateCashRegisterReport(data as unknown as CashRegisterReportData)

      case 'warehouse_operation':
        // Use PDF for standard printers, ESC/POS for thermal
        if (usePdf) {
          return generateWarehouseOperationPdf(data as unknown as WarehouseOperationData)
        }
        return generateWarehouseOperation(data as unknown as WarehouseOperationData)

      case 'consignment_receipt':
        // Always PDF for consignment receipts (has barcodes)
        return generateConsignmentReceipt(data as unknown as ConsignmentReceiptData)

      case 'unified_reception':
        // Always PDF for unified reception receipts (has barcodes)
        return generateUnifiedReception(data as unknown as UnifiedReceptionData)

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

    // Check if we should use ESC/POS (raw binary) or PDF printing
    // ESC/POS is only for thermal printers that support it
    const useEscPos = printer.supportsEscpos &&
                      printer.printerType !== 'standard' &&
                      ['pos_receipt'].includes(job.documentType) // Only POS receipts are always ESC/POS

    // For purchase_invoice, invoice, reports: check if printer supports ESC/POS
    // The document was already generated in the appropriate format by generateDocument()
    const isReceiptOrReport = ['purchase_invoice', 'invoice', 'sales_report',
                               'inventory_count_report', 'cash_register_report',
                               'warehouse_operation'].includes(job.documentType)

    // Consignment receipts and unified reception are always PDF (have barcodes that require PDF rendering)
    const isPdfOnly = ['consignment_receipt', 'unified_reception'].includes(job.documentType)

    for (let i = 0; i < copies; i++) {
      if (isPdfOnly) {
        // PDF printing for documents with barcodes
        console.log(`[Job Processor] Printing via PDF to ${printer.printerName}`)
        await this.printPdf(printer, documentBuffer)
      } else if (useEscPos || (isReceiptOrReport && printer.supportsEscpos && printer.printerType !== 'standard')) {
        // Direct ESC/POS printing for thermal printers
        console.log(`[Job Processor] Printing via ESC/POS to ${printer.printerName}`)
        await this.printEscPos(printer, documentBuffer)
      } else {
        // PDF printing through system for standard/network printers
        console.log(`[Job Processor] Printing via PDF to ${printer.printerName}`)
        await this.printPdf(printer, documentBuffer)
      }

      // Small delay between copies
      if (i < copies - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  private async printEscPos(printer: DetectedPrinter, data: Buffer): Promise<void> {
    // For USB thermal printers, we can write directly to the device
    // This is platform-specific

    if (process.platform === 'win32') {
      // On Windows, use the printer share name
      const tempFile = join(tmpdir(), `print-${uuidv4()}.bin`)
      await writeFile(tempFile, data)

      try {
        await execAsync(`copy /b "${tempFile}" "${printer.systemName}"`, {
          encoding: 'utf8',
          shell: 'cmd.exe'
        })
      } finally {
        await unlink(tempFile).catch(() => {})
      }
    } else {
      // On macOS/Linux, use lp command with raw option
      const tempFile = join(tmpdir(), `print-${uuidv4()}.bin`)
      await writeFile(tempFile, data)

      try {
        await execAsync(`lp -d "${printer.systemName}" -o raw "${tempFile}"`)
      } finally {
        await unlink(tempFile).catch(() => {})
      }
    }
  }

  private async printPdf(printer: DetectedPrinter, data: Buffer): Promise<void> {
    const tempFile = join(tmpdir(), `print-${uuidv4()}.pdf`)
    await writeFile(tempFile, data)

    try {
      if (process.platform === 'win32') {
        // Use SumatraPDF or PowerShell for silent printing
        await execAsync(
          `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb PrintTo -ArgumentList '${printer.systemName}' -Wait"`,
          { encoding: 'utf8' }
        )
      } else if (process.platform === 'darwin') {
        // macOS: use lp command
        await execAsync(`lp -d "${printer.systemName}" "${tempFile}"`)
      } else {
        // Linux: use lp command
        await execAsync(`lp -d "${printer.systemName}" "${tempFile}"`)
      }
    } finally {
      // Clean up temp file after a delay (to ensure printing starts)
      setTimeout(() => {
        unlink(tempFile).catch(() => {})
      }, 5000)
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
