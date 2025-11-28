import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getCompanyFilter } from '@/lib/query-helpers';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const availability = searchParams.get('availability') || '';
    const companyIdParam = searchParams.get('companyId');

    // Build WHERE conditions for PostgreSQL
    const conditions: string[] = [];
    const params: any[] = [];

    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      conditions.push(`(
        make ILIKE $${params.length - 3} OR
        model ILIKE $${params.length - 2} OR
        vin ILIKE $${params.length - 1} OR
        nickname ILIKE $${params.length}
      )`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (availability && availability !== 'all') {
      params.push(availability);
      conditions.push(`availability = $${params.length}`);
    }

    // Filtro por empresa (multi-tenant)
    if (!isSuperAdmin) {
      if (headerCompanyId) {
        params.push(headerCompanyId);
        conditions.push(`company_id = $${params.length}`);
      }
    } else if (companyIdParam) {
      params.push(parseInt(companyIdParam));
      conditions.push(`company_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM vehicles ${whereClause}`;
    const countResult = await db.query(countQuery, params.length > 0 ? params : undefined);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataQuery = `
      SELECT * FROM vehicles
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(dataQuery, paginationParams);

    // Transform vehicles to match expected interface
    const transformedVehicles = result.rows.map(vehicle => {
      // Handle capacity transformation
      let capacity = vehicle.capacity;
      if (typeof capacity === 'string') {
        try {
          capacity = JSON.parse(capacity);
        } catch {
          capacity = { empty_boxes: 0, full_boxes: 0 };
        }
      }

      return {
        ...vehicle,
        year: vehicle.model_year || vehicle.year,
        capacity,
        // Ensure these fields exist for compatibility
        licensePlate: vehicle.license_plate,
        modelYear: vehicle.model_year
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedVehicles,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { error: 'Error fetching vehicles' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request);
    const body = await request.json();
    const {
      vin,
      make,
      model,
      year,
      model_year,
      body_type,
      color,
      nickname,
      photo_url,
      license_plate,
      capacity,
      empty_boxes,
      full_boxes,
      status = 'ACTIVE',
      availability = 'AVAILABLE',
      vin_data,
      mileage,
      insuranceexpiry,
      oil_change_frequency,
      next_oil_change,
      can_collect_durable,
      companyId
    } = body;

    // Validate required fields
    if (!vin || !make || !model || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: vin, make, model, year' },
        { status: 400 }
      );
    }

    // Determinar company_id
    const companyIdToUse = companyId || headerCompanyId || 1;

    // Check if VIN already exists
    const existingCheck = await db.query(
      'SELECT id FROM vehicles WHERE UPPER(vin) = UPPER($1)',
      [vin]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Vehicle with this VIN already exists' },
        { status: 400 }
      );
    }

    // Prepare capacity
    let finalCapacity = { empty_boxes: 0, full_boxes: 0 };
    if (empty_boxes !== undefined || full_boxes !== undefined) {
      finalCapacity = {
        empty_boxes: empty_boxes || 0,
        full_boxes: full_boxes || 0
      };
    } else if (capacity) {
      finalCapacity = capacity;
    }

    // Generate unique ID
    const vehicleId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert into PostgreSQL
    const insertQuery = `
      INSERT INTO vehicles (
        id, company_id, vin, license_plate, make, model, model_year, body_type,
        color, nickname, photo_url, capacity, status, availability,
        vin_data, mileage, insurance_expiry, oil_change_frequency,
        next_oil_change, can_collect_durable, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, NOW(), NOW()
      )
      RETURNING *
    `;

    const values = [
      vehicleId,
      companyIdToUse,
      vin.toUpperCase(),
      license_plate || null,
      make,
      model,
      year || model_year,
      body_type || 'Unknown',
      color || 'Unknown',
      nickname || `${make} ${model}`,
      photo_url || null,
      JSON.stringify(finalCapacity),
      status,
      availability,
      vin_data ? JSON.stringify(vin_data) : null,
      mileage || 0,
      insuranceexpiry || null,
      oil_change_frequency || 5000,
      next_oil_change || null,
      can_collect_durable || false
    ];

    const result = await db.query(insertQuery, values);
    const vehicle = result.rows[0];

    // Transform response
    const transformedVehicle = {
      ...vehicle,
      year: vehicle.model_year,
      capacity: typeof vehicle.capacity === 'string' ? JSON.parse(vehicle.capacity) : vehicle.capacity
    };

    return NextResponse.json({
      success: true,
      data: transformedVehicle,
      message: 'Vehicle created successfully',
    });

  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json(
      { error: 'Error creating vehicle', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}