// Tipos para la API de Auto.dev - VIN Decode
export interface VinDecodeResponse {
  vin: string;
  make: string;
  model: string;
  model_year: number;
  body_type: string;
  color: string;
  drivetrain: string;
  engine: string;
  transmission: string;
  fuel_type: string;
  doors: number;
  cylinders: number;
  displacement: number;
  msrp?: number;
  manufacturer?: string;
  plant?: string;
  series?: string;
  trim?: string;
  vehicle_type?: string;
  gvwr?: string; // Gross Vehicle Weight Rating
  photo_urls?: string[]; // URLs de fotos del vehículo
}

// Tipos para la API de Auto.dev - Vehicle Photos
export interface VehiclePhotosResponse {
  photo_urls: VehiclePhoto[];
}

export interface VehiclePhoto {
  url: string;
  shot_type: string; // exterior, interior, etc.
  angle?: string;    // front, rear, side, etc.
  size?: string;     // small, medium, large
}

// Tipos para nuestro sistema de vehículos
export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  body_type: string;
  color: string;
  photo_url?: string;
  capacity: {
    weight_lbs: number;    // Capacidad en libras
    weight_kg: number;     // Capacidad en kilogramos
    volume_cubic_ft: number; // Volumen en pies cúbicos
    volume_cubic_m: number;  // Volumen en metros cúbicos
  };
  status: VehicleStatus;
  current_route_id?: string;
  availability: VehicleAvailability;
  created_at: string;
  updated_at: string;
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
  IN_TRANSIT = 'IN_TRANSIT'
}

export enum VehicleAvailability {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  UNAVAILABLE = 'UNAVAILABLE'
}

// Tipos para el formulario de registro
export interface VehicleRegistrationForm {
  vin: string;
  capacity_weight_lbs: number;
  capacity_weight_kg: number;
  capacity_volume_cubic_ft: number;
  capacity_volume_cubic_m: number;
}

export interface VehicleFormData extends VehicleRegistrationForm {
  vin_data: VinDecodeResponse;
  photo_url?: string;
}

// Tipos para la vista de vehículos
export interface VehicleCardProps {
  vehicle: Vehicle;
  onAssignRoute?: (vehicleId: string) => void;
  onViewDetails?: (vehicleId: string) => void;
  onEdit?: (vehicleId: string) => void;
  onToggleStatus?: (vehicleId: string) => void;
}

// Tipos para la gestión de rutas
export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  estimated_duration: number;
  vehicle_id?: string;
  status: RouteStatus;
  packages: RoutePackage[];
  created_at: string;
}

export enum RouteStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface RoutePackage {
  id: string;
  weight: number;
  volume: number;
  delivery_address: string;
  recipient_name: string;
  status: PackageStatus;
}

export enum PackageStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

// Tipos de respuesta de la API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}