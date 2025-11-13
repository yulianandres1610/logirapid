import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


const AUTO_DEV_API_KEY = process.env.NEXT_PUBLIC_AUTO_DEV_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  if (!AUTO_DEV_API_KEY) {
    return NextResponse.json(
      { photo_urls: [] },
      { status: 200 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.auto.dev/photos/${vin}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ photo_urls: [] });
    }

    const data = await response.json();

    // Check if there's an error in the response
    if (data.error) {
      console.warn('Vehicle photos API error:', data.error);
      return NextResponse.json({ photo_urls: [] });
    }

    // The v1 API might return photos in a different format
    // For now, return empty array as we need to see the actual response format
    if (data.photos && Array.isArray(data.photos)) {
      return NextResponse.json({ photo_urls: data.photos });
    } else if (data.photo_urls && Array.isArray(data.photo_urls)) {
      // Filter for primary photos (exterior front if available)
      const primaryPhotos = data.photo_urls
        .filter((photo: any) => photo.shot_type === 'exterior' && (!photo.angle || photo.angle === 'front'))
        .map((photo: any) => photo.url);

      // If no exterior front photos, use the first available
      const photoUrls = primaryPhotos.length > 0 ? primaryPhotos : [data.photo_urls[0]?.url].filter(Boolean);
      return NextResponse.json({ photo_urls: photoUrls });
    } else {
      return NextResponse.json({ photo_urls: [] });
    }
  } catch (error) {
    console.error('Error getting vehicle photos:', error);
    return NextResponse.json({ photo_urls: [] });
  }
}