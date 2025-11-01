import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    // Usar el servicio de OpenStreetMap Nominatim (gratis y sin API key)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&addressdetails=1&limit=5`,
      {
        headers: {
          'User-Agent': 'CubaRapid/1.0 (contact@example.com)'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch address suggestions')
    }

    const data = await response.json()

    // Estructurar los datos de OpenStreetMap Nominatim
    const suggestions = data
      .filter((place: any) => place.address && place.display_name)
      .map((place: any) => ({
        display_name: place.display_name,
        address: {
          street: place.address.road || place.address.house_number ?
            `${place.address.house_number || ''} ${place.address.road || ''}`.trim() :
            place.display_name.split(',')[0] || '',
          city: place.address.city || place.address.town || place.address.village || '',
          state: place.address.state || '',
          postalCode: place.address.postcode || '',
          country: 'United States'
        },
        coordinates: [parseFloat(place.lon), parseFloat(place.lat)],
        center: [parseFloat(place.lon), parseFloat(place.lat)]
      }))

    return NextResponse.json({ suggestions })

  } catch (error) {
    console.error('Error in address lookup:', error)
    return NextResponse.json(
      { error: 'Failed to lookup address', suggestions: [] },
      { status: 500 }
    )
  }
}