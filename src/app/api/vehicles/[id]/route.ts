import { NextRequest, NextResponse } from 'next/server';
import {
  getVehicleByIdFromDatabase,
  updateVehicleInDatabase,
  deleteVehicleFromDatabase
} from '@/lib/vehicle-database';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Temporarily remove authentication requirement
    // const session = await getServerSession();

    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { id } = await params;

    const vehicle = getVehicleByIdFromDatabase(id);

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // Transform response to match expected interface
    const transformedVehicle = {
      ...vehicle,
      year: vehicle.model_year, // Keep both for compatibility
    };

    return NextResponse.json({
      success: true,
      data: transformedVehicle,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return NextResponse.json(
      { error: 'Error fetching vehicle' },
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Temporarily remove authentication requirement
    // const session = await getServerSession();

    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { id } = await params;
    const body = await request.json();

    // Check if vehicle exists
    const existingVehicle = getVehicleByIdFromDatabase(id);

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    // Prepare update data
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Handle year/model_year conversion
    if (body.year && !body.model_year) {
      updateData.model_year = body.year;
    } else if (body.model_year && !body.year) {
      updateData.year = body.model_year;
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdat;
    delete updateData.vin; // VIN shouldn't be updatable

    const updatedVehicle = updateVehicleInDatabase(id, updateData);

    if (!updatedVehicle) {
      return NextResponse.json(
        { error: 'Failed to update vehicle' },
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

    // Transform response to match expected interface
    const transformedVehicle = {
      ...updatedVehicle,
      year: updatedVehicle.model_year, // Keep both for compatibility
    };

    return NextResponse.json({
      success: true,
      data: transformedVehicle,
      message: 'Vehicle updated successfully',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json(
      { error: 'Error updating vehicle' },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Temporarily remove authentication requirement
    // const session = await getServerSession();

    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { id } = await params;

    // Check if vehicle exists
    const existingVehicle = getVehicleByIdFromDatabase(id);

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const success = deleteVehicleFromDatabase(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete vehicle' },
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
      message: 'Vehicle deleted successfully',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json(
      { error: 'Error deleting vehicle' },
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