import { NextRequest, NextResponse } from 'next/server'
import {
  getPackageOrderById,
  updatePackageOrder,
  deletePackageOrder
} from '@/lib/database'

// GET: Obtener una orden específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const order = getPackageOrderById(id)
    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: order
    })

  } catch (error) {
    console.error('Error getting package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener orden de paquetería'
    }, { status: 500 })
  }
}

// PUT: Actualizar una orden específica por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()

    // Handle additionalServices if it's an array
    if (body.additionalServices && Array.isArray(body.additionalServices)) {
      body.additionalServices = JSON.stringify(body.additionalServices)
    }

    const updatedOrder = updatePackageOrder(id, body)

    if (!updatedOrder) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la orden o no hay cambios'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error updating package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar orden de paquetería'
    }, { status: 500 })
  }
}

// DELETE: Eliminar una orden específica por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const deletedOrder = deletePackageOrder(id)

    if (!deletedOrder) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la orden'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error deleting package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar orden de paquetería'
    }, { status: 500 })
  }
}