import { Vehicle, VehicleStatus, VehicleAvailability } from '@/types/vehicle';

// Storage key for localStorage
const VEHICLES_STORAGE_KEY = 'logirapid_vehicles';

// Vehicle interface for local storage (separate from Vehicle interface)
interface StoredVehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  model_year: number; // Keep as model_year in storage
  body_type: string;
  color: string;
  nickname: string;
  photo_url?: string;
  capacity: {
    weight_lbs: number;
    weight_kg: number;
    volume_cubic_ft: number;
    volume_cubic_m: number;
  };
  status: VehicleStatus;
  availability: VehicleAvailability;
  current_route_id?: string;
  created_at: string;
  updated_at: string;
  vin_data: any;
}

/**
 * Save a vehicle to localStorage
 */
export function saveVehicleToStorage(vehicleData: Omit<StoredVehicle, 'id' | 'created_at' | 'updated_at'>): StoredVehicle {
  const vehicles = getAllVehiclesFromStorage();

  const newVehicle: StoredVehicle = {
    ...vehicleData,
    id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  vehicles.push(newVehicle);

  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
    console.log('Vehicle saved successfully:', newVehicle.id);
    return newVehicle;
  } catch (error) {
    console.error('Error saving vehicle to localStorage:', error);
    throw new Error('No se pudo guardar el vehículo en el almacenamiento local');
  }
}

/**
 * Get all vehicles from localStorage
 */
export function getAllVehiclesFromStorage(): StoredVehicle[] {
  try {
    console.log('=== getAllVehiclesFromStorage Debug ===');
    const stored = localStorage.getItem(VEHICLES_STORAGE_KEY);
    console.log('Raw data from localStorage:', stored);

    if (!stored) {
      console.log('No data found in localStorage');
      return [];
    }

    const vehicles = JSON.parse(stored);
    console.log('Parsed vehicles:', vehicles);
    console.log('Number of vehicles parsed:', vehicles.length);

    // Validate and filter vehicles
    if (!Array.isArray(vehicles)) {
      console.warn('Invalid vehicles data in localStorage, resetting');
      localStorage.removeItem(VEHICLES_STORAGE_KEY);
      return [];
    }

    const filteredVehicles = vehicles.filter((vehicle: any) => {
      const isValid = vehicle &&
        typeof vehicle === 'object' &&
        vehicle.id &&
        vehicle.vin &&
        vehicle.make &&
        vehicle.model &&
        (vehicle.model_year || vehicle.year); // Accept both model_year and year

      if (!isValid) {
        console.log('Vehicle filtered out:', vehicle);
      }
      return isValid;
    });

    console.log('Filtered vehicles count:', filteredVehicles.length);
    console.log('Filtered vehicles:', filteredVehicles);

    return filteredVehicles;
  } catch (error) {
    console.error('Error reading vehicles from localStorage:', error);
    localStorage.removeItem(VEHICLES_STORAGE_KEY);
    return [];
  }
}

/**
 * Get a vehicle by ID from localStorage
 */
export function getVehicleByIdFromStorage(id: string): StoredVehicle | null {
  const vehicles = getAllVehiclesFromStorage();
  return vehicles.find(v => v.id === id) || null;
}

/**
 * Update a vehicle in localStorage
 */
export function updateVehicleInStorage(id: string, updates: Partial<StoredVehicle>): StoredVehicle | null {
  const vehicles = getAllVehiclesFromStorage();
  const vehicleIndex = vehicles.findIndex(v => v.id === id);

  if (vehicleIndex === -1) {
    console.warn('Vehicle not found for update:', id);
    return null;
  }

  const updatedVehicle = {
    ...vehicles[vehicleIndex],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  vehicles[vehicleIndex] = updatedVehicle;

  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(vehicles));
    console.log('Vehicle updated successfully:', id);
    return updatedVehicle;
  } catch (error) {
    console.error('Error updating vehicle in localStorage:', error);
    throw new Error('No se pudo actualizar el vehículo en el almacenamiento local');
  }
}

/**
 * Delete a vehicle from localStorage
 */
export function deleteVehicleFromStorage(id: string): boolean {
  const vehicles = getAllVehiclesFromStorage();
  const filteredVehicles = vehicles.filter(v => v.id !== id);

  if (filteredVehicles.length === vehicles.length) {
    console.warn('Vehicle not found for deletion:', id);
    return false;
  }

  try {
    localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(filteredVehicles));
    console.log('Vehicle deleted successfully:', id);
    return true;
  } catch (error) {
    console.error('Error deleting vehicle from localStorage:', error);
    throw new Error('No se pudo eliminar el vehículo del almacenamiento local');
  }
}

/**
 * Search vehicles by query
 */
