import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getCompanyFilter } from '@/lib/query-helpers';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener vehículo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isSuperAdmin, companyId } = getCompanyFilter(request);

    // Construir query con filtro de empresa
    let query = `
      SELECT
        id, vin, license_plate, make, model, COALESCE(year, model_year) as year,
        body_type, color, nickname, status, availability, capacity_weight_kg,
        capacity_volume_m3, empty_boxes, full_boxes, driver_id, current_route_id,
        photos, insurance_documents, can_collect_durable, registration_date, mileage,
        insurance_expiry, oil_change_frequency, next_oil_change, company_id,
        created_at, updated_at
      FROM vehicles
      WHERE id = $1
    `;
    const queryParams: any[] = [id];

    // Añadir filtro de empresa si no es super admin
    if (!isSuperAdmin && companyId) {
      query += ` AND company_id = $2`;
      queryParams.push(companyId);
    }

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const vehicle = {
      id: row.id.toString(),
      vin: row.vin,
      license_plate: row.license_plate,
      make: row.make,
      model: row.model,
      year: row.year,
      body_type: row.body_type,
      color: row.color,
      nickname: row.nickname,
      status: row.status,
      availability: row.availability,
      capacity: {
        weight_kg: row.capacity_weight_kg || 0,
        volume_m3: parseFloat(row.capacity_volume_m3) || 0,
        empty_boxes: row.empty_boxes || 0,
        full_boxes: row.full_boxes || 0
      },
      driver_id: row.driver_id,
      current_route_id: row.current_route_id,
      photos: row.photos || [],
      insurance_documents: row.insurance_documents || [],
      can_collect_durable: row.can_collect_durable,
      registration_date: row.registration_date,
      mileage: row.mileage,
      insurance_expiry: row.insurance_expiry,
      oil_change_frequency: row.oil_change_frequency,
      next_oil_change: row.next_oil_change,
      company_id: row.company_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    return NextResponse.json({
      success: true,
      data: vehicle
    });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching vehicle' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar vehículo por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isSuperAdmin, companyId } = getCompanyFilter(request);
    const body = await request.json();

    // Verificar que el vehículo existe y pertenece a la empresa
    let checkQuery = 'SELECT id FROM vehicles WHERE id = $1';
    const checkParams: any[] = [id];

    if (!isSuperAdmin && companyId) {
      checkQuery += ' AND company_id = $2';
      checkParams.push(companyId);
    }

    const checkResult = await db.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Extraer campos del body
    const {
      vin,
      license_plate,
      licenseplate,
      make,
      model,
      year,
      body_type,
      color,
      nickname,
      status,
      availability,
      empty_boxes,
      full_boxes,
      driver_id,
      current_route_id,
      photos,
      insurance_documents,
      can_collect_durable,
      mileage,
      insurance_expiry,
      oil_change_frequency,
      next_oil_change
    } = body;

    const finalLicensePlate = license_plate || licenseplate;

    // Construir query de actualización dinámicamente
    const updates: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (vin !== undefined) {
      updates.push(`vin = $${paramIndex++}`);
      updateParams.push(vin.toUpperCase());
    }
    if (finalLicensePlate !== undefined) {
      updates.push(`license_plate = $${paramIndex++}`);
      updateParams.push(finalLicensePlate.toUpperCase());
    }
    if (make !== undefined) {
      updates.push(`make = $${paramIndex++}`);
      updateParams.push(make.trim());
    }
    if (model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      updateParams.push(model.trim());
    }
    if (year !== undefined) {
      updates.push(`year = $${paramIndex++}`);
      updateParams.push(parseInt(year));
    }
    if (body_type !== undefined) {
      updates.push(`body_type = $${paramIndex++}`);
      updateParams.push(body_type);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      updateParams.push(color);
    }
    if (nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      updateParams.push(nickname);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      updateParams.push(status);
    }
    if (availability !== undefined) {
      updates.push(`availability = $${paramIndex++}`);
      updateParams.push(availability);
    }
    if (empty_boxes !== undefined) {
      const emptyBoxesInt = parseInt(empty_boxes) || 0;
      updates.push(`empty_boxes = $${paramIndex++}`);
      updateParams.push(emptyBoxesInt);
    }
    if (full_boxes !== undefined) {
      const fullBoxesInt = parseInt(full_boxes) || 0;
      updates.push(`full_boxes = $${paramIndex++}`);
      updateParams.push(fullBoxesInt);
    }
    if (driver_id !== undefined) {
      updates.push(`driver_id = $${paramIndex++}`);
      updateParams.push(driver_id);
    }
    if (current_route_id !== undefined) {
      updates.push(`current_route_id = $${paramIndex++}`);
      updateParams.push(current_route_id);
    }
    if (photos !== undefined) {
      updates.push(`photos = $${paramIndex++}`);
      updateParams.push(JSON.stringify(photos));
    }
    if (insurance_documents !== undefined) {
      updates.push(`insurance_documents = $${paramIndex++}`);
      updateParams.push(JSON.stringify(insurance_documents));
    }
    if (can_collect_durable !== undefined) {
      updates.push(`can_collect_durable = $${paramIndex++}`);
      updateParams.push(can_collect_durable);
    }
    if (mileage !== undefined) {
      updates.push(`mileage = $${paramIndex++}`);
      updateParams.push(mileage);
    }
    if (insurance_expiry !== undefined) {
      updates.push(`insurance_expiry = $${paramIndex++}`);
      updateParams.push(insurance_expiry || null);
    }
    if (oil_change_frequency !== undefined) {
      updates.push(`oil_change_frequency = $${paramIndex++}`);
      updateParams.push(oil_change_frequency);
    }
    if (next_oil_change !== undefined) {
      updates.push(`next_oil_change = $${paramIndex++}`);
      updateParams.push(next_oil_change || null);
    }

    // Recalcular capacidad si cambiaron las cajas
    if (empty_boxes !== undefined || full_boxes !== undefined) {
      const emptyBoxes = empty_boxes !== undefined ? parseInt(empty_boxes) : 0;
      const fullBoxes = full_boxes !== undefined ? parseInt(full_boxes) : 0;
      const capacityWeightKg = (emptyBoxes + fullBoxes) * 25;
      const capacityVolumeM3 = (emptyBoxes + fullBoxes) * 0.1;

      updates.push(`capacity_weight_kg = $${paramIndex++}`);
      updateParams.push(capacityWeightKg);
      updates.push(`capacity_volume_m3 = $${paramIndex++}`);
      updateParams.push(capacityVolumeM3);
    }

    // Siempre actualizar updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      // Solo updated_at, no hay cambios reales
      return NextResponse.json({
        success: true,
        message: 'No changes to update'
      });
    }

    // Ejecutar actualización
    updateParams.push(id);
    const updateQuery = `
      UPDATE vehicles
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, updateParams);
    const row = result.rows[0];

    const vehicle = {
      id: row.id.toString(),
      vin: row.vin,
      license_plate: row.license_plate,
      make: row.make,
      model: row.model,
      year: row.year,
      body_type: row.body_type,
      color: row.color,
      nickname: row.nickname,
      status: row.status,
      availability: row.availability,
      capacity: {
        weight_kg: row.capacity_weight_kg,
        volume_m3: parseFloat(row.capacity_volume_m3),
        empty_boxes: row.empty_boxes,
        full_boxes: row.full_boxes
      },
      can_collect_durable: row.can_collect_durable,
      mileage: row.mileage,
      insurance_expiry: row.insurance_expiry,
      updated_at: row.updated_at
    };

    return NextResponse.json({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error updating vehicle' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar vehículo por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isSuperAdmin, companyId } = getCompanyFilter(request);

    // Construir query con filtro de empresa
    let deleteQuery = 'DELETE FROM vehicles WHERE id = $1';
    const queryParams: any[] = [id];

    if (!isSuperAdmin && companyId) {
      deleteQuery += ' AND company_id = $2';
      queryParams.push(companyId);
    }

    deleteQuery += ' RETURNING id';

    const result = await db.query(deleteQuery, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting vehicle' },
      { status: 500 }
    );
  }
}
