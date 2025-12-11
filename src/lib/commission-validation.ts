/**
 * Commission Validation Library
 *
 * Validates that commissions don't exceed product margin.
 * Critical for ensuring profitable operations.
 */

import { db } from '@/lib/database'

/**
 * Commission configuration from company_commission_config table
 */
export interface CommissionConfig {
  role: string
  activityType?: string
  commissionType: 'fixed' | 'percentage'
  commissionValue: number
  minAmount?: number
  maxAmount?: number
  productServiceId?: number | null
}

/**
 * Margin calculation result
 */
export interface MarginResult {
  miCosto: number
  precioPublico: number
  margenBruto: number
  maxCommissionPercentage: number
  maxComisionesPermitidas: number
}

/**
 * Commission validation result
 */
export interface CommissionValidationResult {
  isValid: boolean
  margin: MarginResult
  totalComisionesActuales: number
  totalComisionesProyectadas: number
  margenRestante: number
  porcentajeUsado: number
  exceso: number
  estadoSalud: 'good' | 'warning' | 'critical'
  detalleComisiones: Array<{
    role: string
    activityType: string
    type: string
    value: number
    calculatedAmount: number
    serviceId?: number
    serviceName?: string
  }>
}

/**
 * Calculates the available margin for commissions on a product
 *
 * Margin Formula:
 * - margenBruto = precioPublico - miCosto
 * - maxComisionesPermitidas = margenBruto * (max_commission_percentage / 100)
 *
 * @param companyId - Company ID to check pricing for
 * @param productId - Product ID from product_catalog
 * @param client - Optional database client (for transactions)
 */
export async function calculateAvailableMargin(
  companyId: number,
  productId: number,
  client: typeof db = db
): Promise<MarginResult> {
  const result = await client.query(`
    SELECT
      COALESCE(cpp.mi_costo, pc.mi_costo, 0) as mi_costo,
      COALESCE(cpp.precio_clientes, cpp.precio_publico, pc.precio_publico, 0) as precio_publico,
      COALESCE(pc.max_commission_percentage, 100) as max_commission_pct
    FROM product_catalog pc
    LEFT JOIN company_product_pricing cpp
      ON cpp.product_id = pc.id AND cpp.company_id = $1
    WHERE pc.id = $2
  `, [companyId, productId])

  if (result.rows.length === 0) {
    throw new Error(`Product ${productId} not found`)
  }

  const row = result.rows[0]
  const miCosto = parseFloat(row.mi_costo) || 0
  const precioPublico = parseFloat(row.precio_publico) || 0
  const maxCommissionPercentage = parseFloat(row.max_commission_pct) || 100
  const margenBruto = precioPublico - miCosto
  const maxComisionesPermitidas = margenBruto * (maxCommissionPercentage / 100)

  return {
    miCosto,
    precioPublico,
    margenBruto,
    maxCommissionPercentage,
    maxComisionesPermitidas: Math.max(0, maxComisionesPermitidas)
  }
}

/**
 * Calculates the commission amount based on configuration
 *
 * @param config - Commission configuration
 * @param basePrice - Base price to calculate percentage from
 */
export function calculateCommissionAmount(
  config: CommissionConfig,
  basePrice: number
): number {
  let amount: number

  if (config.commissionType === 'fixed') {
    amount = config.commissionValue
  } else {
    // Percentage
    amount = basePrice * (config.commissionValue / 100)
  }

  // Apply min/max bounds
  if (config.minAmount !== undefined && amount < config.minAmount) {
    amount = config.minAmount
  }
  if (config.maxAmount !== undefined && amount > config.maxAmount) {
    amount = config.maxAmount
  }

  return Math.max(0, amount)
}

/**
 * Calculates total configured commissions for a product
 * Optionally includes a new commission being added
 *
 * @param companyId - Company ID
 * @param productId - Product ID
 * @param newCommission - Optional new commission to include in calculation
 * @param excludeConfigId - Config ID to exclude (when updating existing)
 * @param client - Optional database client
 */
