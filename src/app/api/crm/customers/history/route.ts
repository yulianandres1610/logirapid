import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener historial de cambios de un cliente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID del cliente'
      }, { status: 400 })
    }

    const query = `
      SELECT
        id,
        customerid as "customerId",
        changedate as "changeDate",
        changedby as "changedBy",
        oldfirstname as "oldFirstName",
        newfirstname as "newFirstName",
        oldlastname as "oldLastName",
        newlastname as "newLastName",
        oldidnumber as "oldIdNumber",
        newidnumber as "newIdNumber",
        oldidtype as "oldIdType",
        newidtype as "newIdType",
        oldphone as "oldPhone",
        newphone as "newPhone",
        oldemail as "oldEmail",
        newemail as "newEmail",
        oldaddress as "oldAddress",
        newaddress as "newAddress",
        oldcity as "oldCity",
        newcity as "newCity",
        oldstate as "oldState",
        newstate as "newState",
        oldcountry as "oldCountry",
        newcountry as "newCountry",
        oldnotes as "oldNotes",
        newnotes as "newNotes",
        oldzipcode as "oldZipCode",
        newzipcode as "newZipCode",
        oldapartment as "oldApartment",
        newapartment as "newApartment"
      FROM customer_change_history
      WHERE customerid = $1
      ORDER BY changedate DESC
    `

    const result = await db.query(query, [parseInt(customerId)])

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting customer change history:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener historial de cambios'
    }, { status: 500 })
  }
}

// POST: Registrar un cambio en el historial
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos obligatorios
    if (!body || !body.customerId || !body.changedBy) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, changedBy)'
      }, { status: 400 })
    }

    // Esta función ahora registra todos los cambios del cliente de forma completa
    const insertQuery = `
      INSERT INTO customer_change_history (
        customerid, changedate, changedby,
        oldfirstname, newfirstname,
        oldlastname, newlastname,
        oldidnumber, newidnumber,
        oldidtype, newidtype,
        oldphone, newphone,
        oldemail, newemail,
        oldaddress, newaddress,
        oldcity, newcity,
        oldstate, newstate,
        oldcountry, newcountry,
        oldnotes, newnotes,
        oldzipcode, newzipcode,
        oldapartment, newapartment
      ) VALUES (
        $1, NOW(), $2,
        $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      )
      RETURNING
        id,
        customerid as "customerId",
        changedate as "changeDate",
        changedby as "changedBy"
    `

    const values = [
      parseInt(body.customerId),
      body.changedBy,
      body.oldFirstName || null,
      body.newFirstName || null,
      body.oldLastName || null,
      body.newLastName || null,
      body.oldIdNumber || null,
      body.newIdNumber || null,
      body.oldIdType || null,
      body.newIdType || null,
      body.oldPhone || null,
      body.newPhone || null,
      body.oldEmail || null,
      body.newEmail || null,
      body.oldAddress || null,
      body.newAddress || null,
      body.oldCity || null,
      body.newCity || null,
      body.oldState || null,
      body.newState || null,
      body.oldCountry || null,
      body.newCountry || null,
      body.oldNotes || null,
      body.newNotes || null,
      body.oldZipCode || null,
      body.newZipCode || null,
      body.oldApartment || null,
      body.newApartment || null
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Cambio registrado exitosamente'
    })

  } catch (error) {
    console.error('Error adding customer change history:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al registrar cambio'
    }, { status: 500 })
  }
}