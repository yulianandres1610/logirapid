import { NextRequest, NextResponse } from 'next/server';

const AUTO_DEV_API_KEY = process.env.NEXT_PUBLIC_AUTO_DEV_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  if (!AUTO_DEV_API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.auto.dev/vin/${vin}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If API fails, return mock data
      const mockData = {
        vin: vin,
        make: 'Unknown',
        model: 'Unknown',
        model_year: new Date().getFullYear(),
        body_type: 'Unknown',
        color: 'Unknown',
        drivetrain: '',
        engine: '',
        transmission: '',
        fuel_type: '',
        doors: 4,
        cylinders: 0,
        displacement: 0,
        manufacturer: '',
        plant: '',
        series: '',
        trim: '',
        vehicle_type: 'sedan',
        gvwr: '',
      };

      return NextResponse.json(mockData);
    }

    const data = await response.json();

    const formattedData = {
      vin: data.vin || vin,
      make: data.make || 'Unknown',
      model: data.model || 'Unknown',
      model_year: data.vehicle?.year || new Date().getFullYear(),
      body_type: data.type || 'Unknown',
      color: 'Unknown', // La API v1 no devuelve color
      drivetrain: '',
      engine: '',
      transmission: '',
      fuel_type: '',
      doors: 4,
      cylinders: 0,
      displacement: 0,
      msrp: undefined,
      manufacturer: data.vehicle?.manufacturer || '',
      plant: data.origin || '',
      series: '',
      trim: data.trim || '',
      style: data.style || '',
      vehicle_type: data.type?.toLowerCase().includes('suv') ? 'suv' :
                   data.type?.toLowerCase().includes('truck') ? 'truck' :
                   data.type?.toLowerCase().includes('van') ? 'van' :
                   data.type?.toLowerCase().includes('mpv') ? 'mpv' : 'sedan',
      gvwr: '',
      wmi: data.wmi || '',
      squishVin: data.squishVin || '',
      checksum: data.checksum || false,
      vinValid: data.vinValid || false,
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error decoding VIN:', error);

    // Return mock data on error
    const mockData = {
      vin: vin,
      make: 'Unknown',
      model: 'Unknown',
      model_year: new Date().getFullYear(),
      body_type: 'Unknown',
      color: 'Unknown',
      drivetrain: '',
      engine: '',
      transmission: '',
      fuel_type: '',
      doors: 4,
      cylinders: 0,
      displacement: 0,
      manufacturer: '',
      plant: '',
      series: '',
      trim: '',
      vehicle_type: 'sedan',
      gvwr: '',
    };

    return NextResponse.json(mockData);
  }
}