export async function calculateTotalCommissions(
  companyId: number,
  productId: number,
  newCommission?: CommissionConfig,
  excludeConfigId?: number,
  client: typeof db = db
): Promise<{
  total: number
  details: Array<{
    role: string
    activityType: string
    type: string
    value: number
    calculatedAmount: number
    serviceId?: number
    serviceName?: string
  }>
}> {
  // Get margin for base price calculation
  const margin = await calculateAvailableMargin(companyId, productId, client)
  const basePrice = margin.precioPublico

  // Get existing commissions
  const existingQuery = `
    SELECT
      ccc.id,
      ccc.role,
      ccc.activity_type,
      ccc.commission_type,
      ccc.commission_value,
      ccc.min_amount,
      ccc.max_amount,
      ccc.product_service_id,
      ps.service_name
    FROM company_commission_config ccc
    LEFT JOIN product_services ps ON ccc.product_service_id = ps.id
    WHERE ccc.company_id = $1
      AND ccc.product_id = $2
      AND ccc.is_active = true
  `
  const existingResult = await client.query(existingQuery, [companyId, productId])

  let total = 0
  const details: Array<{
    role: string
    activityType: string
    type: string
    value: number
    calculatedAmount: number
    serviceId?: number
    serviceName?: string
  }> = []

  // Calculate existing commissions
  for (const row of existingResult.rows) {
    // Skip if this is the one being updated
    if (excludeConfigId && row.id === excludeConfigId) {
      continue
    }

    // Skip if same role/activity as new commission (will be replaced)
    if (newCommission &&
        row.role === newCommission.role &&
        row.activity_type === newCommission.activityType &&
        row.product_service_id === newCommission.productServiceId) {
      continue
    }

    const config: CommissionConfig = {
      role: row.role,
      activityType: row.activity_type,
      commissionType: row.commission_type,
      commissionValue: parseFloat(row.commission_value),
      minAmount: row.min_amount ? parseFloat(row.min_amount) : undefined,
      maxAmount: row.max_amount ? parseFloat(row.max_amount) : undefined
    }

    const calculatedAmount = calculateCommissionAmount(config, basePrice)
    total += calculatedAmount

    details.push({
      role: row.role,
      activityType: row.activity_type || 'delivery',
      type: row.commission_type,
      value: parseFloat(row.commission_value),
      calculatedAmount,
      serviceId: row.product_service_id,
      serviceName: row.service_name
    })
  }

  // Add new commission if provided
  if (newCommission) {
    const newAmount = calculateCommissionAmount(newCommission, basePrice)
    total += newAmount

    details.push({
      role: newCommission.role,
      activityType: newCommission.activityType || 'delivery',
      type: newCommission.commissionType,
      value: newCommission.commissionValue,
      calculatedAmount: newAmount,
      serviceId: newCommission.productServiceId || undefined
    })
  }

  return { total, details }
}

/**
 * Validates if a commission configuration is valid for a product
 *
 * @param companyId - Company ID
 * @param productId - Product ID
 * @param newCommission - New commission to validate
 * @param excludeConfigId - Config ID to exclude (when updating)
 * @param client - Optional database client
 */
export async function validateCommission(
  companyId: number,
  productId: number,
  newCommission?: CommissionConfig,
  excludeConfigId?: number,
  client: typeof db = db
): Promise<CommissionValidationResult> {
  // Get margin
  const margin = await calculateAvailableMargin(companyId, productId, client)

  // Calculate current commissions (without new one)
  const currentResult = await calculateTotalCommissions(
    companyId, productId, undefined, excludeConfigId, client
  )

  // Calculate projected commissions (with new one)
  const projectedResult = await calculateTotalCommissions(
    companyId, productId, newCommission, excludeConfigId, client
  )

  const margenRestante = margin.maxComisionesPermitidas - projectedResult.total
  const exceso = projectedResult.total - margin.maxComisionesPermitidas
  const porcentajeUsado = margin.maxComisionesPermitidas > 0
    ? (projectedResult.total / margin.maxComisionesPermitidas) * 100
    : 0

  // Determine health status
  let estadoSalud: 'good' | 'warning' | 'critical'
  if (porcentajeUsado > 100) {
    estadoSalud = 'critical'
  } else if (porcentajeUsado > 80) {
    estadoSalud = 'warning'
  } else {
    estadoSalud = 'good'
  }

  return {
    isValid: exceso <= 0,
    margin,
    totalComisionesActuales: currentResult.total,
    totalComisionesProyectadas: projectedResult.total,
    margenRestante: Math.max(0, margenRestante),
    porcentajeUsado,
    exceso: Math.max(0, exceso),
    estadoSalud,
    detalleComisiones: projectedResult.details
  }
}

