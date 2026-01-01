import { db } from '@/lib/database'

/**
 * Helper function to link temporary uploads to an order
 * Called after order creation to update invoice records
 */
export async function linkInvoicesToOrder(
  tempId: string,
  orderId: number,
  orderType: 'consignment' | 'purchase',
  companyId: number,
  userId: number,
  invoices: Array<{ storagePath: string; originalName: string; fileType: string; fileSize: number }>
) {
  const results = []

  for (const invoice of invoices) {
    try {
      const insertQuery = orderType === 'consignment'
        ? `INSERT INTO order_invoices (consignment_order_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
        : `INSERT INTO order_invoices (purchase_id, file_name, original_name, storage_path, file_type, file_size, company_id, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

      const fileName = invoice.storagePath.split('/').pop() || invoice.originalName

      const result = await db.query(insertQuery, [
        orderId,
        fileName,
        invoice.originalName,
        invoice.storagePath,
        invoice.fileType,
        invoice.fileSize,
        companyId,
        userId
      ])

      results.push({
        id: result.rows[0].id,
        originalName: invoice.originalName
      })
    } catch (error) {
      console.error(`[ORDER INVOICES] Error linking invoice:`, error)
    }
  }

  return results
}
