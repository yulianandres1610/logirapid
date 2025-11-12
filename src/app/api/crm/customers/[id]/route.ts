import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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

    const query = `
      SELECT
        id,
        firstname as "firstName",
        lastname as "lastName",
        idnumber as "idNumber",
        idtype as "idType",
        phone,
        email,
        address,
        city,
        state,
        country,
        notes,
        createdby as "createdBy",
        createdat as "createdAt",
        zipcode as "zipCode",
        apartment
      FROM customers
      WHERE id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
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
    const { firstName, lastName, phone, email, address, city, state, country, zipCode, apartment, notes, idNumber, idType } = body

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

    // Build dynamic UPDATE query
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      firstName: 'firstname',
      lastName: 'lastname',
      idNumber: 'idnumber',
      idType: 'idtype',
      phone: 'phone',
      email: 'email',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      notes: 'notes',
      zipCode: 'zipcode',
      apartment: 'apartment'
    }

    // Build update fields dynamically
    for (const [key, value] of Object.entries(body)) {
      if (fieldMapping[key] && value !== undefined) {
        updateFields.push(`${fieldMapping[key]} = $${valueIndex}`)
        values.push(value)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    values.push(id)

    const updateQuery = `
      UPDATE customers
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        firstname as "firstName",
        lastname as "lastName",
        idnumber as "idNumber",
        idtype as "idType",
        phone,
        email,
        address,
        city,
        state,
        country,
        notes,
        createdby as "createdBy",
        createdat as "createdAt",
        zipcode as "zipCode",
        apartment
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('Customer updated successfully:', result.rows[0])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
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

    // Verify if customer has associated orders
    const ordersQuery = 'SELECT COUNT(*) as count FROM package_orders WHERE customerid = $1'
    const ordersResult = await db.query(ordersQuery, [id])

    if (parseInt(ordersResult.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer with associated orders' },
        { status: 400 }
      )
    }

    // Delete associated addresses first
    await db.query('DELETE FROM customer_addresses WHERE customer_id = $1', [id])

    // Delete change history
    await db.query('DELETE FROM customer_change_history WHERE customerid = $1', [id])

    // Delete the customer
    const deleteQuery = 'DELETE FROM customers WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [id])

    if (result.rows.length === 0) {
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