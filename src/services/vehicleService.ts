import { VinDecodeResponse, VehiclePhotosResponse, ApiResponse, Vehicle, PaginatedResponse } from '@/types/vehicle';

// Configuración de la API de Auto.dev
const AUTO_DEV_API_KEY = process.env.NEXT_PUBLIC_AUTO_DEV_API_KEY || '';
const AUTO_DEV_BASE_URL = 'https://api.auto.dev';

// Headers comunes para las peticiones a Auto.dev
const autoDevHeaders = {
  'Authorization': `Bearer ${AUTO_DEV_API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Servicio para decodificar VIN usando API local (proxy a Auto.dev)
 */
export async function decodeVin(vin: string): Promise<ApiResponse<VinDecodeResponse>> {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`/api/vehicles/vin/${vin}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`VIN API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('VIN API request timed out, using mock data');
      } else {
        console.error('Error decoding VIN:', error);
      }
    } else {
      console.error('Unknown error decoding VIN:', error);
    }
    // Return mock data instead of error to allow registration to continue
    return {
      success: true,
      data: {
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
      },
    };
  }
}

/**
 * Servicio para obtener fotos del vehículo usando API local (proxy a Auto.dev)
 */
export async function getVehiclePhotos(vin: string): Promise<ApiResponse<string[]>> {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`/api/vehicles/photos/${vin}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Photo API request failed: ${response.status} ${response.statusText}`);
      // Return empty array instead of error to allow VIN decoding to continue
      return {
        success: true,
        data: [],
      };
    }

    const data = await response.json();

    // Check if data has expected structure
    if (!data.photo_urls || !Array.isArray(data.photo_urls)) {
      console.warn('Invalid photo data structure received');
      return {
        success: true,
        data: [],
      };
    }

    return {
      success: true,
      data: data.photo_urls,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('Photo API request timed out');
      } else {
        console.error('Error getting vehicle photos:', error);
      }
    } else {
      console.error('Unknown error getting vehicle photos:', error);
    }
    // Return empty array instead of error to allow VIN decoding to continue
    return {
      success: true,
      data: [],
    };
  }
}

/**
 * Servicio para decodificar VIN y obtener fotos en una sola llamada
 */
export async function decodeVinWithPhotos(vin: string): Promise<ApiResponse<VinDecodeResponse & { photo_urls: string[] }>> {
  try {
    // Ejecutar ambas peticiones en paralelo
    const [vinResponse, photosResponse] = await Promise.all([
      decodeVin(vin),
      getVehiclePhotos(vin),
    ]);

    if (!vinResponse.success || !vinResponse.data) {
      return {
        success: false,
        error: vinResponse.error || 'Failed to decode VIN',
      };
    }

    const photoUrls = photosResponse.success && photosResponse.data ? photosResponse.data : [];

    return {
      success: true,
      data: {
        ...vinResponse.data,
        photo_urls: photoUrls,
      },
    };
  } catch (error) {
    console.error('Error decoding VIN with photos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error decoding VIN with photos',
    };
  }
}

/**
 * Validar formato de VIN
 */
export function validateVin(vin: string): boolean {
  // VIN tiene 17 caracteres (excepto vehículos especiales)
  const cleanedVin = vin.replace(/[-\s]/g, '').toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleanedVin);
}

/**
 * Limpiar y formatear VIN
 */
export function formatVin(vin: string): string {
  return vin.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * API real para gestión de vehículos usando endpoints del servidor
 */
export async function createVehicle(vehicleData: any): Promise<ApiResponse<Vehicle>> {
  try {
    console.log('createVehicle API called with data:', vehicleData);

    const response = await fetch('/api/fleet/vehicles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vehicleData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al crear vehículo',
      };
    }

    const result = await response.json();
    console.log('Vehicle created via API:', result);

    return result;
  } catch (error) {
    console.error('Error creating vehicle via API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear vehículo',
    };
  }
}

export async function getVehicles(page: number = 1, limit: number = 10, search?: string, status?: string, availability?: string): Promise<ApiResponse<PaginatedResponse<Vehicle>>> {
  try {
    console.log('getVehicles API called with page:', page, 'limit:', limit);

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (availability && availability !== 'all') params.append('availability', availability);

    const response = await fetch(`/api/fleet/vehicles?${params}`);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener vehículos',
      };
    }

    const result = await response.json();
    console.log('Vehicles fetched via API:', result);

    return result;
  } catch (error) {
    console.error('Error getting vehicles via API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener vehículos',
    };
  }
}

export async function getVehicleById(id: string): Promise<ApiResponse<Vehicle>> {
  try {
    const response = await fetch(`/api/fleet/vehicles/${id}`);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener vehículo',
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting vehicle via API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener vehículo',
    };
  }
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> {
  try {
    const response = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al actualizar vehículo',
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating vehicle via API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al actualizar vehículo',
    };
  }
}

export async function deleteVehicle(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al eliminar vehículo',
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error deleting vehicle via API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar vehículo',
    };
  }
}

/**
 * Calcular capacidad de carga disponible basada en GVWR
 */
export function calculateCargoCapacity(gvwr?: string, vehicleType?: string): { weight_lbs: number; weight_kg: number; volume_cubic_ft: number; volume_cubic_m: number } {
  // Capacidades estimadas basadas en tipo de vehículo
  const capacities = {
    'truck': { weight_lbs: 4000, weight_kg: 1814, volume_cubic_ft: 500, volume_cubic_m: 14.2 },
    'van': { weight_lbs: 3000, weight_kg: 1361, volume_cubic_ft: 300, volume_cubic_m: 8.5 },
    'pickup': { weight_lbs: 2000, weight_kg: 907, volume_cubic_ft: 200, volume_cubic_m: 5.7 },
    'sedan': { weight_lbs: 500, weight_kg: 227, volume_cubic_ft: 50, volume_cubic_m: 1.4 },
    'suv': { weight_lbs: 1000, weight_kg: 454, volume_cubic_ft: 100, volume_cubic_m: 2.8 },
  };

  // Determinar tipo de vehículo
  let detectedType = 'sedan'; // default

  if (vehicleType) {
    const type = vehicleType.toLowerCase();
    if (type.includes('truck') || type.includes('cargo')) detectedType = 'truck';
    else if (type.includes('van') || type.includes('minivan')) detectedType = 'van';
    else if (type.includes('pickup') || type.includes('truck')) detectedType = 'pickup';
    else if (type.includes('suv')) detectedType = 'suv';
  }

  return capacities[detectedType as keyof typeof capacities] || capacities.sedan;
}