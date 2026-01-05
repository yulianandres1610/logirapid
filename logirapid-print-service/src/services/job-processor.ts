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
import { generateLotLabelZpl, LotLabelData } from '../documents/lot-label-zpl'
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
import { generateTransferReceipt, TransferReceiptData } from '../documents/transfer-receipt'

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
      case 'cash_register_report':
        // Prefer thermal printers for receipts and reports
        return printerService.getThermalPrinters()[0] || printerService.getDefaultPrinter()

      case 'shipping_label':
      case 'product_label':
      case 'lot_label':
        // Prefer label printers (Zebra) for labels
        return printerService.getLabelPrinters()[0] || printerService.getDefaultPrinter()

      case 'purchase_invoice':
      case 'invoice':
        // For invoices, prefer standard printers
        return printerService.getStandardPrinters()[0] || printerService.getDefaultPrinter()

      case 'warehouse_operation':
      case 'consignment_receipt':
      case 'unified_reception':
      case 'transfer_receipt':
        // Reception receipts should print on STANDARD printer (not Zebra label printer)
        // These documents have too much information for label printers
        return printerService.getStandardPrinters()[0] || printerService.getDefaultPrinter()

      default:
        return printerService.getDefaultPrinter()
    }
  }

  private async generateDocument(job: PrintJob, printer: DetectedPrinter): Promise<Buffer | null> {
    const data = job.documentData as Record<string, unknown>
    const usePdf = !printer.supportsEscpos || printer.printerType === 'standard'

    // For Zebra printers, use ZPL:
    // - On Windows: always works natively
    // - On macOS: use Python USB script to bypass CUPS driver filters
    // - On Linux: only if we have a RAW queue
    const hasRawQueue = !!printer.rawQueueName
    const useZpl = printer.isZebra && (
      process.platform === 'win32' ||
      process.platform === 'darwin' ||  // macOS: use Python USB script
      hasRawQueue                        // Linux: only with RAW queue
    )

    console.log(`[Job Processor] Generating ${job.documentType}:`)
    console.log(`[Job Processor]   - Printer: ${printer.printerName}`)
    console.log(`[Job Processor]   - Is Zebra: ${printer.isZebra}`)
    console.log(`[Job Processor]   - Platform: ${process.platform}`)
    console.log(`[Job Processor]   - Has RAW queue: ${hasRawQueue} (${printer.rawQueueName || 'none'})`)
    console.log(`[Job Processor]   - Use ZPL: ${useZpl}`)
    console.log(`[Job Processor]   - Use PDF: ${!useZpl || usePdf}`)

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
        // For Zebra printers, use ZPL (on macOS via Python USB script, on Windows directly)
        if (useZpl) {
          console.log(`[Job Processor] Generating product label as ZPL for Zebra printer`)
          return generateProductLabelZpl(data as unknown as ProductLabelData)
        }
        console.log(`[Job Processor] Generating product label as PDF (CUPS will convert to raster)`)
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

      case 'transfer_receipt':
        // Always PDF for transfer receipts (has barcodes)
        return generateTransferReceipt(data as unknown as TransferReceiptData)

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
    // For Zebra printers:
    // - On Windows: use raw ZPL directly
    // - On macOS: use Python USB script (bypasses CUPS)
    // - On Linux: use ZPL via RAW queue if available
    const isZebraLabel = printer.isZebra &&
      (process.platform === 'win32' || process.platform === 'darwin' || hasRawQueue) &&
      ['product_label', 'shipping_label', 'lot_label'].includes(job.documentType)
    const useEscPos = printer.supportsEscpos &&
                      printer.printerType !== 'standard' &&
                      ['pos_receipt'].includes(job.documentType)
    const isReceiptOrReport = ['purchase_invoice', 'invoice', 'sales_report',
                               'inventory_count_report', 'cash_register_report',
                               'warehouse_operation'].includes(job.documentType)
    const isPdfOnly = ['consignment_receipt', 'unified_reception', 'transfer_receipt'].includes(job.documentType)
    const isLabelDocument = ['product_label', 'shipping_label'].includes(job.documentType)

    console.log(`[Job Processor] Print method selection:`)
    console.log(`[Job Processor]   - isZebraLabel (raw ZPL): ${isZebraLabel}`)
    console.log(`[Job Processor]   - useEscPos: ${useEscPos}`)
    console.log(`[Job Processor]   - isReceiptOrReport: ${isReceiptOrReport}`)
    console.log(`[Job Processor]   - isPdfOnly: ${isPdfOnly}`)
    console.log(`[Job Processor]   - isLabelDocument: ${isLabelDocument}`)

    for (let i = 0; i < copies; i++) {
      console.log(`[Job Processor] Printing copy ${i + 1} of ${copies}...`)

      if (isZebraLabel) {
        // ZPL printing for Zebra label printers via RAW queue
        console.log(`[Job Processor] Using ZPL/RAW method for Zebra printer ${printer.printerName}`)
        console.log(`[Job Processor] RAW queue: ${printer.rawQueueName || '(direct)'}`)
        await this.printZpl(printer, documentBuffer)
      } else if (isPdfOnly || isLabelDocument) {
        // PDF printing for label printers (including Zebra on macOS/Linux via CUPS)
        console.log(`[Job Processor] Using PDF method for label printer ${printer.printerName}`)
        // For label printers, specify the media size
        const labelMediaSize = printer.isZebra ? 'w288h360' : undefined // 4x5 inch label
        await this.printPdf(printer, documentBuffer, labelMediaSize)
      } else if (useEscPos || (isReceiptOrReport && printer.supportsEscpos && printer.printerType !== 'standard')) {
        // Direct ESC/POS printing for thermal printers
        console.log(`[Job Processor] Using ESC/POS method for ${printer.printerName}`)
        await this.printEscPos(printer, documentBuffer)
      } else {
        // PDF printing through system for standard/network printers
        console.log(`[Job Processor] Using PDF method (fallback) for ${printer.printerName}`)
        await this.printPdf(printer, documentBuffer)
      }

      console.log(`[Job Processor] Copy ${i + 1} sent to print queue`)

      // Small delay between copies
      if (i < copies - 1) {
        console.log(`[Job Processor] Waiting 500ms before next copy...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`[Job Processor] All ${copies} copies sent to printer`)
  }

  private async printZpl(printer: DetectedPrinter, data: Buffer): Promise<void> {
    // ZPL is sent as raw text to Zebra printers
    const tempFile = join(tmpdir(), `print-${uuidv4()}.zpl`)
    await writeFile(tempFile, data)

    console.log(`[Job Processor] ZPL file created: ${tempFile} (${data.length} bytes)`)
    console.log(`[Job Processor] ZPL content preview: ${data.toString('utf8').substring(0, 200)}...`)

    try {
      if (process.platform === 'win32') {
        // Windows: send raw to printer
        await execAsync(`copy /b "${tempFile}" "${printer.systemName}"`, {
          encoding: 'utf8',
          shell: 'cmd.exe'
        })
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

  private async printPdf(printer: DetectedPrinter, data: Buffer, mediaSize?: string): Promise<void> {
    const tempFile = join(tmpdir(), `print-${uuidv4()}.pdf`)
    await writeFile(tempFile, data)

    console.log(`[Job Processor] PDF file created: ${tempFile} (${data.length} bytes)`)
    console.log(`[Job Processor] Sending to printer: ${printer.systemName} (${printer.printerType})`)
    if (mediaSize) {
      console.log(`[Job Processor] Using media size: ${mediaSize}`)
    }

    try {
      if (process.platform === 'win32') {
        // Use SumatraPDF or PowerShell for silent printing
        const { stdout, stderr } = await execAsync(
          `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb PrintTo -ArgumentList '${printer.systemName}' -Wait"`,
          { encoding: 'utf8' }
        )
        if (stderr) {
          console.error(`[Job Processor] Windows print stderr: ${stderr}`)
        }
        console.log(`[Job Processor] Windows print stdout: ${stdout || '(empty)'}`)
      } else if (process.platform === 'darwin') {
        // macOS: use lp command and capture output
        const printerName = printer.systemName.replace(/'/g, "'\\''")

        // Build options string
        const options: string[] = []
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
        // Linux: use lp command
        const { stdout, stderr } = await execAsync(`lp -d "${printer.systemName}" "${tempFile}"`, {
          encoding: 'utf8'
        })
        if (stderr) {
          console.error(`[Job Processor] lp stderr: ${stderr}`)
          throw new Error(`Print command error: ${stderr}`)
        }
        console.log(`[Job Processor] lp stdout: ${stdout || '(empty)'}`)
      }

      console.log(`[Job Processor] Print job sent successfully to ${printer.printerName}`)
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
