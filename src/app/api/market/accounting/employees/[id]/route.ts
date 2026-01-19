import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/accounting/employees/[id]
 * Get single employee details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const employeeId = parseInt(id)

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    const result = await db.query(`
      SELECT
        e.id,
        e.user_id,
        e.employee_code,
        e.hire_date,
        e.termination_date,
        e.status,
        e.pay_type,
        e.pay_rate,
        e.currency,
        e.pos_badge_code,
        e.commission_rate,
        e.warehouse_id,
        e.created_at,
        e.updated_at,
        u.email,
        u.firstname,
        u.lastname,
        u.phone,
        u.role,
        w.name as warehouse_name,
        CASE WHEN e.pos_pin IS NOT NULL THEN true ELSE false END as has_pin
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN market_warehouses w ON e.warehouse_id = w.id
      WHERE e.id = $1 AND e.company_id = $2
    `, [employeeId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const employee = result.rows[0]

    // Get terminals
    const terminalsResult = await db.query(`
      SELECT
        et.terminal_id,
        t.name as terminal_name,
        t.code as terminal_code,
        et.can_open_session,
        et.can_close_session,
        et.can_void_orders,
        et.can_give_discount,
        et.can_refund,
        et.max_discount_percent
      FROM market_employee_terminals et
      JOIN market_pos_terminals t ON et.terminal_id = t.id
      WHERE et.employee_id = $1
    `, [employeeId])

    // Get sales statistics
    const salesStats = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_amount) FILTER (
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0) as sales_this_month,
        COUNT(*) FILTER (
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ) as orders_this_month
      FROM market_pos_orders
      WHERE employee_id = $1 AND status IN ('paid', 'completed')
    `, [employeeId])

    // Get payroll summary
    const payrollStats = await db.query(`
      SELECT
        COUNT(*) as total_payrolls,
        COALESCE(SUM(net_pay), 0) as total_paid,
        COALESCE(SUM(commission_amount), 0) as total_commissions
      FROM market_payroll
      WHERE employee_id = $1 AND status = 'paid'
    `, [employeeId])

    return NextResponse.json({
      success: true,
      data: {
        id: employee.id,
        userId: employee.user_id,
        employeeCode: employee.employee_code,
        email: employee.email,
        firstName: employee.firstname,
        lastName: employee.lastname,
        fullName: `${employee.firstname || ''} ${employee.lastname || ''}`.trim() || employee.email,
        phone: employee.phone,
        role: employee.role,
        hireDate: employee.hire_date,
        terminationDate: employee.termination_date,
        status: employee.status,
        payType: employee.pay_type,
        payRate: parseFloat(employee.pay_rate) || 0,
        currency: employee.currency,
        hasPIN: employee.has_pin,
        badgeCode: employee.pos_badge_code,
        commissionRate: parseFloat(employee.commission_rate) || 0,
        warehouseId: employee.warehouse_id,
        warehouseName: employee.warehouse_name,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
        terminals: terminalsResult.rows.map(t => ({
          terminalId: t.terminal_id,
          terminalName: t.terminal_name,
          terminalCode: t.terminal_code,
          canOpenSession: t.can_open_session,
          canCloseSession: t.can_close_session,
          canVoidOrders: t.can_void_orders,
          canGiveDiscount: t.can_give_discount,
          canRefund: t.can_refund,
          maxDiscountPercent: parseFloat(t.max_discount_percent) || 0
        })),
        stats: {
          totalOrders: parseInt(salesStats.rows[0]?.total_orders) || 0,
          totalSales: parseFloat(salesStats.rows[0]?.total_sales) || 0,
          salesThisMonth: parseFloat(salesStats.rows[0]?.sales_this_month) || 0,
          ordersThisMonth: parseInt(salesStats.rows[0]?.orders_this_month) || 0,
          totalPayrolls: parseInt(payrollStats.rows[0]?.total_payrolls) || 0,
          totalPaid: parseFloat(payrollStats.rows[0]?.total_paid) || 0,
          totalCommissions: parseFloat(payrollStats.rows[0]?.total_commissions) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Employee API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener empleado'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/accounting/employees/[id]
 * Update employee
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const employeeId = parseInt(id)

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    // Check employee exists
    const existing = await db.query(
      'SELECT id, user_id FROM market_employees WHERE id = $1 AND company_id = $2',
      [employeeId, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const userId = existing.rows[0].user_id

    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      role,
      password, // New password (optional, if changing)
      status,
      terminationDate,
      payType,
      payRate,
      currency,
      commissionRate,
      posPin, // New PIN (if changing)
      badgeCode,
      warehouseId, // Warehouse assignment for MARKET_ALMACENERO and MARKET_MANAGER_TIENDA
      terminals // Updated terminal associations
    } = body

    await db.query('BEGIN')

    try {
      // Update user info
      if (firstName !== undefined || lastName !== undefined || phone !== undefined || role !== undefined || password) {
        const validRoles = ['MARKET_MANAGER', 'MARKET_MANAGER_TIENDA', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO', 'MARKET_VENDEDOR']
        if (role && !validRoles.includes(role)) {
          await db.query('ROLLBACK')
          return NextResponse.json({
            success: false,
            error: 'Rol inválido'
          }, { status: 400 })
        }

        // Validate password if provided
        if (password && password.length < 6) {
          await db.query('ROLLBACK')
          return NextResponse.json({
            success: false,
            error: 'La contraseña debe tener al menos 6 caracteres'
          }, { status: 400 })
        }

        // Hash password if provided
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null

        if (hashedPassword) {
          await db.query(`
            UPDATE users SET
              firstname = COALESCE($1, firstname),
              lastname = COALESCE($2, lastname),
              phone = COALESCE($3, phone),
              role = COALESCE($4, role),
              password = $6
            WHERE id = $5
          `, [firstName, lastName, phone, role, userId, hashedPassword])
        } else {
          await db.query(`
            UPDATE users SET
              firstname = COALESCE($1, firstname),
              lastname = COALESCE($2, lastname),
              phone = COALESCE($3, phone),
              role = COALESCE($4, role)
            WHERE id = $5
          `, [firstName, lastName, phone, role, userId])
        }
      }

      // Prepare employee update
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`)
        values.push(status)
      }
      if (terminationDate !== undefined) {
        updates.push(`termination_date = $${paramIndex++}`)
        values.push(terminationDate)
      }
      if (payType !== undefined) {
        updates.push(`pay_type = $${paramIndex++}`)
        values.push(payType)
      }
      if (payRate !== undefined) {
        updates.push(`pay_rate = $${paramIndex++}`)
        values.push(payRate)
      }
      if (currency !== undefined) {
        updates.push(`currency = $${paramIndex++}`)
        values.push(currency)
      }
      if (commissionRate !== undefined) {
        updates.push(`commission_rate = $${paramIndex++}`)
        values.push(commissionRate)
      }
      if (badgeCode !== undefined) {
        updates.push(`pos_badge_code = $${paramIndex++}`)
        values.push(badgeCode || null)
      }
      if (warehouseId !== undefined) {
        updates.push(`warehouse_id = $${paramIndex++}`)
        values.push(warehouseId || null)
      }
      if (posPin !== undefined) {
        if (posPin === null || posPin === '') {
          updates.push(`pos_pin = NULL`)
        } else {
          if (posPin.length < 4 || posPin.length > 6) {
            await db.query('ROLLBACK')
            return NextResponse.json({
              success: false,
              error: 'El PIN debe tener entre 4 y 6 dígitos'
            }, { status: 400 })
          }
          const hashedPin = await bcrypt.hash(posPin, 10)
          updates.push(`pos_pin = $${paramIndex++}`)
          values.push(hashedPin)
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        values.push(employeeId)
        await db.query(
          `UPDATE market_employees SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          values
        )
      }

      // Update terminal associations
      if (terminals !== undefined) {
        // Remove existing associations
        await db.query('DELETE FROM market_employee_terminals WHERE employee_id = $1', [employeeId])

        // Add new associations
        if (terminals && terminals.length > 0) {
          for (const t of terminals) {
            await db.query(`
              INSERT INTO market_employee_terminals (
                employee_id, terminal_id,
                can_open_session, can_close_session, can_void_orders,
                can_give_discount, can_refund, max_discount_percent,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
              employeeId,
              t.terminalId,
              t.canOpenSession || false,
              t.canCloseSession || false,
              t.canVoidOrders || false,
              t.canGiveDiscount || false,
              t.canRefund || false,
              t.maxDiscountPercent || 0
            ])
          }
        }
      }

      await db.query('COMMIT')

      console.log('[Employee API] Updated employee:', employeeId)

      return NextResponse.json({
        success: true,
        message: 'Empleado actualizado exitosamente'
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Employee API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar empleado'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/accounting/employees/[id]
 * Delete/deactivate employee
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const employeeId = parseInt(id)

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    // Check employee exists
    const existing = await db.query(
      'SELECT id, user_id FROM market_employees WHERE id = $1 AND company_id = $2',
      [employeeId, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    // Soft delete: change status to terminated and clear POS credentials to allow reuse
    await db.query(`
      UPDATE market_employees
      SET status = 'terminated',
          termination_date = CURRENT_DATE,
          pos_badge_code = NULL,
          pos_pin = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [employeeId])

    // Remove terminal associations
    await db.query('DELETE FROM market_employee_terminals WHERE employee_id = $1', [employeeId])

    console.log('[Employee API] Terminated employee:', employeeId)

    return NextResponse.json({
      success: true,
      message: 'Empleado dado de baja exitosamente'
    })

  } catch (error) {
    console.error('[Employee API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar empleado'
    }, { status: 500 })
  }
}
