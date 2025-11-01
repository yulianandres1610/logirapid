import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Vehicle, VehicleStatus, VehicleAvailability } from '@/types/vehicle';

interface StoredVehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  model_year: number;
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
  vin_data?: any;
}

// Database file path
const DB_FILE_PATH = join(process.cwd(), 'data', 'vehicles.json');

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    require('fs').mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Read all vehicles from database file
 */
function readVehiclesFromDatabase(): StoredVehicle[] {
  try {
    ensureDataDirectory();

    if (!existsSync(DB_FILE_PATH)) {
      return [];
    }

    const data = readFileSync(DB_FILE_PATH, 'utf-8');
    const vehicles = JSON.parse(data);

    return Array.isArray(vehicles) ? vehicles : [];
  } catch (error) {
    console.error('Error reading vehicles from database:', error);
    return [];
  }
}

/**
 * Write vehicles to database file
 */
function writeVehiclesToDatabase(vehicles: StoredVehicle[]): void {
  try {
    ensureDataDirectory();
    writeFileSync(DB_FILE_PATH, JSON.stringify(vehicles, null, 2));
  } catch (error) {
    console.error('Error writing vehicles to database:', error);
    throw new Error('Failed to save vehicles to database');
  }
}

/**
 * Generate unique ID for vehicle
 */
function generateVehicleId(): string {
  return `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save a vehicle to database
 */
export function saveVehicleToDatabase(vehicleData: Omit<StoredVehicle, 'id' | 'created_at' | 'updated_at'>): StoredVehicle {
  const vehicles = readVehiclesFromDatabase();

  const newVehicle: StoredVehicle = {
    ...vehicleData,
    id: generateVehicleId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  vehicles.push(newVehicle);
  writeVehiclesToDatabase(vehicles);

  console.log('Vehicle saved to database:', newVehicle.id);
  return newVehicle;
}

/**
 * Get all vehicles from database
 */
export function getAllVehiclesFromDatabase(): StoredVehicle[] {
  return readVehiclesFromDatabase();
}

/**
 * Get a vehicle by ID from database
 */
export function getVehicleByIdFromDatabase(id: string): StoredVehicle | null {
  const vehicles = getAllVehiclesFromDatabase();
  return vehicles.find(v => v.id === id) || null;
}

/**
 * Update a vehicle in database
 */
export function updateVehicleInDatabase(id: string, updates: Partial<StoredVehicle>): StoredVehicle | null {
  const vehicles = getAllVehiclesFromDatabase();
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
  writeVehiclesToDatabase(vehicles);

  console.log('Vehicle updated in database:', id);
  return updatedVehicle;
}

/**
 * Delete a vehicle from database
 */
export function deleteVehicleFromDatabase(id: string): boolean {
  const vehicles = getAllVehiclesFromDatabase();
  const filteredVehicles = vehicles.filter(v => v.id !== id);

  if (filteredVehicles.length === vehicles.length) {
    console.warn('Vehicle not found for deletion:', id);
    return false;
  }

  writeVehiclesToDatabase(filteredVehicles);
  console.log('Vehicle deleted from database:', id);
  return true;
}

/**
 * Search vehicles by query
 */
export function searchVehiclesInDatabase(query: string): StoredVehicle[] {
  const vehicles = getAllVehiclesFromDatabase();
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
export function getVehicleStatisticsFromDatabase() {
  const vehicles = getAllVehiclesFromDatabase();

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
export function exportVehiclesDataFromDatabase(): string {
  const vehicles = getAllVehiclesFromDatabase();
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    vehicles: vehicles,
    statistics: getVehicleStatisticsFromDatabase(),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import vehicles data (for restore)
 */
export function importVehiclesDataToDatabase(jsonData: string): { success: boolean; imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(jsonData);

    if (!data.vehicles || !Array.isArray(data.vehicles)) {
      errors.push('Invalid data format');
      return { success: false, imported: 0, errors };
    }

    const currentVehicles = getAllVehiclesFromDatabase();
    const existingVins = new Set(currentVehicles.map(v => v.vin));

    for (const vehicle of data.vehicles) {
      try {
        // Validate required fields
        if (!vehicle.vin || !vehicle.nickname) {
          errors.push(`Invalid vehicle: ${vehicle.id || 'no ID'}`);
          continue;
        }

        // Skip if VIN already exists
        if (existingVins.has(vehicle.vin)) {
          errors.push(`VIN already exists: ${vehicle.vin}`);
          continue;
        }

        // Add new IDs and timestamps
        const newVehicle: StoredVehicle = {
          ...vehicle,
          id: generateVehicleId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        currentVehicles.push(newVehicle);
        existingVins.add(vehicle.vin);
        imported++;

      } catch (error) {
        errors.push(`Error importing vehicle ${vehicle.id || 'no ID'}: ${error}`);
      }
    }

    if (imported > 0) {
      writeVehiclesToDatabase(currentVehicles);
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
export function clearAllVehiclesDataFromDatabase(): void {
  ensureDataDirectory();
  writeVehiclesToDatabase([]);
  console.log('All vehicles data cleared from database');
}