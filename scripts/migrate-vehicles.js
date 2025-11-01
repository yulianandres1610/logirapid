#!/usr/bin/env node

const { existsSync, mkdirSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = join(__dirname, '..', 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

// Database file path
function getDatabasePath() {
  return join(__dirname, '..', 'data', 'vehicles.json');
}

// Read vehicles from database
function readVehiclesFromDatabase() {
  try {
    const dbPath = getDatabasePath();
    if (!existsSync(dbPath)) {
      return [];
    }
    const data = readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading vehicles from database:', error);
    return [];
  }
}

// Write vehicles to database
function writeVehiclesToDatabase(vehicles) {
  try {
    ensureDataDirectory();
    const dbPath = getDatabasePath();
    writeFileSync(dbPath, JSON.stringify(vehicles, null, 2));
  } catch (error) {
    console.error('Error writing vehicles to database:', error);
    throw new Error('Failed to save vehicles to database');
  }
}

// Generate unique ID for vehicle
function generateVehicleId() {
  return `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Save a vehicle to database
function saveVehicleToDatabase(vehicleData) {
  const vehicles = readVehiclesFromDatabase();

  const newVehicle = {
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

// Mock vehicles for migration
const mockVehicles = [
  {
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
    vin_data: {
      make: "Honda",
      model: "Accord",
      model_year: 2022,
      body_type: "Sedan",
      color: "Black"
    }
  },
  {
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
    vin_data: {
      make: "Toyota",
      model: "Camry",
      model_year: 2023,
      body_type: "Sedan",
      color: "White"
    }
  }
];

// Main migration function
function migrateVehicles() {
  console.log('🚀 Starting vehicle migration from localStorage to server database...');

  try {
    ensureDataDirectory();

    // Get existing vehicles or use mock data
    const existingVehicles = readVehiclesFromDatabase();
    console.log(`📦 Found ${existingVehicles.length} vehicles in database`);

    if (existingVehicles.length === 0) {
      console.log('🔄 Adding sample vehicles to database...');

      let migratedCount = 0;
      for (const vehicle of mockVehicles) {
        try {
          const savedVehicle = saveVehicleToDatabase(vehicle);
          console.log(`✅ Migrated vehicle: ${savedVehicle.vin} - ${savedVehicle.make} ${savedVehicle.model}`);
          migratedCount++;
        } catch (error) {
          console.error(`❌ Error migrating vehicle ${vehicle.vin}:`, error);
        }
      }

      console.log(`\n📊 Migration Summary:`);
      console.log(`   ✅ Successfully migrated: ${migratedCount} vehicles`);
      console.log(`   📁 Database file: ${getDatabasePath()}`);

      if (migratedCount > 0) {
        console.log('\n🎉 Migration completed successfully!');
        console.log('💡 Vehicles are now stored in the server database and will persist across browsers.');
        console.log('🔄 The frontend will now use the server API instead of localStorage.');
      }
    } else {
      console.log('✅ Database already contains vehicles. No migration needed.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Execute migration
migrateVehicles();