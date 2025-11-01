import { NextRequest, NextResponse } from 'next/server'
import { db, getCustomerByIdGlobal, updateCustomer, deleteCustomer } from '@/lib/database'

// Get a single customer by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const customer = await getCustomerByIdGlobal(id)

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: customer
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update a customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, phone, email, address, notes } = body

    console.log('Updating customer:', { id, firstName, lastName, phone, email, address, notes })

    // Validate required fields - only if they are provided
    if (firstName && typeof firstName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid first name' },
        { status: 400 }
      )
    }

    if (lastName && typeof lastName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid last name' },
        { status: 400 }
      )
    }

    if (phone && typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Invalid phone' },
        { status: 400 }
      )
    }

    // Update customer with partial data
    const updateData: any = {}
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (address !== undefined) updateData.address = address
    if (notes !== undefined) updateData.notes = notes

    const updatedCustomer = await updateCustomer(id, updateData)

    if (!updatedCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('Customer updated successfully:', updatedCustomer)

    return NextResponse.json({
      success: true,
      data: updatedCustomer
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Delete a customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const deleted = await deleteCustomer(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}