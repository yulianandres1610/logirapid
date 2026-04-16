import { generatePosReceipt } from './escpos/pos-receipt'
import { generatePurchaseInvoiceEscpos } from './escpos/purchase-invoice'
import { generateWholesaleInvoiceEscpos } from './escpos/wholesale-invoice'
import { generateWholesaleQuoteEscpos } from './escpos/wholesale-quote'
import { generateConsignmentReceiptEscpos } from './escpos/consignment-receipt'
import { generateUnifiedReceptionEscpos } from './escpos/unified-reception'
import { generateProductLabelZpl } from './zpl/product-label'
import { generateWeightLabelZpl } from './zpl/weight-label'
import { generateLotLabelZpl } from './zpl/lot-label'
import { generateAssetLabelZpl } from './zpl/asset-label'
import { generateShippingLabelZpl } from './zpl/shipping-label'
import { generateProductLabelTspl } from './tspl/product-label'
import { generateWeightLabelTspl } from './tspl/weight-label'
import { generateAssetLabelTspl } from './tspl/asset-label'
import { generateCashRegisterReportPdf } from './pdf/cash-register-report'
import { generatePurchaseInvoicePdf } from './pdf/purchase-invoice'
import { generateWholesaleInvoicePdf } from './pdf/wholesale-invoice'
import { generateSalesReportPdf } from './pdf/sales-report'
import { generateInventoryCountReportPdf } from './pdf/inventory-count-report'
import { generateWarehouseOperationPdf } from './pdf/warehouse-operation'
import { generateWarehouseOperationEscpos } from './escpos/warehouse-operation'
import { generateSessionCloseEscpos } from './escpos/session-close'
import { generateProductionFormulaEscpos } from './escpos/production-formula'
import { generateProductionOrderPdf } from './pdf/production-order'
import { generateWeightLabelPdf } from './pdf/weight-label'
import { generateWarehousePickupTicketPdf } from './pdf/warehouse-pickup-ticket'
import { generateWarehousePickupTicketEscpos } from './escpos/warehouse-pickup-ticket'

interface GenerateResult {
  format: 'escpos' | 'zpl' | 'tspl' | 'pdf'
  data: string // raw string for escpos/zpl/tspl, base64 for pdf
}

// Map printer_type to label format
function getLabelFormat(printerType: string): 'zpl' | 'tspl' {
  if (printerType?.includes('tspl') || printerType?.includes('tsc')) return 'tspl'
  return 'zpl'
}

// Map printer_type to receipt format
function getReceiptFormat(printerType: string): 'escpos' | 'pdf' {
  if (printerType?.includes('standard') || printerType?.includes('pdf') || printerType?.includes('laser')) return 'pdf'
  return 'escpos'
}

export async function generateDocument(
  documentType: string,
  documentData: Record<string, any>,
  printerType: string = 'thermal_80mm'
): Promise<GenerateResult> {
  // Determine format based on document type and printer type
  const isThermal = printerType?.includes('thermal') || printerType?.includes('80mm') || printerType?.includes('58mm')

  let buffer: Buffer
  let format: GenerateResult['format']

  switch (documentType) {
    // ── ESCPOS thermal receipts ──
    case 'pos_receipt':
      if (isThermal) {
        buffer = generatePosReceipt(documentData as any)
        format = 'escpos'
      } else {
        // Fallback: still generate escpos (most POS printers are thermal)
        buffer = generatePosReceipt(documentData as any)
        format = 'escpos'
      }
      break

    case 'purchase_invoice':
      if (isThermal) {
        buffer = generatePurchaseInvoiceEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generatePurchaseInvoicePdf(documentData as any)
        format = 'pdf'
      }
      break

    case 'wholesale_invoice':
      if (isThermal) {
        buffer = generateWholesaleInvoiceEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generateWholesaleInvoicePdf(documentData as any)
        format = 'pdf'
      }
      break

    case 'warehouse_pickup_ticket':
      if (isThermal) {
        buffer = generateWarehousePickupTicketEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generateWarehousePickupTicketPdf(documentData as any)
        format = 'pdf'
      }
      break

    case 'wholesale_quote':
      if (isThermal) {
        buffer = generateWholesaleQuoteEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generateWholesaleInvoicePdf(documentData as any)
        format = 'pdf'
      }
      break

    case 'consignment_receipt':
      buffer = generateConsignmentReceiptEscpos(documentData as any)
      format = 'escpos'
      break

    case 'unified_reception':
      buffer = generateUnifiedReceptionEscpos(documentData as any)
      format = 'escpos'
      break

    // ── Labels ──
    case 'product_label': {
      const labelFmt = getLabelFormat(printerType)
      if (labelFmt === 'tspl') {
        buffer = generateProductLabelTspl(documentData as any)
        format = 'tspl'
      } else {
        buffer = generateProductLabelZpl(documentData as any)
        format = 'zpl'
      }
      break
    }

    case 'weight_label': {
      const labelFmt = getLabelFormat(printerType)
      if (labelFmt === 'tspl') {
        buffer = generateWeightLabelTspl(documentData as any)
        format = 'tspl'
      } else if (printerType?.includes('standard') || printerType?.includes('pdf')) {
        buffer = await generateWeightLabelPdf(documentData as any)
        format = 'pdf'
      } else {
        buffer = generateWeightLabelZpl(documentData as any)
        format = 'zpl'
      }
      break
    }

    case 'lot_label':
      buffer = generateLotLabelZpl(documentData as any)
      format = 'zpl'
      break

    case 'asset_label': {
      const labelFmt = getLabelFormat(printerType)
      if (labelFmt === 'tspl') {
        buffer = generateAssetLabelTspl(documentData as any)
        format = 'tspl'
      } else {
        buffer = generateAssetLabelZpl(documentData as any)
        format = 'zpl'
      }
      break
    }

    case 'shipping_label':
      buffer = generateShippingLabelZpl(documentData as any)
      format = 'zpl'
      break

    // ── PDF reports ──
    case 'cash_register_report':
    case 'session_close_report':
      console.log(`[GenerateDocument] session_close: printerType=${printerType}, isThermal=${isThermal}`)
      if (isThermal) {
        buffer = generateSessionCloseEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generateCashRegisterReportPdf(documentData as any)
        format = 'pdf'
      }
      console.log(`[GenerateDocument] session_close: format=${format}, bufferLen=${buffer.length}`)
      break

    case 'sales_report':
      buffer = await generateSalesReportPdf(documentData as any)
      format = 'pdf'
      break

    case 'inventory_count_report':
      buffer = await generateInventoryCountReportPdf(documentData as any)
      format = 'pdf'
      break

    case 'warehouse_operation':
      if (isThermal) {
        buffer = generateWarehouseOperationEscpos(documentData as any)
        format = 'escpos'
      } else {
        buffer = await generateWarehouseOperationPdf(documentData as any)
        format = 'pdf'
      }
      break

    case 'production_order':
      buffer = await generateProductionOrderPdf(documentData as any)
      format = 'pdf'
      break

    case 'production_formula':
      buffer = generateProductionFormulaEscpos(documentData as any)
      format = 'escpos'
      break

    default:
      throw new Error(`Unknown document type: ${documentType}`)
  }

  // Convert to appropriate data format
  if (format === 'pdf') {
    return { format, data: buffer.toString('base64') }
  } else {
    // For escpos/zpl/tspl, send as raw string (the agent will write to file and print)
    return { format, data: buffer.toString('binary') }
  }
}
