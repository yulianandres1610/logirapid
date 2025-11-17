import { NextRequest, NextResponse } from 'next/server';
import {
  createVehicle,
  getAllVehicles,
  getVehiclesByStatus,
  searchVehicles
} from '@/lib/fleet-database';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const availability = searchParams.get('availability') || '';

    let vehicles = getAllVehicles();

    // Apply filters
    if (search) {
      vehicles = searchVehicles(search);
    }

    if (status && status !== 'all') {
      vehicles = vehicles.filter(vehicle => vehicle.status === status);
    }

    if (availability && availability !== 'all') {
      vehicles = vehicles.filter(vehicle => vehicle.availability === availability);
    }

    // Apply pagination
    const total = vehicles.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVehicles = vehicles.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedVehicles,
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
    const body = await request.json();
    const {
      vin,
      licenseplate,
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
      availability = 'AVAILABLE'
    } = body;

    // Validate required fields
    if (!vin || !licenseplate || !make || !model || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: vin, licenseplate, make, model, year' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // Check if VIN already exists
    const existingVehicles = getAllVehicles();
    const existingVehicle = existingVehicles.find(v => v.vin.toUpperCase() === vin.toUpperCase());

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle with this VIN already exists' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // Check if license plate already exists
    const existingPlate = existingVehicles.find(v => v.license_plate.toUpperCase() === licenseplate.toUpperCase());

    if (existingPlate) {
      return NextResponse.json(
        { error: 'Vehicle with this license plate already exists' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const vehicleData = {
      vin: vin.toUpperCase(),
      license_plate: licenseplate.toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: parseInt(year),
      body_type: body_type || 'Unknown',
      color: color || 'Unknown',
      nickname: nickname || `${make} ${model}`,
      status,
      availability,
      capacity: {
        weight_kg: (empty_boxes + full_boxes) * 25, // 25kg per box average
        volume_m3: (empty_boxes + full_boxes) * 0.1, // 0.1m³ per box average
        empty_boxes: parseInt(empty_boxes) || 0,
        full_boxes: parseInt(full_boxes) || 0
      },
      photos,
      insurance_documents,
      registration_date: new Date().toISOString().split('T')[0],
      can_collect_durable: true,
      last_updated: new Date().toISOString()
    };

    const vehicle = createVehicle(vehicleData);

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Error creating vehicle' },
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

    return NextResponse.json({
      success: true,
      data: vehicle,
      message: 'Vehicle created successfully',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json(
      { error: 'Error creating vehicle' },
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