export function searchVehiclesInStorage(query: string): StoredVehicle[] {
  const vehicles = getAllVehiclesFromStorage();
  const searchQuery = query.toLowerCase().trim();

  if (!searchQuery) {
    return vehicles;
  }

  return vehicles.filter(vehicle =>
    vehicle.nickname.toLowerCase().includes(searchQuery) ||
    vehicle.make.toLowerCase().includes(searchQuery) ||
    vehicle.model.toLowerCase().includes(searchQuery) ||
    vehicle.vin.toLowerCase().includes(searchQuery) ||
    vehicle.model_year.toString().includes(searchQuery)
  );
}

/**
 * Get vehicle statistics
 */
export function getVehicleStatistics() {
  const vehicles = getAllVehiclesFromStorage();

  const total = vehicles.length;
  const active = vehicles.filter(v => v.status === 'ACTIVE').length;
  const available = vehicles.filter(v => v.availability === 'AVAILABLE').length;
  const inTransit = vehicles.filter(v => v.status === 'IN_TRANSIT').length;

  // Count by vehicle type
  const byType = vehicles.reduce((acc, vehicle) => {
    const type = vehicle.body_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count by make
  const byMake = vehicles.reduce((acc, vehicle) => {
    const make = vehicle.make || 'unknown';
    acc[make] = (acc[make] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    active,
    available,
    inTransit,
    byType,
    byMake,
  };
}

/**
 * Export vehicles data (for backup)
 */
export function exportVehiclesData(): string {
  const vehicles = getAllVehiclesFromStorage();
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    vehicles: vehicles,
    statistics: getVehicleStatistics(),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import vehicles data (for restore)
 */
export function importVehiclesData(jsonData: string): { success: boolean; imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(jsonData);

    if (!data.vehicles || !Array.isArray(data.vehicles)) {
      errors.push('Formato de datos inválido');
      return { success: false, imported: 0, errors };
    }

    const currentVehicles = getAllVehiclesFromStorage();
    const existingVins = new Set(currentVehicles.map(v => v.vin));

    for (const vehicle of data.vehicles) {
      try {
        // Validate required fields
        if (!vehicle.vin || !vehicle.nickname) {
          errors.push(`Vehículo inválido: ${vehicle.id || 'sin ID'}`);
          continue;
        }

        // Skip if VIN already exists
        if (existingVins.has(vehicle.vin)) {
          errors.push(`VIN ya existe: ${vehicle.vin}`);
          continue;
        }

        // Add new IDs and timestamps
        const newVehicle: StoredVehicle = {
          ...vehicle,
          id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        currentVehicles.push(newVehicle);
        existingVins.add(vehicle.vin);
        imported++;

      } catch (error) {
        errors.push(`Error importando vehículo ${vehicle.id || 'sin ID'}: ${error}`);
      }
    }

    if (imported > 0) {
      localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(currentVehicles));
    }

    return {
      success: imported > 0,
      imported,
      errors
    };

  } catch (error) {
    errors.push(`Error parsing data: ${error}`);
    return { success: false, imported: 0, errors };
  }
}

/**
 * Clear all vehicles data
 */
export function clearAllVehiclesData(): void {
  localStorage.removeItem(VEHICLES_STORAGE_KEY);
  console.log('All vehicles data cleared');
}

/**
 * Debug function to test localStorage (call from browser console)
 */
export function debugLocalStorage(): void {
  console.log('=== LocalStorage Debug ===');

  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      console.error('localStorage is not available');
      return;
    }

    // Check storage key
    const storedData = localStorage.getItem(VEHICLES_STORAGE_KEY);
    console.log('Storage key:', VEHICLES_STORAGE_KEY);
    console.log('Raw stored data:', storedData);

    if (!storedData) {
      console.log('No vehicles found in localStorage');
      return;
    }

    // Parse and check data
    const parsed = JSON.parse(storedData);
    console.log('Parsed data:', parsed);
    console.log('Number of vehicles:', parsed.length);

    if (parsed.length > 0) {
      console.log('First vehicle:', parsed[0]);
      console.log('Last vehicle:', parsed[parsed.length - 1]);
    }

    // Validate each vehicle
    const validVehicles = parsed.filter((vehicle: any) =>
      vehicle &&
      typeof vehicle === 'object' &&
      vehicle.id &&
      vehicle.vin &&
      vehicle.make &&
      vehicle.model &&
      vehicle.model_year
    );

    console.log('Valid vehicles:', validVehicles.length);
    console.log('Invalid vehicles:', parsed.length - validVehicles.length);

  } catch (error) {
    console.error('Error debugging localStorage:', error);
  }
}

/**
 * Make debug function available globally (call from browser console)
 */
if (typeof window !== 'undefined') {
  (window as any).debugVehicleStorage = debugLocalStorage;
}