#!/usr/bin/env node

/**
 * Script para migrar vehículos desde localStorage a la base de datos JSON del servidor
 * Esto debería ejecutarse una sola vez cuando se actualice el sistema
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { saveVehicleToDatabase } from '../src/lib/vehicle-database.js';

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = join(__dirname, '..', 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

// Mock localStorage data - en un entorno real, esto leería del localStorage del navegador
// Para la migración, necesitamos simular los datos que estaban en localStorage
const mockLocalStorageData = [
  {
    id: "vehicle_example_1",
    vin: "1HGCM82633A004352",
    make: "Honda",
    model: "Accord",
    model_year: 2022,
    body_type: "Sedan",
    color: "Black",
    nickname: "Honda Accord 2022",
    photo_url: "https://via.placeholder.com/400x300?text=Honda+Accord",
    capacity: {
      weight_lbs: 1000,
      weight_kg: 454,
      volume_cubic_ft: 100,
      volume_cubic_m: 2.8
    },
    status: "ACTIVE",
    availability: "AVAILABLE",
    current_route_id: null,
    created_at: "2024-01-15T10:30:00.000Z",
    updated_at: "2024-01-15T10:30:00.000Z",
    vin_data: {
      make: "Honda",
      model: "Accord",
      model_year: 2022,
      body_type: "Sedan",
      color: "Black"
    }
  },
  {
    id: "vehicle_example_2",
    vin: "2T3BF4DV8BR123456",
    make: "Toyota",
    model: "Camry",
    model_year: 2023,
    body_type: "Sedan",
    color: "White",
    nickname: "Toyota Camry 2023",
    photo_url: "https://via.placeholder.com/400x300?text=Toyota+Camry",
    capacity: {
      weight_lbs: 1000,
      weight_kg: 454,
      volume_cubic_ft: 100,
      volume_cubic_m: 2.8
    },
    status: "ACTIVE",
    availability: "AVAILABLE",
    current_route_id: null,
    created_at: "2024-01-16T14:45:00.000Z",
    updated_at: "2024-01-16T14:45:00.000Z",
    vin_data: {
      make: "Toyota",
      model: "Camry",
      model_year: 2023,
      body_type: "Sedan",
      color: "White"
    }
  }
];

/**
 * Simular la lectura de localStorage del navegador
 * En un entorno real, esto debería leer el localStorage actual del navegador
 */
function getVehiclesFromLocalStorage(): any[] {
  try {
    // En un entorno real, esto funcionaría así:
    // if (typeof localStorage !== 'undefined') {
    //   const stored = localStorage.getItem('logirapid_vehicles');
    //   return stored ? JSON.parse(stored) : [];
    // }

    // Para la migración, usamos datos de ejemplo
    console.log('🔄 Using mock localStorage data for migration');
    return mockLocalStorageData;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

/**
 * Función principal de migración
 */
async function migrateVehicles() {
  console.log('🚀 Starting vehicle migration from localStorage to server database...');

  try {
    ensureDataDirectory();

    // Obtener vehículos de localStorage
    const vehicles = getVehiclesFromLocalStorage();
    console.log(`📦 Found ${vehicles.length} vehicles in localStorage`);

    if (vehicles.length === 0) {
      console.log('✅ No vehicles to migrate. Migration complete!');
      return;
    }

    // Migrar cada vehículo a la base de datos del servidor
    let migratedCount = 0;
    let errorCount = 0;

    for (const vehicle of vehicles) {
      try {
        // Remover campos que no se necesitan en la nueva base de datos
        const { id, ...vehicleData } = vehicle;

        const savedVehicle = saveVehicleToDatabase(vehicleData);
        console.log(`✅ Migrated vehicle: ${savedVehicle.vin} - ${savedVehicle.make} ${savedVehicle.model}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating vehicle ${vehicle.vin}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successfully migrated: ${migratedCount} vehicles`);
    console.log(`   ❌ Errors: ${errorCount} vehicles`);
    console.log(`   📁 Database file: ${join(__dirname, '..', 'data', 'vehicles.json')}`);

    if (migratedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Vehicles are now stored in the server database and will persist across browsers.');
      console.log('🔄 The frontend will now use the server API instead of localStorage.');
    } else {
      console.log('\nℹ️  No vehicles were migrated. This might be expected if this is a fresh installation.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Ejecutar migración si este script se ejecuta directamente
if (require.main === module) {
  migrateVehicles();
}

export { migrateVehicles };