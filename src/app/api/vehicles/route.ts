import { NextRequest, NextResponse } from 'next/server';
import {
  saveVehicleToDatabase,
  getAllVehiclesFromDatabase,
  getVehicleStatisticsFromDatabase
} from '@/lib/vehicle-database';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    // Temporarily remove authentication requirement
    // const session = await getServerSession();

    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const availability = searchParams.get('availability') || '';

    // Get all vehicles from database
    let vehicles = getAllVehiclesFromDatabase();

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      vehicles = vehicles.filter(vehicle =>
        vehicle.make.toLowerCase().includes(searchLower) ||
        vehicle.model.toLowerCase().includes(searchLower) ||
        vehicle.vin.toLowerCase().includes(searchLower) ||
        vehicle.nickname.toLowerCase().includes(searchLower)
      );
    }

    if (status && status !== 'all') {
      vehicles = vehicles.filter(vehicle => vehicle.status === status);
    }

    if (availability && availability !== 'all') {
      vehicles = vehicles.filter(vehicle => vehicle.availability === availability);
    }

    // Sort by created_at descending
    vehicles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    const total = vehicles.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVehicles = vehicles.slice(startIndex, endIndex);

    // Transform vehicles to match expected interface
    const transformedVehicles = paginatedVehicles.map(vehicle => {
      // Handle capacity transformation for new vs old format
      let capacity;
      if (vehicle.capacity && (vehicle.capacity.weight_lbs || vehicle.capacity.weight_kg)) {
        // Old format with weight/volume - use as is
        capacity = vehicle.capacity;
      } else if (vehicle.capacity && ('empty_boxes' in vehicle.capacity || 'full_boxes' in vehicle.capacity)) {
        // New format with boxes - convert to weight/volume for display compatibility
        const emptyBoxes = (vehicle.capacity as any).empty_boxes || 0;
        const fullBoxes = (vehicle.capacity as any).full_boxes || 0;
        const totalBoxes = emptyBoxes + fullBoxes;

        // Convert boxes to estimated weight/volume (assuming average box: 25 lbs, 1.5 ft³)
        capacity = {
          weight_lbs: totalBoxes * 25,
          weight_kg: Math.round(totalBoxes * 25 * 0.453592),
          volume_cubic_ft: Math.round(totalBoxes * 1.5),
          volume_cubic_m: Math.round(totalBoxes * 1.5 * 0.0283168),
          // Also preserve the new fields
          empty_boxes: emptyBoxes,
          full_boxes: fullBoxes
        };
      } else {
        // Empty or invalid capacity - use defaults
        capacity = {
          weight_lbs: 2000,
          weight_kg: 907,
          volume_cubic_ft: 200,
          volume_cubic_m: 5.7,
          empty_boxes: 0,
          full_boxes: 0
        };
      }

      return {
        ...vehicle,
        year: vehicle.model_year, // Keep both for compatibility
        capacity
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
    // Temporarily remove authentication requirement
    // const session = await getServerSession();

    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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
      capacity,
      empty_boxes,
      full_boxes,
      status = 'ACTIVE',
      availability = 'AVAILABLE',
      vin_data,
      // New maintenance fields
      mileage,
      insuranceexpiry,
      oil_change_frequency,
      next_oil_change,
      can_collect_durable
    } = body;

    // Validate required fields
    if (!vin || !make || !model || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: vin, make, model, year' },
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
    const existingVehicles = getAllVehiclesFromDatabase();
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

    // Prepare vehicle data - handle new capacity format
    let finalCapacity;
    if (empty_boxes !== undefined || full_boxes !== undefined) {
      // New format with boxes
      finalCapacity = {
        empty_boxes: empty_boxes || 0,
        full_boxes: full_boxes || 0
      };
    } else if (capacity && (capacity.weight_lbs || capacity.weight_kg)) {
      // Old format with weight/volume
      finalCapacity = capacity;
    } else {
      // Default empty capacity
      finalCapacity = {
        empty_boxes: 0,
        full_boxes: 0
      };
    }

    const vehicleData = {
      vin: vin.toUpperCase(),
      make,
      model,
      model_year: year || model_year,
      body_type: body_type || 'Unknown',
      color: color || 'Unknown',
      nickname: nickname || `${make} ${model}`,
      photo_url,
      status,
      availability,
      capacity: finalCapacity,
      vin_data: vin_data || {},
      // Add maintenance fields with defaults
      mileage: mileage || 0,
      insurance_expiry: insuranceexpiry || null,
      oil_change_frequency: oil_change_frequency || 5000,
      next_oil_change: next_oil_change || null,
      can_collect_durable: can_collect_durable || false,
    };

    const vehicle = saveVehicleToDatabase(vehicleData);

    // Transform response to match expected interface
    const transformedVehicle = {
      ...vehicle,
      year: vehicle.model_year, // Keep both for compatibility
    };

    return NextResponse.json({
      success: true,
      data: transformedVehicle,
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