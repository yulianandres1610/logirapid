import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// DELETE - Eliminar configuración de etiqueta
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const labelSettingId = parseInt(id)

    if (isNaN(labelSettingId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      )
    }

    // Verificar si la configuración existe
    const checkResult = await db.query(
      'SELECT id FROM label_settings WHERE id = $1',
      [labelSettingId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Configuración no encontrada' },
        { status: 404 }
      )
    }

    // Eliminar la configuración
    await db.query('DELETE FROM label_settings WHERE id = $1', [labelSettingId])

    return NextResponse.json({
      success: true,
      message: 'Configuración eliminada exitosamente'
    })
  } catch (error) {
    console.error('Error deleting label setting:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar la configuración' },
      { status: 500 }
    )
  }
}
