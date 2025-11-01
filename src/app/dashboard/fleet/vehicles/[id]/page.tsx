'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Car,
  ArrowLeft,
  Edit,
  Trash2,
  Wrench,
  Power,
  Calendar,
  Package,
  FileText,
  Camera,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Vehicle {
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
  registration_date: string;
  created_at: string;
  updated_at: string;
}

export default function VehicleDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const vehicleId = params.id as string;

  useEffect(() => {
    if (vehicleId) {
      fetchVehicle();
    }
  }, [vehicleId]);

  const fetchVehicle = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fleet/vehicles/${vehicleId}`);
      const result = await response.json();

      if (result.success) {
        setVehicle(result.data);
      } else {
        setError(result.error || 'Error loading vehicle');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error fetching vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateVehicleStatus = async (newStatus: string, newAvailability?: string) => {
    if (!vehicle) return;

    setActionLoading(newStatus);
    try {
      const response = await fetch(`/api/fleet/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          availability: newAvailability || vehicle.availability
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVehicle(result.data);
      } else {
        setError(result.error || 'Error updating vehicle');
      }
    } catch (err) {
      setError('Error de conexión al actualizar el vehículo');
      console.error('Error updating vehicle:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteVehicle = async () => {
    if (!vehicle) return;

    setActionLoading('delete');
    try {
      const response = await fetch(`/api/fleet/vehicles/${vehicle.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        router.push('/dashboard/fleet/vehicles');
      } else {
        setError(result.error || 'Error deleting vehicle');
      }
    } catch (err) {
      setError('Error de conexión al eliminar el vehículo');
      console.error('Error deleting vehicle:', err);
    } finally {
      setActionLoading(null);
      setShowDeleteDialog(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      INACTIVE: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      MAINTENANCE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    };

    const icons = {
      ACTIVE: <CheckCircle className="w-3 h-3 mr-1" />,
      INACTIVE: <XCircle className="w-3 h-3 mr-1" />,
      MAINTENANCE: <Clock className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge className={cn(variants[status as keyof typeof variants] || variants.ACTIVE)}>
        {icons[status as keyof typeof icons]}
        {status}
      </Badge>
    );
  };

  const getAvailabilityBadge = (availability: string) => {
    const variants = {
      AVAILABLE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      UNAVAILABLE: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      IN_TRANSIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    };

    const icons = {
      AVAILABLE: <CheckCircle className="w-3 h-3 mr-1" />,
      UNAVAILABLE: <XCircle className="w-3 h-3 mr-1" />,
      IN_TRANSIT: <Car className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge className={cn(variants[availability as keyof typeof variants] || variants.AVAILABLE)}>
        {icons[availability as keyof typeof icons]}
        {availability}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className={cn(
              theme === 'dark'
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>

        <Alert className={cn(
          theme === 'dark'
            ? "bg-red-900/20 border-red-800 text-red-300"
            : "bg-red-50 border-red-200 text-red-700"
        )}>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            {error || 'No se encontró el vehículo'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className={cn(
              theme === 'dark'
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          <div>
            <h1 className={cn(
              "text-3xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              {vehicle.nickname}
            </h1>
            <p className={cn(
              "mt-1",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              {vehicle.make} {vehicle.model} {vehicle.year}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(vehicle.status)}
          {getAvailabilityBadge(vehicle.availability)}
        </div>
      </div>

      {error && (
        <Alert className={cn(
          "mb-6",
          theme === 'dark'
            ? "bg-red-900/20 border-red-800 text-red-300"
            : "bg-red-50 border-red-200 text-red-700"
        )}>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del Vehículo */}
          <Card className={cn(
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Car className="w-5 h-5" />
                Información del Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      VIN
                    </p>
                    <p className={cn(
                      "font-mono text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.vin}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Placa
                    </p>
                    <p className={cn(
                      "font-mono text-sm font-medium",
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.license_plate}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Marca y Modelo
                    </p>
                    <p className={cn(
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Año
                    </p>
                    <p className={cn(
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.year}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Tipo de Vehículo
                    </p>
                    <p className={cn(
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.body_type}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Color
                    </p>
                    <p className={cn(
                      theme === 'dark' ? "text-gray-300" : "text-gray-900"
                    )}>
                      {vehicle.color || 'No especificado'}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Fecha de Registro
                    </p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <p className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-900"
                      )}>
                        {new Date(vehicle.registration_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Última Actualización
                    </p>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <p className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-900"
                      )}>
                        {new Date(vehicle.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capacidad de Carga */}
          <Card className={cn(
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Package className="w-5 h-5" />
                Capacidad de Carga
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2",
                    theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                  )}>
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {vehicle.capacity.empty_boxes}
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Cajas Vacías
                  </p>
                </div>

                <div className="text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2",
                    theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                  )}>
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {vehicle.capacity.full_boxes}
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Cajas Llenas
                  </p>
                </div>

                <div className="text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2",
                    theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                  )}>
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {vehicle.capacity.weight_kg}kg
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Peso Total
                  </p>
                </div>

                <div className="text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2",
                    theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                  )}>
                    <Package className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {vehicle.capacity.volume_m3}m³
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Volumen Total
                  </p>
                </div>
              </div>

              <div className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                theme === 'dark'
                  ? "bg-blue-900/20 border border-blue-800 text-blue-300"
                  : "bg-blue-50 border border-blue-200 text-blue-700"
              )}>
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Capacidad total: <span className="font-medium">
                      {vehicle.capacity.empty_boxes + vehicle.capacity.full_boxes} cajas
                    </span> • {vehicle.capacity.weight_kg}kg • {vehicle.capacity.volume_m3}m³
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos y Fotos */}
          <Card className={cn(
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <FileText className="w-5 h-5" />
                Documentos y Fotos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className={cn(
                    "flex items-center gap-2 font-medium mb-3",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Camera className="w-4 h-4" />
                    Fotos del Vehículo ({vehicle.photos.length})
                  </h4>
                  {vehicle.photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {vehicle.photos.map((photo, index) => (
                        <div key={index} className={cn(
                          "rounded-lg overflow-hidden border",
                          theme === 'dark' ? "border-gray-700" : "border-gray-200"
                        )}>
                          <img
                            src={photo}
                            alt={`Vehículo ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      No hay fotos registradas
                    </p>
                  )}
                </div>

                <div>
                  <h4 className={cn(
                    "flex items-center gap-2 font-medium mb-3",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <FileText className="w-4 h-4" />
                    Documentos de Seguro ({vehicle.insurance_documents.length})
                  </h4>
                  {vehicle.insurance_documents.length > 0 ? (
                    <div className="space-y-2">
                      {vehicle.insurance_documents.map((doc, index) => (
                        <div key={index} className={cn(
                          "flex items-center gap-2 p-2 rounded border",
                          theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
                        )}>
                          <FileText className="w-4 h-4 text-red-500" />
                          <span className={cn(
                            "text-sm truncate",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Documento {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      No hay documentos de seguro registrados
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel de Acciones */}
        <div className="space-y-6">
          {/* Acciones Rápidas */}
          <Card className={cn(
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Wrench className="w-5 h-5" />
                Acciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start",
                  theme === 'dark'
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                disabled={actionLoading === 'edit'}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Información
              </Button>

              {vehicle.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    theme === 'dark'
                      ? "border-yellow-600 text-yellow-300 hover:bg-yellow-900/20"
                      : "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                  )}
                  onClick={() => updateVehicleStatus('MAINTENANCE')}
                  disabled={actionLoading === 'MAINTENANCE'}
                >
                  {actionLoading === 'MAINTENANCE' ? (
                    <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Wrench className="w-4 h-4 mr-2" />
                  )}
                  Poner en Mantenimiento
                </Button>
              )}

              {vehicle.status === 'MAINTENANCE' && (
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    theme === 'dark'
                      ? "border-green-600 text-green-300 hover:bg-green-900/20"
                      : "border-green-300 text-green-700 hover:bg-green-50"
                  )}
                  onClick={() => updateVehicleStatus('ACTIVE')}
                  disabled={actionLoading === 'ACTIVE'}
                >
                  {actionLoading === 'ACTIVE' ? (
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Activar Vehículo
                </Button>
              )}

              {vehicle.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    theme === 'dark'
                      ? "border-red-600 text-red-300 hover:bg-red-900/20"
                      : "border-red-300 text-red-700 hover:bg-red-50"
                  )}
                  onClick={() => updateVehicleStatus('INACTIVE')}
                  disabled={actionLoading === 'INACTIVE'}
                >
                  {actionLoading === 'INACTIVE' ? (
                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Power className="w-4 h-4 mr-2" />
                  )}
                  Desactivar Vehículo
                </Button>
              )}

              {vehicle.status === 'INACTIVE' && (
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start",
                    theme === 'dark'
                      ? "border-green-600 text-green-300 hover:bg-green-900/20"
                      : "border-green-300 text-green-700 hover:bg-green-50"
                  )}
                  onClick={() => updateVehicleStatus('ACTIVE')}
                  disabled={actionLoading === 'ACTIVE'}
                >
                  {actionLoading === 'ACTIVE' ? (
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Reactivar Vehículo
                </Button>
              )}

              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-red-600 hover:text-red-700",
                      theme === 'dark'
                        ? "border-red-800 text-red-400 hover:bg-red-900/20"
                        : "border-red-300 text-red-600 hover:bg-red-50"
                    )}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Vehículo
                  </Button>
                </DialogTrigger>
                <DialogContent className={cn(
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white"
                )}>
                  <DialogHeader>
                    <DialogTitle className={cn(
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ¿Eliminar Vehículo?
                    </DialogTitle>
                    <DialogDescription className={cn(
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Esta acción eliminará permanentemente el vehículo "{vehicle.nickname}" con placa {vehicle.license_plate}.
                      Esta acción no se puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteDialog(false)}
                      className={cn(
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={deleteVehicle}
                      disabled={actionLoading === 'delete'}
                    >
                      {actionLoading === 'delete' ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Eliminar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Información de Asignación */}
          <Card className={cn(
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <User className="w-5 h-5" />
                Asignación Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Conductor
                  </p>
                  {vehicle.driver_id ? (
                    <div className={cn(
                      "flex items-center gap-2 p-2 rounded",
                      theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                    )}>
                      <User className="w-4 h-4 text-blue-600" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        ID: {vehicle.driver_id}
                      </span>
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm italic",
                      theme === 'dark' ? "text-gray-500" : "text-gray-500"
                    )}>
                      Sin conductor asignado
                    </p>
                  )}
                </div>

                <div>
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Ruta Actual
                  </p>
                  {vehicle.current_route_id ? (
                    <div className={cn(
                      "flex items-center gap-2 p-2 rounded",
                      theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                    )}>
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        ID: {vehicle.current_route_id}
                      </span>
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm italic",
                      theme === 'dark' ? "text-gray-500" : "text-gray-500"
                    )}>
                      Sin ruta activa
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}