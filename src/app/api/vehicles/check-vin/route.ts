import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getCompanyFilter } from '@/lib/query-helpers';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vin, companyId: bodyCompanyId } = body;
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request);

    if (!vin) {
      return NextResponse.json(
        { error: 'VIN is required' },
        { status: 400 }
      );
    }

    // Determinar company_id a usar
    const companyIdToUse = bodyCompanyId || headerCompanyId || 1;

    // Check if VIN already exists WITHIN THE SAME COMPANY (case insensitive)
    const result = await db.query(
      'SELECT id, make, model, model_year, nickname FROM vehicles WHERE UPPER(vin) = UPPER($1) AND company_id = $2',
      [vin, companyIdToUse]
    );

    const existingVehicle = result.rows[0];

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