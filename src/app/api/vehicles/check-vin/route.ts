import { NextRequest, NextResponse } from 'next/server';
import { getAllVehiclesFromDatabase } from '@/lib/vehicle-database';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vin } = body;

    if (!vin) {
      return NextResponse.json(
        { error: 'VIN is required' },
        { status: 400 }
      );
    }

    // Get all vehicles from database
    const existingVehicles = getAllVehiclesFromDatabase();

    // Check if VIN already exists (case insensitive)
    const existingVehicle = existingVehicles.find(v =>
      v.vin.toUpperCase() === vin.toUpperCase()
    );

    return NextResponse.json({
      exists: !!existingVehicle,
      vehicle: existingVehicle ? {
        make: existingVehicle.make,
        model: existingVehicle.model,
        year: existingVehicle.model_year,
        nickname: existingVehicle.nickname,
      } : null
    });

  } catch (error) {
    console.error('Error checking VIN:', error);
    return NextResponse.json(
      { error: 'Error checking VIN' },
      { status: 500 }
    );
  }
}