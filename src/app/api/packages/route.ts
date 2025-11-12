import { NextRequest, NextResponse } from 'next/server';
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
  purchase_order_id?: string;
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
  status: 'BORRADOR' | 'SOLICITUD_PRESUPUESTO' | 'COMPRADA' | 'RECIBIDA' | 'CANCELLED';
  items: {
    size: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
  total_amount: number;
  order_date: string;
  expected_delivery?: string;
  budget_request_date?: string;
  purchase_date?: string;
  received_date?: string;
  notes?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  supplier_email?: string;
  payment_method?: string;
  payment_terms?: string;
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

// API Routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const searchTerm = searchParams.get('search');
    const warehouseFilter = searchParams.get('warehouse');
    const sizeFilter = searchParams.get('size');

    const db = readPackageDatabase();

    switch (type) {
      case 'boxes': {
        let boxes = db.boxes.sort((a: Box, b: Box) =>
          new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
        );

        // Apply search filter
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          boxes = boxes.filter((box: Box) =>
            box.barcode?.toLowerCase().includes(searchLower) ||
            box.size?.toLowerCase().includes(searchLower) ||
            box.supplier?.toLowerCase().includes(searchLower)
          );
        }

        // Apply warehouse filter
        if (warehouseFilter) {
          boxes = boxes.filter((box: Box) => {
            // Compare with currentlocation - could be warehouse name, city, or ID
            return box.currentlocation?.includes(warehouseFilter) ||
                   box.currentlocation === `Almacén ID: ${warehouseFilter}`;
          });
        }

        // Apply size filter
        if (sizeFilter) {
          boxes = boxes.filter((box: Box) => box.size === sizeFilter);
        }

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBoxes = boxes.slice(startIndex, endIndex);

        // Convert to format expected by frontend
        const formattedBoxes = paginatedBoxes.map((box: Box) => ({
          ...box,
          hasBarcode: !!box.barcode,
          qrCode: box.barcode || ''
        }));

        return NextResponse.json({
          boxes: formattedBoxes,
          page,
          limit,
          total: boxes.length,
          totalPages: Math.ceil(boxes.length / limit)
        });
      }
      case 'prices':
        return NextResponse.json(db.prices.sort((a: PackagePrice, b: PackagePrice) =>
          new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
        ));
      case 'orders':
        return NextResponse.json(db.orders.sort((a: PurchaseOrder, b: PurchaseOrder) =>
          new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
        ));
      case 'shipments':
        return NextResponse.json(db.shipments.sort((a: Shipment, b: Shipment) =>
          new Date(b.createdat).getTime() - new Date(a.createdat).getTime()
        ));
      default:
        return NextResponse.json(db);
    }
  } catch (error) {
    console.error('Error in GET /api/packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const body = await request.json();

    const db = readPackageDatabase();

    switch (type) {
      case 'boxes': {
        // Creación masiva de cajas
        const { boxes: newBoxes, batch } = body;

        console.log('API DEBUG: First box current_location:', newBoxes?.[0]?.currentlocation);
        console.log('API DEBUG: Warehouses count:', newBoxes?.length);

        if (!newBoxes || !Array.isArray(newBoxes)) {
          return NextResponse.json(
            { error: 'boxes array is required' },
            { status: 400 }
          );
        }

        const createdBoxes: Box[] = [];

        for (const newBox of newBoxes) {
          console.log('Procesando caja:', newBox); // Debug
          const dimensions = calculateBoxSize(newBox.size);
          const box: Box = {
            id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            barcode: newBox.barcode,
            size: newBox.size,
            dimensions,
            cost: newBox.cost,
            supplier: newBox.supplier,
            status: 'AVAILABLE',
            current_location: newBox.currentlocation, // Agregar ubicación del almacén
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          console.log('Caja creada:', box); // Debug
          db.boxes.push(box);
          createdBoxes.push(box);
        }

        writePackageDatabase(db);
        return NextResponse.json({
          success: true,
          created_boxes: createdBoxes,
          message: `${createdBoxes.length} cajas creadas exitosamente`
        });
      }
      case 'box': {
        const barcode = `PKG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const newBox: Box = {
          ...body,
          id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          barcode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.boxes.push(newBox);
        writePackageDatabase(db);
        return NextResponse.json(newBox);
      }
      case 'price': {
        const final_price = body.base_price + body.supplier_margin;
        const newPrice: PackagePrice = {
          ...body,
          id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          final_price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.prices.push(newPrice);
        writePackageDatabase(db);
        return NextResponse.json(newPrice);
      }
      case 'order': {
        const ordernumber = `PO${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const totalamount = body.items.reduce((sum: number, item: any) => sum + item.total_price, 0);

        const newOrder: PurchaseOrder = {
          ...body,
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ordernumber,
          totalamount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.orders.push(newOrder);
        writePackageDatabase(db);
        return NextResponse.json(newOrder);
      }
      case 'shipment': {
        const newShipment: Shipment = {
          ...body,
          id: `shipment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Update box status to IN_USE when boxes are assigned to shipment
        if (newShipment.boxes && newShipment.boxes.length > 0) {
          newShipment.boxes.forEach((boxId: string) => {
            const boxIndex = db.boxes.findIndex((b: Box) => b.id === boxId);
            if (boxIndex !== -1 && db.boxes[boxIndex].status === 'AVAILABLE') {
              db.boxes[boxIndex].status = 'IN_USE';
              db.boxes[boxIndex].current_route_id = newShipment.routeid;
              db.boxes[boxIndex].updatedat = new Date().toISOString();
            }
          });
        }

        db.shipments.push(newShipment);
        writePackageDatabase(db);
        return NextResponse.json(newShipment);
      }
      case 'receive-order': {
        const { order_id, generated_boxes = [] } = body;

        // Find the order
        const orderIndex = db.orders.findIndex((o: PurchaseOrder) => o.id === order_id);
        if (orderIndex === -1) {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }

        const order = db.orders[orderIndex];
        if (order.status !== 'COMPRADA') {
          return NextResponse.json(
            { error: 'Order must be in COMPRADA status to be received' },
            { status: 400 }
          );
        }

        // Create boxes for each item in the order
        const createdBoxes: Box[] = [];

        // Add generated boxes (those with barcodes)
        generated_boxes.forEach((box: Box) => {
          db.boxes.push(box);
          createdBoxes.push(box);
        });

        // Create remaining boxes without barcodes (stock)
        order.items.forEach((item: any) => {
          // Count how many boxes with barcodes already exist for this item
          const existingBarcodeBoxes = generated_boxes.filter((box: Box) =>
            box.size === item.size && box.purchase_order_id === order_id
          ).length;

          // Create the remaining quantity without barcodes
          const remainingQuantity = item.quantity - existingBarcodeBoxes;

          for (let i = 0; i < remainingQuantity; i++) {
            const dimensions = calculateBoxSize(item.size);
            const newBox: Box = {
              id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              barcode: '', // Empty barcode for stock
              size: item.size,
              dimensions,
              cost: item.unit_price,
              supplier: order.supplier,
              status: 'AVAILABLE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              purchase_order_id: order_id
            };
            db.boxes.push(newBox);
            createdBoxes.push(newBox);
          }
        });

        // Update order status
        db.orders[orderIndex] = {
          ...order,
          status: 'RECEIVED',
          updated_at: new Date().toISOString()
        };

        writePackageDatabase(db);
        return NextResponse.json({
          order: db.orders[orderIndex],
          created_boxes: createdBoxes,
          message: `Order ${order.ordernumber} received. ${createdBoxes.length} boxes added to inventory.`
        });
      }
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in POST /api/packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      );
    }

    const db = readPackageDatabase();

    switch (type) {
      case 'box': {
        const boxIndex = db.boxes.findIndex((b: Box) => b.id === id);
        if (boxIndex === -1) {
          return NextResponse.json(
            { error: 'Box not found' },
            { status: 404 }
          );
        }

        db.boxes[boxIndex] = {
          ...db.boxes[boxIndex],
          ...body,
          updated_at: new Date().toISOString()
        };

        writePackageDatabase(db);
        return NextResponse.json(db.boxes[boxIndex]);
      }
      case 'price': {
        const priceIndex = db.prices.findIndex((p: PackagePrice) => p.id === id);
        if (priceIndex === -1) {
          return NextResponse.json(
            { error: 'Price not found' },
            { status: 404 }
          );
        }

        db.prices[priceIndex] = {
          ...db.prices[priceIndex],
          ...body,
          updated_at: new Date().toISOString()
        };

        writePackageDatabase(db);
        return NextResponse.json(db.prices[priceIndex]);
      }
      case 'order': {
        const orderIndex = db.orders.findIndex((o: PurchaseOrder) => o.id === id);
        if (orderIndex === -1) {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }

        db.orders[orderIndex] = {
          ...db.orders[orderIndex],
          ...body,
          updated_at: new Date().toISOString()
        };

        writePackageDatabase(db);
        return NextResponse.json(db.orders[orderIndex]);
      }
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in PUT /api/packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      );
    }

    const db = readPackageDatabase();

    switch (type) {
      case 'box': {
        const boxIndex = db.boxes.findIndex((b: Box) => b.id === id);
        if (boxIndex === -1) {
          return NextResponse.json(
            { error: 'Box not found' },
            { status: 404 }
          );
        }

        db.boxes.splice(boxIndex, 1);
        writePackageDatabase(db);
        return NextResponse.json({ success: true });
      }
      case 'price': {
        const priceIndex = db.prices.findIndex((p: PackagePrice) => p.id === id);
        if (priceIndex === -1) {
          return NextResponse.json(
            { error: 'Price not found' },
            { status: 404 }
          );
        }

        db.prices.splice(priceIndex, 1);
        writePackageDatabase(db);
        return NextResponse.json({ success: true });
      }
      case 'order': {
        const orderIndex = db.orders.findIndex((o: PurchaseOrder) => o.id === id);
        if (orderIndex === -1) {
          return NextResponse.json(
            { error: 'Order not found' },
            { status: 404 }
          );
        }

        db.orders.splice(orderIndex, 1);
        writePackageDatabase(db);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in DELETE /api/packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate box dimensions based on size
function calculateBoxSize(size: string): { length: number; width: number; height: number; weight_capacity: number } {
  const sizes = {
    'pequeño': { length: 30, width: 20, height: 15, weight_capacity: 5 },
    'mediano': { length: 40, width: 30, height: 20, weight_capacity: 10 },
    'grande': { length: 50, width: 40, height: 30, weight_capacity: 20 },
    'extra grande': { length: 60, width: 50, height: 40, weight_capacity: 30 }
  };
  return sizes[size as keyof typeof sizes] || sizes.mediano;
}