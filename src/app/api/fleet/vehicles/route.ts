import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getCompanyFilter } from '@/lib/query-helpers';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener vehículos con paginación y filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { isSuperAdmin, companyId } = getCompanyFilter(request);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const availability = searchParams.get('availability') || '';
    const offset = (page - 1) * limit;

    // Construir condiciones WHERE
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filtro por empresa (multi-tenant)
    if (!isSuperAdmin && companyId) {
      params.push(companyId);
      conditions.push(`company_id = $${paramIndex++}`);
    }

    // Filtro por búsqueda
    if (search) {
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      conditions.push(`(
        vin ILIKE $${paramIndex++} OR
        license_plate ILIKE $${paramIndex++} OR
        make ILIKE $${paramIndex++} OR
        model ILIKE $${paramIndex++} OR
        nickname ILIKE $${paramIndex++}
      )`);
    }

    // Filtro por estado
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${paramIndex++}`);
    }

    // Filtro por disponibilidad
    if (availability && availability !== 'all') {
      params.push(availability);
      conditions.push(`availability = $${paramIndex++}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) FROM vehicles ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Obtener vehículos con paginación
    params.push(limit, offset);
    const dataQuery = `
      SELECT
        id,
        vin,
        license_plate,
        make,
        model,
        COALESCE(year, model_year) as year,
        body_type,
        color,
        nickname,
        status,
        availability,
        capacity_weight_kg,
        capacity_volume_m3,
        empty_boxes,
        full_boxes,
        driver_id,
        current_route_id,
        photos,
        insurance_documents,
        can_collect_durable,
        registration_date,
        mileage,
        insurance_expiry,
        oil_change_frequency,
        next_oil_change,
        company_id,
        created_at,
        updated_at
      FROM vehicles
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const result = await db.query(dataQuery, params);

    // Mapear resultados al formato esperado por el frontend
    const vehicles = result.rows.map(row => ({
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
    }));

    return NextResponse.json({
      success: true,
      data: vehicles,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching vehicles' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo vehículo
export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId } = getCompanyFilter(request);
    const body = await request.json();

    const {
      vin,
      licenseplate,
      license_plate,
      make,
      model,
      year,
      body_type,
      color,
      nickname,
      photos = [],
      insurance_documents = [],
      empty_boxes = 0,
      full_boxes = 0,
      status = 'ACTIVE',
      availability = 'AVAILABLE',
      mileage = 0,
      insurance_expiry,
      oil_change_frequency = 5000,
      next_oil_change,
      can_collect_durable = true
    } = body;

    const finalLicensePlate = licenseplate || license_plate;

    // Validar campos requeridos
    if (!vin || !finalLicensePlate || !make || !model || !year) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: vin, licenseplate, make, model, year' },
        { status: 400 }
      );
    }

    // Verificar si VIN ya existe
    const existingVin = await db.query(
      'SELECT id FROM vehicles WHERE UPPER(vin) = UPPER($1)',
      [vin]
    );
    if (existingVin.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Vehicle with this VIN already exists' },
        { status: 400 }
      );
    }

    // Verificar si placa ya existe
    const existingPlate = await db.query(
      'SELECT id FROM vehicles WHERE UPPER(license_plate) = UPPER($1)',
      [finalLicensePlate]
    );
    if (existingPlate.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Vehicle with this license plate already exists' },
        { status: 400 }
      );
    }

    // Calcular capacidad
    const emptyBoxesInt = parseInt(empty_boxes) || 0;
    const fullBoxesInt = parseInt(full_boxes) || 0;
    const capacityWeightKg = (emptyBoxesInt + fullBoxesInt) * 25;
    const capacityVolumeM3 = (emptyBoxesInt + fullBoxesInt) * 0.1;

    // Insertar vehículo
    const insertQuery = `
      INSERT INTO vehicles (
        vin, license_plate, make, model, year, body_type, color, nickname,
        status, availability, capacity_weight_kg, capacity_volume_m3,
        empty_boxes, full_boxes, photos, insurance_documents,
        can_collect_durable, registration_date, mileage, insurance_expiry,
        oil_change_frequency, next_oil_change, company_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *
    `;

    const result = await db.query(insertQuery, [
      vin.toUpperCase(),
      finalLicensePlate.toUpperCase(),
      make.trim(),
      model.trim(),
      parseInt(year),
      body_type || 'Unknown',
      color || 'Unknown',
      nickname || `${make} ${model}`,
      status,
      availability,
      capacityWeightKg,
      capacityVolumeM3,
      emptyBoxesInt,
      fullBoxesInt,
      JSON.stringify(photos),
      JSON.stringify(insurance_documents),
      can_collect_durable,
      new Date().toISOString().split('T')[0],
      mileage,
      insurance_expiry || null,
      oil_change_frequency,
      next_oil_change || null,
      companyId || null
    ]);

    const vehicle = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        id: vehicle.id.toString(),
        vin: vehicle.vin,
        license_plate: vehicle.license_plate,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        body_type: vehicle.body_type,
        color: vehicle.color,
        nickname: vehicle.nickname,
        status: vehicle.status,
        availability: vehicle.availability,
        capacity: {
          weight_kg: vehicle.capacity_weight_kg,
          volume_m3: parseFloat(vehicle.capacity_volume_m3),
          empty_boxes: vehicle.empty_boxes,
          full_boxes: vehicle.full_boxes
        },
        can_collect_durable: vehicle.can_collect_durable,
        mileage: vehicle.mileage,
        insurance_expiry: vehicle.insurance_expiry,
        created_at: vehicle.created_at
      },
      message: 'Vehicle created successfully',
    });

  } catch (error: any) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error creating vehicle' },
      { status: 500 }
    );
  }
}
