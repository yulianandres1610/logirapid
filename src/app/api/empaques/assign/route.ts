import { NextRequest, NextResponse } from 'next/server'
import { asignarEmpaqueAOrden, type LabelDataForAssignment } from '@/lib/empaques-helper'
import { getCompanyFilter } from '@/lib/query-helpers'
import { db } from '@/lib/database'

/**
 * POST /api/empaques/assign
 * Asigna un empaque pre-etiquetado a una orden
 * Actualiza estado a 'recogida' y guarda datos completos del label
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isSuperAdmin, companyId } = getCompanyFilter(request)
    const {
      empaqueId,
      ordenId,
      ordenNumero,
      servicioNombre,
      warehouseId,
      warehouseName,
      labelData,
      clienteId
    } = body

    // Validar parámetros requeridos (warehouseId y warehouseName son opcionales)
    if (!empaqueId || !ordenId || !ordenNumero || !servicioNombre) {
      return NextResponse.json({
        success: false,
        error: 'Faltan parámetros requeridos: empaqueId, ordenId, ordenNumero, servicioNombre'
      }, { status: 400 })
    }

    // labelData es requerido y debe tener datos completos
    if (!labelData || !labelData.boxCode || !labelData.recipient || !labelData.recipientCity || !labelData.recipientState) {
      return NextResponse.json({
        success: false,
        error: 'labelData es requerido y debe incluir: boxCode, recipient, recipientCity, recipientState'
      }, { status: 400 })
    }

    // Validar pertenencia de empresa
    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }

      const empaqueCompany = await db.query('SELECT company_id FROM empaques WHERE id = $1', [empaqueId])
      const orderCompany = await db.query('SELECT company_id FROM package_orders WHERE id = $1', [ordenId])

      if (empaqueCompany.rows.length === 0 || orderCompany.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empaque u orden no encontrada'
        }, { status: 404 })
      }

      if (parseInt(empaqueCompany.rows[0].company_id) !== companyId || parseInt(orderCompany.rows[0].company_id) !== companyId) {
        return NextResponse.json({
          success: false,
          error: 'No tienes permisos para asignar empaques de otra empresa'
        }, { status: 403 })
      }
    }

    // Asignar empaque usando el helper actualizado
    const result = await asignarEmpaqueAOrden(
      empaqueId,
      ordenId,
      ordenNumero,
      servicioNombre,
      warehouseId || null,
      warehouseName || null,
      labelData as LabelDataForAssignment,
      clienteId
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: warehouseName
          ? `Empaque ${labelData.boxCode} recogido exitosamente en ${warehouseName}`
          : `Empaque ${labelData.boxCode} asignado exitosamente a la orden`
      }, { status: 200 })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error al asignar empaque'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in assign empaque API:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno al asignar empaque'
    }, { status: 500 })
  }
}
