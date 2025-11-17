'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SimpleVehicleForm } from '@/components/forms/SimpleVehicleForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Car,
  Filter,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Package,
  CheckCircle,
  XCircle,
  Clock
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

export default function FleetVehiclesPage() {
  const { theme } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const VEHICLES_PER_PAGE = 25;

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: VEHICLES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(availabilityFilter && availabilityFilter !== 'all' && { availability: availabilityFilter }),
      });

      const response = await fetch(`/api/fleet/vehicles?${params}`);
      const result = await response.json();

      if (result.success) {
        setVehicles(result.data || []);
        setTotalVehicles(result.pagination?.total || 0);
      } else {
        console.error('Error fetching vehicles:', result.error);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [currentPage, searchTerm, statusFilter, availabilityFilter]);

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      INACTIVE: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      MAINTENANCE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    };

    return (
      <Badge className={cn(variants[status as keyof typeof variants] || variants.ACTIVE)}>
        {status === 'ACTIVE' && <CheckCircle className="w-3 h-3 mr-1" />}
        {status === 'INACTIVE' && <XCircle className="w-3 h-3 mr-1" />}
        {status === 'MAINTENANCE' && <Clock className="w-3 h-3 mr-1" />}
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

    return (
      <Badge className={cn(variants[availability as keyof typeof variants] || variants.AVAILABLE)}>
        {availability === 'AVAILABLE' && <CheckCircle className="w-3 h-3 mr-1" />}
        {availability === 'UNAVAILABLE' && <XCircle className="w-3 h-3 mr-1" />}
        {availability === 'IN_TRANSIT' && <Car className="w-3 h-3 mr-1" />}
        {availability}
      </Badge>
    );
  };

  const handleVehicleSuccess = (vehicle: Vehicle) => {
    setShowForm(false);
    fetchVehicles();
  };

  const totalPages = Math.ceil(totalVehicles / VEHICLES_PER_PAGE);

  if (showForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setShowForm(false)}
            className={cn(
              theme === 'dark'
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            ← Volver a la lista
          </Button>
        </div>
        <SimpleVehicleForm onSuccess={handleVehicleSuccess} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={cn(
            "text-3xl font-bold",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Gestión de Vehículos
          </h1>
          <p className={cn(
            "mt-2",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            Administra el fleet de vehículos de la empresa
          </p>
        </div>

        <Button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Vehículo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className={cn(
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse">
                <div className={cn(
                  "h-4 rounded w-24 mb-2",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
                <div className={cn(
                  "h-8 rounded w-16",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Total Vehículos
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {totalVehicles}
                  </p>
                </div>
                <Car className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse">
                <div className={cn(
                  "h-4 rounded w-24 mb-2",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
                <div className={cn(
                  "h-8 rounded w-16",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Activos
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1 text-green-600",
                    theme === 'dark' ? "text-green-400" : "text-green-600"
                  )}>
                    {vehicles.filter(v => v.status === 'ACTIVE').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse">
                <div className={cn(
                  "h-4 rounded w-24 mb-2",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
                <div className={cn(
                  "h-8 rounded w-16",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Disponibles
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1 text-blue-600",
                    theme === 'dark' ? "text-blue-400" : "text-blue-600"
                  )}>
                    {vehicles.filter(v => v.availability === 'AVAILABLE').length}
                  </p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse">
                <div className={cn(
                  "h-4 rounded w-24 mb-2",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
                <div className={cn(
                  "h-8 rounded w-20",
                  theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                )}></div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Capacidad Total
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {vehicles.reduce((sum, v) => sum + v.capacity.empty_boxes + v.capacity.full_boxes, 0)} cajas
                  </p>
                </div>
                <Package className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={cn(
        "mb-6",
        theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <Input
                  placeholder="Buscar por VIN, placa, marca, modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "pl-10",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={cn(
                "w-full md:w-48",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
                <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger className={cn(
                "w-full md:w-48",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Disponibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="AVAILABLE">Disponibles</SelectItem>
                <SelectItem value="UNAVAILABLE">No disponibles</SelectItem>
                <SelectItem value="IN_TRANSIT">En tránsito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card className={cn(
        theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <CardHeader>
          <CardTitle className={cn(
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Lista de Vehículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-4">
                <div className="w-16 h-16 border-4 border-blue-600/20 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <p className={cn(
                "text-lg font-medium mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Cargando vehículos...
              </p>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Obteniendo datos de la flota
              </p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className={cn(
                "w-12 h-12 mx-auto mb-4",
                theme === 'dark' ? "text-gray-600" : "text-gray-400"
              )} />
              <h3 className={cn(
                "text-lg font-medium mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                No se encontraron vehículos
              </h3>
              <p className={cn(
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                {searchTerm || statusFilter !== 'all' || availabilityFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Registra tu primer vehículo para comenzar'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={cn(
                      theme === 'dark' ? "border-gray-700" : "border-gray-200"
                    )}>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Vehículo
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        VIN/Placa
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Estado
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Disponibilidad
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Capacidad
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Registrado
                      </TableHead>
                      <TableHead className={cn(
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id} className={cn(
                        theme === 'dark' ? "border-gray-700" : "border-gray-200"
                      )}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                            )}>
                              <Car className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                {vehicle.nickname}
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                {vehicle.make} {vehicle.model} {vehicle.year}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className={cn(
                              "text-sm font-mono",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {vehicle.vin}
                            </p>
                            <p className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {vehicle.license_plate}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(vehicle.status)}
                        </TableCell>
                        <TableCell>
                          {getAvailabilityBadge(vehicle.availability)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-xs font-medium",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Carga
                                </span>
                                <span className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {(vehicle.capacity.empty_boxes || 0) + (vehicle.capacity.full_boxes || 0)} / 50 cajas
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                <div
                                  className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(((vehicle.capacity.empty_boxes || 0) + (vehicle.capacity.full_boxes || 0)) / 50 * 100, 100)}%`
                                  }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className={cn(
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {vehicle.capacity.empty_boxes || 0} vacías
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className={cn(
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {vehicle.capacity.full_boxes || 0} llenas
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            <span className={cn(
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {new Date(vehicle.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.location.href = `/dashboard/fleet/vehicles/${vehicle.id}`}
                              className="h-8 w-8 p-0"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Editar vehículo"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Mostrando {(currentPage - 1) * VEHICLES_PER_PAGE + 1} a {Math.min(currentPage * VEHICLES_PER_PAGE, totalVehicles)} de {totalVehicles} vehículos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={cn(
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      Anterior
                    </Button>
                    <span className={cn(
                      "text-sm px-3 py-1",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={cn(
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}