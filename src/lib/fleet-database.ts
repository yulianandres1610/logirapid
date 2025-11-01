import fs from 'fs';
import path from 'path';

const FLEET_DB_PATH = path.join(process.cwd(), 'data', 'fleet.json');

// Types
export interface Vehicle {
  id: string;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  body_type: string;
  color: string;
  nickname: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'IN_TRANSIT';
  capacity: {
    weight_kg: number;
    volume_m3: number;
    empty_boxes: number;
    full_boxes: number;
  };
  driver_id?: string;
  current_route_id?: string;
  photos: string[];
  insurance_documents: string[];
  can_collect_durable: boolean;
  registration_date: string;
  last_updated: string;
  created_at: string;
  updated_at: string;
  // Nuevos campos de mantenimiento
  mileage?: number;
  insurance_expiry?: string;
  oil_change_frequency?: number;
  next_oil_change?: string;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_type: string;
  status: 'ACTIVE' | 'INACTIVE';
  current_vehicle_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  estimated_time_hours: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  vehicle_id?: string;
  driver_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  route_id: string;
  start_date: string;
  end_date?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

// Database operations
function readFleetDatabase() {
  try {
    const data = fs.readFileSync(FLEET_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading fleet database:', error);
    return { vehicles: [], drivers: [], routes: [], assignments: [] };
  }
}

function writeFleetDatabase(data: any) {
  try {
    fs.writeFileSync(FLEET_DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing fleet database:', error);
    return false;
  }
}

// Vehicle operations
export function createVehicle(vehicleData: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Vehicle | null {
  try {
    const db = readFleetDatabase();
    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Asegurar que los nuevos campos tengan valores por defecto si no se proporcionan
      mileage: vehicleData.mileage || 0,
      insurance_expiry: vehicleData.insurance_expiry || null,
      oil_change_frequency: vehicleData.oil_change_frequency || 5000,
      next_oil_change: vehicleData.next_oil_change || null
    };

    db.vehicles.push(newVehicle);
    writeFleetDatabase(db);
    return newVehicle;
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return null;
  }
}

export function getAllVehicles(): Vehicle[] {
  try {
    const db = readFleetDatabase();
    return db.vehicles.sort((a: Vehicle, b: Vehicle) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Error getting vehicles:', error);
    return [];
  }
}

export function getVehicleById(id: string): Vehicle | null {
  try {
    const db = readFleetDatabase();
    return db.vehicles.find((v: Vehicle) => v.id === id) || null;
  } catch (error) {
    console.error('Error getting vehicle by ID:', error);
    return null;
  }
}

export function updateVehicle(id: string, updates: Partial<Vehicle>): Vehicle | null {
  try {
    const db = readFleetDatabase();
    const vehicleIndex = db.vehicles.findIndex((v: Vehicle) => v.id === id);

    if (vehicleIndex === -1) return null;

    db.vehicles[vehicleIndex] = {
      ...db.vehicles[vehicleIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    writeFleetDatabase(db);
    return db.vehicles[vehicleIndex];
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return null;
  }
}

export function deleteVehicle(id: string): boolean {
  try {
    const db = readFleetDatabase();
    const initialLength = db.vehicles.length;
    db.vehicles = db.vehicles.filter((v: Vehicle) => v.id !== id);

    if (db.vehicles.length < initialLength) {
      writeFleetDatabase(db);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return false;
  }
}

export function getVehiclesByStatus(status?: string, availability?: string): Vehicle[] {
  try {
    const vehicles = getAllVehicles();

    return vehicles.filter(vehicle => {
      if (status && status !== 'all' && vehicle.status !== status) return false;
      if (availability && availability !== 'all' && vehicle.availability !== availability) return false;
      return true;
    });
  } catch (error) {
    console.error('Error getting vehicles by status:', error);
    return [];
  }
}

export function searchVehicles(query: string): Vehicle[] {
  try {
    const vehicles = getAllVehicles();
    const searchLower = query.toLowerCase();

    return vehicles.filter(vehicle =>
      vehicle.vin.toLowerCase().includes(searchLower) ||
      vehicle.license_plate.toLowerCase().includes(searchLower) ||
      vehicle.make.toLowerCase().includes(searchLower) ||
      vehicle.model.toLowerCase().includes(searchLower) ||
      vehicle.nickname.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching vehicles:', error);
    return [];
  }
}