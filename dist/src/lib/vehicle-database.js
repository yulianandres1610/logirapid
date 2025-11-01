"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveVehicleToDatabase = saveVehicleToDatabase;
exports.getAllVehiclesFromDatabase = getAllVehiclesFromDatabase;
exports.getVehicleByIdFromDatabase = getVehicleByIdFromDatabase;
exports.updateVehicleInDatabase = updateVehicleInDatabase;
exports.deleteVehicleFromDatabase = deleteVehicleFromDatabase;
exports.searchVehiclesInDatabase = searchVehiclesInDatabase;
exports.getVehicleStatisticsFromDatabase = getVehicleStatisticsFromDatabase;
exports.exportVehiclesDataFromDatabase = exportVehiclesDataFromDatabase;
exports.importVehiclesDataToDatabase = importVehiclesDataToDatabase;
exports.clearAllVehiclesDataFromDatabase = clearAllVehiclesDataFromDatabase;
const fs_1 = require("fs");
const path_1 = require("path");
// Database file path
const DB_FILE_PATH = (0, path_1.join)(process.cwd(), 'data', 'vehicles.json');
// Ensure data directory exists
function ensureDataDirectory() {
    const dataDir = (0, path_1.join)(process.cwd(), 'data');
    if (!(0, fs_1.existsSync)(dataDir)) {
        require('fs').mkdirSync(dataDir, { recursive: true });
    }
}
/**
 * Read all vehicles from database file
 */
function readVehiclesFromDatabase() {
    try {
        ensureDataDirectory();
        if (!(0, fs_1.existsSync)(DB_FILE_PATH)) {
            return [];
        }
        const data = (0, fs_1.readFileSync)(DB_FILE_PATH, 'utf-8');
        const vehicles = JSON.parse(data);
        return Array.isArray(vehicles) ? vehicles : [];
    }
    catch (error) {
        console.error('Error reading vehicles from database:', error);
        return [];
    }
}
/**
 * Write vehicles to database file
 */
function writeVehiclesToDatabase(vehicles) {
    try {
        ensureDataDirectory();
        (0, fs_1.writeFileSync)(DB_FILE_PATH, JSON.stringify(vehicles, null, 2));
    }
    catch (error) {
        console.error('Error writing vehicles to database:', error);
        throw new Error('Failed to save vehicles to database');
    }
}
/**
 * Generate unique ID for vehicle
 */
function generateVehicleId() {
    return `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Save a vehicle to database
 */
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
/**
 * Get all vehicles from database
 */
function getAllVehiclesFromDatabase() {
    return readVehiclesFromDatabase();
}
/**
 * Get a vehicle by ID from database
 */
function getVehicleByIdFromDatabase(id) {
    const vehicles = getAllVehiclesFromDatabase();
    return vehicles.find(v => v.id === id) || null;
}
/**
 * Update a vehicle in database
 */
function updateVehicleInDatabase(id, updates) {
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
function deleteVehicleFromDatabase(id) {
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
function searchVehiclesInDatabase(query) {
    const vehicles = getAllVehiclesFromDatabase();
    const searchQuery = query.toLowerCase().trim();
    if (!searchQuery) {
        return vehicles;
    }
    return vehicles.filter(vehicle => vehicle.nickname.toLowerCase().includes(searchQuery) ||
        vehicle.make.toLowerCase().includes(searchQuery) ||
        vehicle.model.toLowerCase().includes(searchQuery) ||
        vehicle.vin.toLowerCase().includes(searchQuery) ||
        vehicle.model_year.toString().includes(searchQuery));
}
/**
 * Get vehicle statistics
 */
function getVehicleStatisticsFromDatabase() {
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
    }, {});
    // Count by make
    const byMake = vehicles.reduce((acc, vehicle) => {
        const make = vehicle.make || 'unknown';
        acc[make] = (acc[make] || 0) + 1;
        return acc;
    }, {});
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
function exportVehiclesDataFromDatabase() {
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
function importVehiclesDataToDatabase(jsonData) {
    const errors = [];
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
                const newVehicle = {
                    ...vehicle,
                    id: generateVehicleId(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                currentVehicles.push(newVehicle);
                existingVins.add(vehicle.vin);
                imported++;
            }
            catch (error) {
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
    }
    catch (error) {
        errors.push(`Error parsing data: ${error}`);
        return { success: false, imported: 0, errors };
    }
}
/**
 * Clear all vehicles data
 */
function clearAllVehiclesDataFromDatabase() {
    ensureDataDirectory();
    writeVehiclesToDatabase([]);
    console.log('All vehicles data cleared from database');
}
