/**
 * Query Helpers para Multi-Tenancy
 *
 * Utilidades para filtrar queries SQL por empresa (company_id)
 * Permite que SUPER_ADMIN vea datos de todas las empresas
 * y usuarios normales solo vean datos de su empresa
 */

import { NextRequest } from 'next/server'

/**
 * Interfaz para el filtro de empresa
 */
export interface CompanyFilter {
  /** Indica si el usuario es SUPER_ADMIN */
  isSuperAdmin: boolean

  /** ID de la empresa del usuario o del subdominio */
  companyId: number | null

  /** Agrega condición WHERE de empresa a la query */
  addCompanyFilter: (conditions: string[], params: any[]) => void

  /** Construye WHERE clause completo con filtro de empresa */
  buildWhereClause: (additionalConditions: string[]) => string

  /** Agrega parámetro de empresa al array de params */
  addCompanyParam: (params: any[]) => number | null
}

/**
 * Obtiene información de filtrado por empresa desde los headers de la request
 *
 * @param request - NextRequest con headers inyectados por middleware
 * @returns CompanyFilter con métodos helper para filtrar queries
 *
 * @example
 * ```typescript
 * const { isSuperAdmin, companyId, addCompanyFilter } = getCompanyFilter(request)
 *
 * const conditions = []
 * const params = []
 *
 * if (statusFilter) {
 *   params.push(statusFilter)
 *   conditions.push(`status = $${params.length}`)
 * }
 *
 * // Agregar filtro de empresa automáticamente
 * addCompanyFilter(conditions, params)
 *
 * const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
 * const query = `SELECT * FROM orders ${whereClause}`
 * ```
 */
export function getCompanyFilter(request: NextRequest): CompanyFilter {
  // Leer headers inyectados por middleware
  const headerIsSuperAdmin = request.headers.get('x-is-super-admin') === 'true'
  const headerCompanyId = request.headers.get('x-company-id') || request.headers.get('x-user-company-id')
  const cookieCompanyId = request.cookies.get('user-company-id')?.value
  const parsedCompany = headerCompanyId
    ? parseInt(headerCompanyId, 10)
    : cookieCompanyId
      ? parseInt(cookieCompanyId, 10)
      : null
  const companyId = Number.isFinite(parsedCompany) ? parsedCompany : null

  const isSuperAdmin =
    headerIsSuperAdmin ||
    request.headers.get('x-user-role') === 'SUPER_ADMIN' ||
    request.cookies.get('user-role')?.value === 'SUPER_ADMIN'

  // Logging para debugging (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[QueryHelper] isSuperAdmin: ${isSuperAdmin}, companyId: ${companyId}`)
  }

  return {
    isSuperAdmin,
    companyId,

    /**
     * Agrega filtro de empresa al array de condiciones
     * Solo agrega si NO es SUPER_ADMIN y hay companyId válido
     */
    addCompanyFilter: (conditions: string[], params: any[]) => {
      if (!isSuperAdmin && companyId !== null) {
        params.push(companyId)
        conditions.push(`company_id = $${params.length}`)
      }
    },

    /**
     * Construye WHERE clause completo incluyendo filtro de empresa
     */
    buildWhereClause: (additionalConditions: string[] = []) => {
      const allConditions = [...additionalConditions]

      // Agregar filtro de empresa si aplica
      if (!isSuperAdmin && companyId !== null) {
        allConditions.push('company_id = ${{COMPANY_ID_PARAM}}')
      }

      return allConditions.length > 0
        ? `WHERE ${allConditions.join(' AND ')}`
        : ''
    },

    /**
     * Agrega company_id al array de parámetros
     * Solo agrega si NO es SUPER_ADMIN
     */
    addCompanyParam: (params: any[]) => {
      if (!isSuperAdmin && companyId !== null) {
        params.push(companyId)
        return companyId
      }
      return null
    }
  }
}

/**
 * Helper para construir queries con paginación y filtrado por empresa
 *
 * @example
 * ```typescript
 * const { query, countQuery, params } = buildPaginatedQuery({
 *   request,
 *   tableName: 'package_orders',
 *   selectFields: 'id, order_number, status',
 *   searchFields: ['order_number', 'customer_name'],
 *   searchTerm: 'ABC123',
 *   additionalFilters: { status: 'pending' },
 *   orderBy: 'created_at DESC',
 *   page: 1,
 *   limit: 25
 * })
 *
 * const dataResult = await db.query(query, params)
 * const countResult = await db.query(countQuery, params.slice(0, -2)) // Excluir limit/offset
 * ```
 */
export interface PaginatedQueryOptions {
  request: NextRequest
  tableName: string
  selectFields: string
  searchFields?: string[]
  searchTerm?: string
  additionalFilters?: Record<string, any>
  orderBy?: string
  page?: number
  limit?: number
}

export function buildPaginatedQuery(options: PaginatedQueryOptions) {
  const {
    request,
    tableName,
    selectFields,
    searchFields = [],
    searchTerm = '',
    additionalFilters = {},
    orderBy = 'createdat DESC',
    page = 1,
    limit = 25
  } = options

  const { isSuperAdmin, addCompanyFilter } = getCompanyFilter(request)

  const conditions: string[] = []
  const params: any[] = []

  // Filtro de búsqueda de texto
  if (searchTerm && searchFields.length > 0) {
    const searchConditions = searchFields.map((field, index) => {
      params.push(`%${searchTerm}%`)
      return `${field} ILIKE $${params.length}`
    })
    conditions.push(`(${searchConditions.join(' OR ')})`)
  }

  // Filtros adicionales
  Object.entries(additionalFilters).forEach(([field, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.push(value)
      conditions.push(`${field} = $${params.length}`)
    }
  })

  // Filtro de empresa (automático)
  addCompanyFilter(conditions, params)

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  // Query de conteo (para paginación)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM ${tableName}
    ${whereClause}
  `

  // Paginación
  const offset = (page - 1) * limit
  params.push(limit, offset)

  // Query de datos
  const dataQuery = `
    SELECT ${selectFields}
    FROM ${tableName}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `

  return {
    query: dataQuery,
    countQuery,
    params,
    isSuperAdmin
  }
}

/**
 * Valida que el usuario tenga acceso a un registro específico
 * (Verifica que el registro pertenezca a su empresa)
 *
 * @returns true si tiene acceso, false si no
 *
 * @example
 * ```typescript
 * const hasAccess = await validateRecordAccess({
 *   request,
 *   tableName: 'package_orders',
 *   recordId: 123,
 *   idField: 'id'
 * })
 *
 * if (!hasAccess) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
 * }
 * ```
 */
export interface ValidateAccessOptions {
  request: NextRequest
  tableName: string
  recordId: number | string
  idField?: string
  db: any // Database instance
}

export async function validateRecordAccess(
  options: ValidateAccessOptions
): Promise<boolean> {
  const {
    request,
    tableName,
    recordId,
    idField = 'id',
    db
  } = options

  const { isSuperAdmin, companyId } = getCompanyFilter(request)

  // SUPER_ADMIN siempre tiene acceso
  if (isSuperAdmin) {
    return true
  }

  // Sin company_id, denegar acceso
  if (!companyId) {
    return false
  }

  try {
    // Verificar que el registro pertenezca a la empresa del usuario
    const query = `
      SELECT 1 FROM ${tableName}
      WHERE ${idField} = $1 AND company_id = $2
      LIMIT 1
    `

    const result = await db.query(query, [recordId, companyId])

    return result.rows.length > 0
  } catch (error) {
    console.error('[validateRecordAccess] Error:', error)
    return false
  }
}
