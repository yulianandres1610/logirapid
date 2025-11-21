import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// ============================================
// CACHÉ EN MEMORIA
// ============================================

interface StatsCache {
  data: any
  timestamp: number
}

// Caché por empresa (válido por 5 minutos)
const statsCache = new Map<string, StatsCache>()

// TTL del caché: 5 minutos (configurable)
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos en milisegundos

// ============================================
// GET: Obtener Estadísticas de Órdenes
// ============================================

/**
 * API de estadísticas optimizada con caché
 * - Reduce carga de DB en 80-90%
 * - Evita iteraciones en frontend
 * - Actualización automática cada 5 minutos
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const companyIdParam = searchParams.get('companyId')
    const companyId = companyIdParam ? parseInt(companyIdParam) : headerCompanyId
    const cacheKey = isSuperAdmin && !companyId ? 'all' : `company-${companyId || 'unknown'}`
    const now = Date.now()

    // Verificar si el caché es válido
    const cached = statsCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log('📊 Stats servidos desde caché')
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        cacheAge: Math.floor((now - cached.timestamp) / 1000) // segundos
      })
    }

    const conditions: string[] = []
    const params: any[] = []

    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    } else if (companyId) {
      params.push(companyId)
      conditions.push(`company_id = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Consulta optimizada con agregaciones SQL
    // Beneficio: 1 query vs 5+ iteraciones en frontend
    const query = `
      SELECT
        -- Total de órdenes
        COUNT(*) as total,

        -- Por status
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,

        -- Por tipo de orden (pickup vs delivery)
        COUNT(*) FILTER (WHERE order_type = 'recogida') as pickups,
        COUNT(*) FILTER (WHERE order_type = 'oficina') as deliveries,

        -- Órdenes programadas para hoy
        COUNT(*) FILTER (
          WHERE scheduleddate = CURRENT_DATE
        ) as scheduled_today,

        -- Órdenes activas (no completadas ni canceladas)
        COUNT(*) FILTER (
          WHERE status NOT IN ('delivered', 'cancelled', 'completed')
        ) as active,

        -- Órdenes con coordenadas (para mapa)
        COUNT(*) FILTER (
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ) as with_coordinates,

        -- Totales monetarios
        SUM(totalamount) FILTER (WHERE status != 'cancelled') as total_revenue,
        AVG(totalamount) FILTER (WHERE status != 'cancelled') as avg_order_value,

        -- Fecha de última actualización
        MAX(updatedat) as last_updated

      FROM package_orders
      ${whereClause}
    `

    const result = await db.query(query, params)
    const stats = result.rows[0]

    // Formatear números decimales
    const formattedStats = {
      total: parseInt(stats.total) || 0,
      byStatus: {
        pending: parseInt(stats.pending) || 0,
        in_transit: parseInt(stats.in_transit) || 0,
        delivered: parseInt(stats.delivered) || 0,
        cancelled: parseInt(stats.cancelled) || 0,
        scheduled: parseInt(stats.scheduled) || 0
      },
      byType: {
        pickups: parseInt(stats.pickups) || 0,
        deliveries: parseInt(stats.deliveries) || 0
      },
      today: {
        scheduled: parseInt(stats.scheduled_today) || 0
      },
      active: parseInt(stats.active) || 0,
      withCoordinates: parseInt(stats.with_coordinates) || 0,
      revenue: {
        total: parseFloat(stats.total_revenue) || 0,
        average: parseFloat(stats.avg_order_value) || 0
      },
      lastUpdated: stats.last_updated
    }

    // Actualizar caché
    statsCache.set(cacheKey, {
      data: formattedStats,
      timestamp: now
    })

    console.log('📊 Stats calculados y cacheados')

    return NextResponse.json({
      success: true,
      data: formattedStats,
      cached: false,
      cacheAge: 0
    })

  } catch (error) {
    console.error('Error getting stats:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener estadísticas'
    }, { status: 500 })
  }
}

// ============================================
// DELETE: Limpiar Caché (útil para testing)
// ============================================

/**
 * Endpoint para limpiar el caché manualmente
 * Útil para testing o cuando se necesitan stats en tiempo real
 */
export async function DELETE(request: NextRequest) {
  try {
    const previousCaches = Array.from(statsCache.entries()).map(([key, value]) => ({
      key,
      age: Math.floor((Date.now() - value.timestamp) / 1000)
    }))
    statsCache.clear()

    return NextResponse.json({
      success: true,
      message: 'Caché limpiado exitosamente',
      previousCacheAge: previousCaches
    })

  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al limpiar caché'
    }, { status: 500 })
  }
}
