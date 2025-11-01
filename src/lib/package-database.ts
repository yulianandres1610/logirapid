import fs from 'fs';
import path from 'path';

const PACKAGE_DB_PATH = path.join(process.cwd(), 'data', 'packages.json');

// Types
export interface Box {
  id: string;
  barcode: string;
  size: string; // pequeño, mediano, grande, extra grande
  dimensions: {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
    weight_capacity: number; // kg
  };
  cost: number; // costo unitario
  supplier: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DAMAGED' | 'DISPOSED';
  current_location?: string;
  current_route_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PackagePrice {
  id: string;
  size: string;
  base_price: number;
  supplier_margin: number;
  final_price: number;
  supplier: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier: string;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  items: {
    size: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
  total_amount: number;
  order_date: string;
  expected_delivery: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  boxes: string[]; // Array de box IDs
  origin: string;
  destination: string;
  status: 'PREPARING' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';
  route_id?: string;
  driver_id?: string;
  departure_time?: string;
  arrival_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Database operations
function readPackageDatabase() {
  try {
    const data = fs.readFileSync(PACKAGE_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading package database:', error);
    return {
      boxes: [],
      prices: [],
      orders: [],
      shipments: []
    };
  }
}

function writePackageDatabase(data: any) {
  try {
    fs.writeFileSync(PACKAGE_DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing package database:', error);
    return false;
  }
}

// Box operations
export function createBox(boxData: Omit<Box, 'id' | 'barcode' | 'created_at' | 'updated_at'>): Box | null {
  try {
    const db = readPackageDatabase();
    const barcode = `PKG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const newBox: Box = {
      ...boxData,
      id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      barcode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.boxes.push(newBox);
    writePackageDatabase(db);
    return newBox;
  } catch (error) {
    console.error('Error creating box:', error);
    return null;
  }
}

export function getAllBoxes(): Box[] {
  try {
    const db = readPackageDatabase();
    return db.boxes.sort((a: Box, b: Box) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Error getting boxes:', error);
    return [];
  }
}

export function getBoxById(id: string): Box | null {
  try {
    const db = readPackageDatabase();
    return db.boxes.find((b: Box) => b.id === id) || null;
  } catch (error) {
    console.error('Error getting box by ID:', error);
    return null;
  }
}

export function getBoxByBarcode(barcode: string): Box | null {
  try {
    const db = readPackageDatabase();
    return db.boxes.find((b: Box) => b.barcode === barcode) || null;
  } catch (error) {
    console.error('Error getting box by barcode:', error);
    return null;
  }
}

export function updateBox(id: string, updates: Partial<Box>): Box | null {
  try {
    const db = readPackageDatabase();
    const boxIndex = db.boxes.findIndex((b: Box) => b.id === id);

    if (boxIndex === -1) return null;

    db.boxes[boxIndex] = {
      ...db.boxes[boxIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    writePackageDatabase(db);
    return db.boxes[boxIndex];
  } catch (error) {
    console.error('Error updating box:', error);
    return null;
  }
}

// Price operations
export function createPrice(priceData: Omit<PackagePrice, 'id' | 'final_price' | 'created_at' | 'updated_at'>): PackagePrice | null {
  try {
    const db = readPackageDatabase();
    const final_price = priceData.base_price + priceData.supplier_margin;
    const newPrice: PackagePrice = {
      ...priceData,
      id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      final_price,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.prices.push(newPrice);
    writePackageDatabase(db);
    return newPrice;
  } catch (error) {
    console.error('Error creating price:', error);
    return null;
  }
}

export function getCurrentPrices(): PackagePrice[] {
  try {
    const db = readPackageDatabase();
    return db.prices.sort((a: PackagePrice, b: PackagePrice) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Error getting prices:', error);
    return [];
  }
}

export function getPriceBySize(size: string): PackagePrice | null {
  try {
    const db = readPackageDatabase();
    const prices = db.prices.filter((p: PackagePrice) => p.size === size);
    return prices.length > 0 ? prices[0] : null;
  } catch (error) {
    console.error('Error getting price by size:', error);
    return null;
  }
}

// Purchase Order operations
export function createPurchaseOrder(orderData: Omit<PurchaseOrder, 'id' | 'order_number' | 'total_amount' | 'created_at' | 'updated_at'>): PurchaseOrder | null {
  try {
    const db = readPackageDatabase();
    const order_number = `PO${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const total_amount = orderData.items.reduce((sum, item) => sum + item.total_price, 0);

    const newOrder: PurchaseOrder = {
      ...orderData,
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order_number,
      total_amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.orders.push(newOrder);
    writePackageDatabase(db);
    return newOrder;
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return null;
  }
}

export function getAllPurchaseOrders(): PurchaseOrder[] {
  try {
    const db = readPackageDatabase();
    return db.orders.sort((a: PurchaseOrder, b: PurchaseOrder) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    return [];
  }
}

// Shipment operations
export function createShipment(shipmentData: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>): Shipment | null {
  try {
    const db = readPackageDatabase();
    const newShipment: Shipment = {
      ...shipmentData,
      id: `shipment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.shipments.push(newShipment);
    writePackageDatabase(db);
    return newShipment;
  } catch (error) {
    console.error('Error creating shipment:', error);
    return null;
  }
}

export function getAllShipments(): Shipment[] {
  try {
    const db = readPackageDatabase();
    return db.shipments.sort((a: Shipment, b: Shipment) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Error getting shipments:', error);
    return [];
  }
}

// Helper functions
export function generateBarcode(): string {
  return `PKG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

export function calculateBoxSize(size: string): { length: number; width: number; height: number; weight_capacity: number } {
  const sizes = {
    'pequeño': { length: 30, width: 20, height: 15, weight_capacity: 5 },
    'mediano': { length: 40, width: 30, height: 20, weight_capacity: 10 },
    'grande': { length: 50, width: 40, height: 30, weight_capacity: 20 },
    'extra grande': { length: 60, width: 50, height: 40, weight_capacity: 30 }
  };
  return sizes[size as keyof typeof sizes] || sizes.mediano;
}