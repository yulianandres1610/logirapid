// Types for package management system (client-side)

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

// API functions for client-side
export async function getAllBoxes(): Promise<Box[]> {
  try {
    const response = await fetch('/api/packages?type=boxes');
    if (!response.ok) throw new Error('Failed to fetch boxes');
    return await response.json();
  } catch (error) {
    console.error('Error fetching boxes:', error);
    return [];
  }
}

export async function getCurrentPrices(): Promise<PackagePrice[]> {
  try {
    const response = await fetch('/api/packages?type=prices');
    if (!response.ok) throw new Error('Failed to fetch prices');
    return await response.json();
  } catch (error) {
    console.error('Error fetching prices:', error);
    return [];
  }
}

export async function getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    const response = await fetch('/api/packages?type=orders');
    if (!response.ok) throw new Error('Failed to fetch orders');
    return await response.json();
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function getAllShipments(): Promise<Shipment[]> {
  try {
    const response = await fetch('/api/packages?type=shipments');
    if (!response.ok) throw new Error('Failed to fetch shipments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching shipments:', error);
    return [];
  }
}

export async function createBox(boxData: Omit<Box, 'id' | 'barcode' | 'created_at' | 'updated_at'>): Promise<Box | null> {
  try {
    const response = await fetch('/api/packages?type=box', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(boxData),
    });

    if (!response.ok) throw new Error('Failed to create box');
    return await response.json();
  } catch (error) {
    console.error('Error creating box:', error);
    return null;
  }
}

export async function createPrice(priceData: Omit<PackagePrice, 'id' | 'final_price' | 'created_at' | 'updated_at'>): Promise<PackagePrice | null> {
  try {
    const response = await fetch('/api/packages?type=price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(priceData),
    });

    if (!response.ok) throw new Error('Failed to create price');
    return await response.json();
  } catch (error) {
    console.error('Error creating price:', error);
    return null;
  }
}

export async function createPurchaseOrder(orderData: Omit<PurchaseOrder, 'id' | 'order_number' | 'total_amount' | 'created_at' | 'updated_at'>): Promise<PurchaseOrder | null> {
  try {
    const response = await fetch('/api/packages?type=order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) throw new Error('Failed to create order');
    return await response.json();
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | null> {
  try {
    const response = await fetch(`/api/packages?type=order&id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update order');
    return await response.json();
  } catch (error) {
    console.error('Error updating order:', error);
    return null;
  }
}

export async function createShipment(shipmentData: Omit<Shipment, 'id' | 'created_at' | 'updated_at'>): Promise<Shipment | null> {
  try {
    const response = await fetch('/api/packages?type=shipment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    });

    if (!response.ok) throw new Error('Failed to create shipment');
    return await response.json();
  } catch (error) {
    console.error('Error creating shipment:', error);
    return null;
  }
}

export async function updateBox(id: string, updates: Partial<Box>): Promise<Box | null> {
  try {
    const response = await fetch(`/api/packages?type=box&id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed to update box');
    return await response.json();
  } catch (error) {
    console.error('Error updating box:', error);
    return null;
  }
}

export async function receivePurchaseOrder(orderId: string, generatedBoxes: Box[] = []): Promise<{ order: PurchaseOrder; created_boxes: Box[]; message: string } | null> {
  try {
    const response = await fetch('/api/packages?type=receive-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        generated_boxes: generatedBoxes
      }),
    });

    if (!response.ok) throw new Error('Failed to receive order');
    return await response.json();
  } catch (error) {
    console.error('Error receiving order:', error);
    return null;
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