/**
 * Updates the total_configured_commissions field in company_product_pricing
 * Call this after adding/updating/deleting commissions
 *
 * @param companyId - Company ID
 * @param productId - Product ID
 * @param client - Optional database client
 */
export async function updateConfiguredCommissionsTotal(
  companyId: number,
  productId: number,
  client: typeof db = db
): Promise<void> {
  const { total } = await calculateTotalCommissions(companyId, productId, undefined, undefined, client)
  const margin = await calculateAvailableMargin(companyId, productId, client)

  // Update or insert into company_product_pricing
  await client.query(`
    INSERT INTO company_product_pricing (company_id, product_id, total_configured_commissions, max_commission_amount, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (company_id, product_id)
    DO UPDATE SET
      total_configured_commissions = $3,
      max_commission_amount = $4,
      updated_at = NOW()
  `, [companyId, productId, total, margin.maxComisionesPermitidas])
}

/**
 * Gets commission summary for a product
 * Useful for displaying in UI
 */
export async function getCommissionSummary(
  companyId: number,
  productId: number
): Promise<{
  producto: {
    id: number
    nombre: string
    miCosto: number
    precioPublico: number
    margenBruto: number
  }
  comisionesActuales: {
    porCreacion: Array<{ rol: string; valor: number; montoCalculado: number }>
    porEntrega: Array<{ rol: string; valor: number; montoCalculado: number }>
    porServicio: Array<{ rol: string; servicio: string; valor: number; montoCalculado: number }>
    total: number
  }
  margenRestante: number
  porcentajeUsado: number
  estadoSalud: 'good' | 'warning' | 'critical'
}> {
  // Get product info
  const productResult = await db.query(`
    SELECT id, name FROM product_catalog WHERE id = $1
  `, [productId])

  if (productResult.rows.length === 0) {
    throw new Error(`Product ${productId} not found`)
  }

  const product = productResult.rows[0]
  const validation = await validateCommission(companyId, productId)

  const porCreacion = validation.detalleComisiones
    .filter(c => c.activityType === 'creation' && !c.serviceId)
    .map(c => ({ rol: c.role, valor: c.value, montoCalculado: c.calculatedAmount }))

  const porEntrega = validation.detalleComisiones
    .filter(c => c.activityType === 'delivery' && !c.serviceId)
    .map(c => ({ rol: c.role, valor: c.value, montoCalculado: c.calculatedAmount }))

  const porServicio = validation.detalleComisiones
    .filter(c => c.serviceId)
    .map(c => ({
      rol: c.role,
      servicio: c.serviceName || `Service ${c.serviceId}`,
      valor: c.value,
      montoCalculado: c.calculatedAmount
    }))

  return {
    producto: {
      id: product.id,
      nombre: product.name,
      miCosto: validation.margin.miCosto,
      precioPublico: validation.margin.precioPublico,
      margenBruto: validation.margin.margenBruto
    },
    comisionesActuales: {
      porCreacion,
      porEntrega,
      porServicio,
      total: validation.totalComisionesActuales
    },
    margenRestante: validation.margenRestante,
    porcentajeUsado: validation.porcentajeUsado,
    estadoSalud: validation.estadoSalud
  }
}

/**
 * Validates commissions at runtime (during payment distribution)
 * Returns warning but doesn't block - just logs
 *
 * @param companyId - Company ID
 * @param productId - Product ID
 * @param totalCommissionsToPay - Total commissions about to be paid
 */
export async function validateRuntimeCommissions(
  companyId: number,
  productId: number,
  totalCommissionsToPay: number
): Promise<{
  isWithinMargin: boolean
  margin: MarginResult
  exceso: number
  warning?: string
}> {
  const margin = await calculateAvailableMargin(companyId, productId)
  const exceso = totalCommissionsToPay - margin.maxComisionesPermitidas
  const isWithinMargin = exceso <= 0

  let warning: string | undefined
  if (!isWithinMargin) {
    warning = `Commissions ($${totalCommissionsToPay.toFixed(2)}) exceed margin ($${margin.maxComisionesPermitidas.toFixed(2)}) for product ${productId}`
  }

  return {
    isWithinMargin,
    margin,
    exceso: Math.max(0, exceso),
    warning
  }
}
