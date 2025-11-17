import { db } from '@/lib/database'

/**
 * Interfaz para validación de empaque
 */
export interface EmpaqueValidation {
  valid: boolean
  error?: string
  empaque?: {
    id: number
    codigo: string
    tipo: string
    estado: string
    packageSizeId?: number
    warehouseId?: number
    warehouseName?: string
    supplierName?: string
    descripcion?: string
  }
}

/**
 * Interfaz para datos de trazabilidad
 */
export interface TrazabilidadData {
  empaqueId: number
  accion: string
  ordenNumero?: string
  servicioNombre?: string
  ubicacion?: string
  warehouseId?: number
  warehouseName?: string
  usuarioId?: number
  usuarioNombre?: string
  notas?: string
}

/**
 * Valida si un código de empaque existe y está disponible
 */
export async function validateEmpaqueCodigo(codigo: string): Promise<EmpaqueValidation> {
  try {
    if (!codigo || codigo.trim() === '') {
      return {
        valid: false,
        error: 'Debe proporcionar un código de empaque'
      }
    }

    const result = await db.query(
      `SELECT
        id,
        codigo,
        tipo,
        estado,
        package_size_id,
        warehouse_id,
        warehouse_name,
        supplier_name,
        descripcion
      FROM empaques
      WHERE codigo = $1`,
      [codigo.trim()]
    )

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'Código no encontrado'
      }
    }

    const empaque = result.rows[0]

    if (empaque.estado !== 'disponible') {
      return {
        valid: false,
        error: `Empaque no disponible. Estado: ${empaque.estado}`,
        empaque: {
          id: empaque.id,
          codigo: empaque.codigo,
          tipo: empaque.tipo,
          estado: empaque.estado,
          warehouseName: empaque.warehouse_name
        }
      }
    }

    return {
      valid: true,
      empaque: {
        id: empaque.id,
        codigo: empaque.codigo,
        tipo: empaque.tipo,
        estado: empaque.estado,
        packageSizeId: empaque.package_size_id,
        warehouseId: empaque.warehouse_id,
        warehouseName: empaque.warehouse_name,
        supplierName: empaque.supplier_name,
        descripcion: empaque.descripcion
      }
    }
  } catch (error) {
    console.error('Error validating empaque:', error)
    return {
      valid: false,
      error: 'Error al validar el código'
    }
  }
}

/**
 * Interfaz para datos completos de label al asignar empaque
 */
export interface LabelDataForAssignment {
  boxCode: string
  boxNumber: number
  totalBoxes: number
  serviceName: string
  recipient: string
  recipientCity: string
  recipientState: string
  weight: string
  weightKg: string
  [key: string]: any
}

/**
 * Asigna un empaque pre-etiquetado a una orden (cambia estado a 'recogida')
 * Actualiza datos del destinatario
 * warehouseId y warehouseName son opcionales - se asignan manualmente al escanear
 */
export async function asignarEmpaqueAOrden(
  empaqueId: number,
  ordenId: number,
  ordenNumero: string,
  servicioNombre: string,
  warehouseId: number | null,
  warehouseName: string | null,
  labelData: LabelDataForAssignment,
  clienteId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('BEGIN')

    // Actualizar empaque con estado 'recogida' y datos completos (SIN warehouse)
    const updateResult = await db.query(
      `UPDATE empaques
       SET estado = 'recogida',
           orden_id = $1,
           cliente_id = $2,
           order_number = $3,
           service_name = $4,
           recipient_name = $5,
           recipient_city = $6,
           recipient_state = $7,
           weight_lb = $8,
           weight_kg = $9,
           box_number = $10,
           total_boxes = $11,
           fecha_asignacion = NOW(),
           updated_at = NOW()
       WHERE id = $12 AND estado = 'disponible'`,
      [
        ordenId,
        clienteId || null,
        ordenNumero,
        servicioNombre,
        labelData.recipient,
        labelData.recipientCity,
        labelData.recipientState,
        parseFloat(labelData.weight) || 0,
        parseFloat(labelData.weightKg) || 0,
        labelData.boxNumber,
        labelData.totalBoxes,
        empaqueId
      ]
    )

    // Verificar que el empaque fue actualizado
    if (updateResult.rowCount === 0) {
      await db.query('ROLLBACK')
      return {
        success: false,
        error: 'No se pudo actualizar el empaque. Verifica que el empaque exista y esté en estado "disponible".'
      }
    }

    // Registrar en trazabilidad
    await db.query(
      `INSERT INTO empaques_trazabilidad (
        empaque_id,
        accion,
        orden_numero,
        servicio_nombre,
        notas
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        empaqueId,
        'asignado_a_orden',
        ordenNumero,
        servicioNombre,
        `Asignado a orden ${ordenNumero} para ${labelData.recipient} (${labelData.recipientCity}, ${labelData.recipientState})`
      ]
    )

    await db.query('COMMIT')

    return { success: true }
  } catch (error) {
    await db.query('ROLLBACK')
    console.error('Error assigning empaque:', error)
    return {
      success: false,
      error: 'Error al asignar el empaque'
    }
  }
}

/**
 * Registra un evento en la trazabilidad de un empaque
 */
export async function registrarTrazabilidad(data: TrazabilidadData): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query(
      `INSERT INTO empaques_trazabilidad (
        empaque_id,
        accion,
        orden_numero,
        servicio_nombre,
        ubicacion,
        warehouse_id,
        warehouse_name,
        usuario_id,
        usuario_nombre,
        notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.empaqueId,
        data.accion,
        data.ordenNumero || null,
        data.servicioNombre || null,
        data.ubicacion || null,
        data.warehouseId || null,
        data.warehouseName || null,
        data.usuarioId || null,
        data.usuarioNombre || null,
        data.notas || null
      ]
    )

    return { success: true }
  } catch (error) {
    console.error('Error registering trazabilidad:', error)
    return {
      success: false,
      error: 'Error al registrar trazabilidad'
    }
  }
}

