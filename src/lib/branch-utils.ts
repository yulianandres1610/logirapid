/**
 * Utilidades para gestión de sucursales (branches)
 * Manejo de herencia de configuración desde empresa matriz
 */

import { db } from '@/lib/database'

/**
 * Obtiene la configuración completa de la empresa matriz
 */
export async function getParentCompanyConfig(parentId: number) {
  try {
    const result = await db.query(
      `SELECT
        id,
        legalname,
        service_fees,
        enabledservices as enabled_services,
        subdomain,
        logo_url,
        primary_color,
        secondary_color
      FROM companies
      WHERE id = $1`,
      [parentId]
    )

    if (result.rows.length === 0) {
      throw new Error('Empresa matriz no encontrada')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error obteniendo configuración de empresa matriz:', error)
    throw error
  }
}

/**
 * Hereda los fees de la empresa matriz
 * Las sucursales NO configuran sus propios fees
 */
export async function inheritFeesFromParent(parentId: number) {
  try {
    const parentConfig = await getParentCompanyConfig(parentId)

    // Retornar los service_fees de la empresa matriz
    // Esto será usado al crear la sucursal
    return parentConfig.service_fees || null
  } catch (error) {
    console.error('Error heredando fees de empresa matriz:', error)
    return null
  }
}

/**
 * Obtiene el subdominio de la empresa matriz
 * Las sucursales usan el mismo subdominio que su empresa matriz
 */
export async function getParentSubdomain(parentId: number): Promise<string | null> {
  try {
    const parentConfig = await getParentCompanyConfig(parentId)
    return parentConfig.subdomain || null
  } catch (error) {
    console.error('Error obteniendo subdominio de empresa matriz:', error)
    return null
  }
}

/**
 * Obtiene información de contacto de la empresa matriz
 * Las sucursales usan el mismo teléfono de soporte y website que su empresa matriz
 */
export async function getParentContactInfo(parentId: number): Promise<{
  customerServicePhone: string | null
  website: string | null
}> {
  try {
    const result = await db.query(
      `SELECT customer_service_phone, website
       FROM companies
       WHERE id = $1`,
      [parentId]
    )

    if (result.rows.length === 0) {
      return { customerServicePhone: null, website: null }
    }

    return {
      customerServicePhone: result.rows[0].customer_service_phone || null,
      website: result.rows[0].website || null
    }
  } catch (error) {
    console.error('Error obteniendo información de contacto de empresa matriz:', error)
    return { customerServicePhone: null, website: null }
  }
}

/**
 * Obtiene los servicios habilitados de la empresa matriz
 * Las sucursales solo pueden tener servicios que la matriz tenga habilitados
 */
export async function getParentEnabledServices(parentId: number): Promise<string[]> {
  try {
    const parentConfig = await getParentCompanyConfig(parentId)

    // Parsear enabled_services si es string JSON
    let enabledServices = parentConfig.enabled_services
    if (typeof enabledServices === 'string') {
      enabledServices = JSON.parse(enabledServices)
    }

    return enabledServices || []
  } catch (error) {
    console.error('Error obteniendo servicios de empresa matriz:', error)
    return []
  }
}

/**
 * Valida que los servicios de la sucursal sean un subset de los de la matriz
 */
export function validateBranchServices(
  branchServices: string[],
  parentServices: string[]
): { valid: boolean; invalidServices: string[] } {
  const invalidServices = branchServices.filter(
    service => !parentServices.includes(service)
  )

  return {
    valid: invalidServices.length === 0,
    invalidServices
  }
}

/**
 * Actualiza los fees de sucursales existentes para heredar de su matriz
 * Función de migración para datos existentes
 */
export async function migrateBranchFeesToParent() {
  try {
    // Obtener todas las sucursales
    const branches = await db.query(
      `SELECT id, parent_company_id
       FROM companies
       WHERE is_branch = true AND parent_company_id IS NOT NULL`
    )

    const updates = []

    for (const branch of branches.rows) {
      const parentFees = await inheritFeesFromParent(branch.parent_company_id)

      if (parentFees) {
        await db.query(
          `UPDATE companies
           SET service_fees = $1, updated_at = NOW()
           WHERE id = $2`,
          [parentFees, branch.id]
        )
        updates.push(branch.id)
      }
    }

    return {
      success: true,
      updated: updates.length,
      branchIds: updates
    }
  } catch (error) {
    console.error('Error migrando fees de sucursales:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Copia subdominios de empresas matriz a sucursales
 * Las sucursales usan el MISMO subdominio que su empresa matriz
 */
export async function syncBranchSubdomains() {
  try {
    const result = await db.query(
      `UPDATE companies AS branch
       SET subdomain = parent.subdomain, updated_at = NOW()
       FROM companies AS parent
       WHERE branch.is_branch = true
         AND branch.parent_company_id = parent.id
         AND branch.parent_company_id IS NOT NULL
         AND (branch.subdomain IS NULL OR branch.subdomain != parent.subdomain)
       RETURNING branch.id, branch.legalname as name, branch.subdomain`
    )

    return {
      success: true,
      updated: result.rows.length,
      branches: result.rows
    }
  } catch (error) {
    console.error('Error sincronizando subdominios de sucursales:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
