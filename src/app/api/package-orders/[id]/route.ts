import { NextRequest, NextResponse } from 'next/server'
import {
  getPackageOrderById,
  updatePackageOrder,
  deletePackageOrder
} from '@/lib/database'

// Get a single package order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const order = getPackageOrderById(id)

    if (!order) {
      return NextResponse.json(
        { error: 'Package order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: order
    })
  } catch (error) {
    console.error('Error fetching package order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update a package order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, scheduledDate, timeSlot, notes, services } = body

    // Validate required fields
    if (status && !['pending', 'scheduled', 'picked_up', 'delivered', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const updatedOrder = updatePackageOrder(id, {
      status,
      scheduledDate,
      timeSlot,
      notes,
      services
    })

    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'Package order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder
    })
  } catch (error) {
    console.error('Error updating package order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete a package order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    // Check if order exists and get its details
    const order = getPackageOrderById(id)
    if (!order) {
      return NextResponse.json(
        { error: 'Package order not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of pending orders
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar órdenes en estado pendiente' },
        { status: 400 }
      )
    }

    // Attempt to delete the order
    const deleted = deletePackageOrder(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'No se pudo eliminar la orden' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Orden eliminada exitosamente'
    })
  } catch (error) {
    console.error('Error deleting package order:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}