/**
 * Libera un empaque (vuelve a estado 'disponible')
 */
export async function liberarEmpaque(
  empaqueId: number,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('BEGIN')

    // Actualizar estado del empaque
    await db.query(
      `UPDATE empaques
       SET estado = 'disponible',
           orden_id = NULL,
           cliente_id = NULL,
           fecha_asignacion = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [empaqueId]
    )

    // Registrar en trazabilidad
    await db.query(
      `INSERT INTO empaques_trazabilidad (
        empaque_id,
        accion,
        ubicacion,
        notas
      ) VALUES ($1, $2, $3, $4)`,
      [
        empaqueId,
        'liberado',
        'Sistema',
        motivo
      ]
    )

    await db.query('COMMIT')

    return { success: true }
  } catch (error) {
    await db.query('ROLLBACK')
    console.error('Error liberating empaque:', error)
    return {
      success: false,
      error: 'Error al liberar el empaque'
    }
  }
}

/**
 * Obtiene la trazabilidad completa de un empaque
 */
export async function obtenerTrazabilidadEmpaque(empaqueId: number) {
  try {
    const result = await db.query(
      `SELECT
        t.id,
        t.empaque_id,
        e.codigo as empaque_codigo,
        t.accion,
        t.orden_numero,
        t.servicio_nombre,
        t.ubicacion,
        t.warehouse_name,
        t.usuario_nombre,
        t.notas,
        t.fecha
      FROM empaques_trazabilidad t
      INNER JOIN empaques e ON t.empaque_id = e.id
      WHERE t.empaque_id = $1
      ORDER BY t.fecha DESC`,
      [empaqueId]
    )

    return {
      success: true,
      data: result.rows
    }
  } catch (error) {
    console.error('Error fetching trazabilidad:', error)
    return {
      success: false,
      error: 'Error al obtener trazabilidad',
      data: []
    }
  }
}

/**
 * Interfaz para datos de label del wizard
 */
export interface LabelData {
  boxCode: string
  boxNumber: number
  totalBoxes: number
  serviceName: string
  sender: string
  senderPhone: string
  senderAddress: string
  recipient: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  recipientState: string
  weight: string
  weightKg: string
  [key: string]: any
}

/**
 * Valida que un código de empaque exista y NO esté en estado 'disponible'
 * (solo códigos asignados o en tracking pueden ser escaneados)
 */
export async function validateEmpaqueParaEscaneo(codigo: string): Promise<EmpaqueValidation> {
  try {
    if (!codigo || codigo.trim() === '') {
      return {
        valid: false,
        error: 'Debe proporcionar un código de empaque'
      }
    }

    const result = await db.query(
      `SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.warehouse_id,
        e.warehouse_name,
        e.order_number,
        e.service_name,
        e.recipient_name,
        e.recipient_city,
        e.recipient_state,
        e.weight_lb,
        e.weight_kg,
        e.box_number,
        e.total_boxes
      FROM empaques e
      WHERE e.codigo = $1`,
      [codigo.trim()]
    )

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'Código no encontrado'
      }
    }

    const empaque = result.rows[0]

    // VALIDACIÓN IMPORTANTE: Solo códigos asignados o en tracking
    if (empaque.estado === 'disponible') {
      return {
        valid: false,
        error: 'Este código no está asignado a ninguna orden',
        empaque: {
          id: empaque.id,
          codigo: empaque.codigo,
          tipo: empaque.tipo,
          estado: empaque.estado
        }
      }
    }

    return {
      valid: true,
      empaque: {
        id: empaque.id,
        codigo: empaque.codigo,
        tipo: empaque.tipo,
        estado: empaque.estado,
        warehouseId: empaque.warehouse_id,
        warehouseName: empaque.warehouse_name
      }
    }
  } catch (error) {
    console.error('Error validating empaque for scanning:', error)
    return {
      valid: false,
      error: 'Error al validar el código'
    }
  }
}

/**
 * Cambia el estado de un empaque y registra trazabilidad
 */
export async function cambiarEstadoEmpaque(
  codigo: string,
  nuevoEstado: 'recogida' | 'en_almacen' | 'enviado' | 'recibido_destino' | 'en_reparto' | 'entregado',
  warehouseId: number,
  warehouseName: string,
  usuarioId?: number,
  usuarioNombre?: string,
  notas?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('BEGIN')

    // Obtener ID del empaque
    const empaqueResult = await db.query(
      'SELECT id, order_number, service_name FROM empaques WHERE codigo = $1',
      [codigo]
    )

    if (empaqueResult.rows.length === 0) {
      await db.query('ROLLBACK')
      return { success: false, error: 'Código no encontrado' }
    }

    const empaque = empaqueResult.rows[0]

    // Actualizar estado y warehouse
    await db.query(
      `UPDATE empaques
       SET estado = $1,
           warehouse_id = $2,
           warehouse_name = $3,
           updated_by_user_id = $4,
           updated_by_user_name = $5,
           updated_at = NOW()
       WHERE codigo = $6`,
      [nuevoEstado, warehouseId, warehouseName, usuarioId || null, usuarioNombre || null, codigo]
    )

    // Registrar trazabilidad
    await registrarTrazabilidad({
      empaqueId: empaque.id,
      accion: `cambio_estado_${nuevoEstado}`,
      ordenNumero: empaque.order_number,
      servicioNombre: empaque.service_name,
      ubicacion: warehouseName,
      warehouseId,
      warehouseName,
      usuarioId,
      usuarioNombre,
      notas: notas || `Estado cambiado a: ${nuevoEstado}`
    })

    await db.query('COMMIT')

    return { success: true }
  } catch (error) {
    await db.query('ROLLBACK')
    console.error('Error changing empaque state:', error)
    return {
      success: false,
      error: 'Error al cambiar el estado del empaque'
    }
  }
}

/**
 * Transfiere un empaque de un almacén a otro (usado en envíos)
 */
export async function transferirEmpaque(
  codigo: string,
  warehouseOrigenId: number,
  warehouseDestinoId: number,
  warehouseDestinoName: string,
  usuarioId?: number,
  usuarioNombre?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('BEGIN')

    // Obtener empaque
    const empaqueResult = await db.query(
      'SELECT id, order_number, service_name, warehouse_name FROM empaques WHERE codigo = $1',
      [codigo]
    )

    if (empaqueResult.rows.length === 0) {
      await db.query('ROLLBACK')
      return { success: false, error: 'Código no encontrado' }
    }

    const empaque = empaqueResult.rows[0]

    // Actualizar warehouse y estado a 'enviado'
    await db.query(
      `UPDATE empaques
       SET estado = 'enviado',
           warehouse_id = $1,
           warehouse_name = $2,
           updated_by_user_id = $3,
           updated_by_user_name = $4,
           updated_at = NOW()
       WHERE codigo = $5`,
      [warehouseDestinoId, warehouseDestinoName, usuarioId || null, usuarioNombre || null, codigo]
    )

    // Registrar trazabilidad de transferencia
    await registrarTrazabilidad({
      empaqueId: empaque.id,
      accion: 'transferencia',
      ordenNumero: empaque.order_number,
      servicioNombre: empaque.service_name,
      ubicacion: `${empaque.warehouse_name} → ${warehouseDestinoName}`,
      warehouseId: warehouseDestinoId,
      warehouseName: warehouseDestinoName,
      usuarioId,
      usuarioNombre,
      notas: `Enviado desde ${empaque.warehouse_name} hacia ${warehouseDestinoName}`
    })

    await db.query('COMMIT')

    return { success: true }
  } catch (error) {
    await db.query('ROLLBACK')
    console.error('Error transferring empaque:', error)
    return {
      success: false,
      error: 'Error al transferir el empaque'
    }
  }
}
