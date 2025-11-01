'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Package,
  Weight,
  Box,
  MapPin,
  Settings,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Clock,
  Camera,
  MoreVertical,
  Route,
  Eye,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Vehicle, VehicleStatus, VehicleAvailability } from '@/types/vehicle';
import { formatCurrency } from '@/lib/utils';

interface VehicleCardProps {
  vehicle: Vehicle;
  onAssignRoute?: (vehicleId: string) => void;
  onViewDetails?: (vehicleId: string) => void;
  onEdit?: (vehicleId: string) => void;
  onToggleStatus?: (vehicleId: string) => void;
  className?: string;
}

const statusColors = {
  [VehicleStatus.ACTIVE]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [VehicleStatus.MAINTENANCE]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  [VehicleStatus.INACTIVE]: 'bg-red-500/20 text-red-400 border-red-500/30',
  [VehicleStatus.IN_TRANSIT]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const availabilityColors = {
  [VehicleAvailability.AVAILABLE]: 'bg-green-500/20 text-green-400',
  [VehicleAvailability.ASSIGNED]: 'bg-blue-500/20 text-blue-400',
  [VehicleAvailability.UNAVAILABLE]: 'bg-red-500/20 text-red-400',
};

const statusIcons = {
  [VehicleStatus.ACTIVE]: <CheckCircle className="w-4 h-4" />,
  [VehicleStatus.MAINTENANCE]: <AlertCircle className="w-4 h-4" />,
  [VehicleStatus.INACTIVE]: <Pause className="w-4 h-4" />,
  [VehicleStatus.IN_TRANSIT]: <Clock className="w-4 h-4" />,
};

export function VehicleCard({
  vehicle,
  onAssignRoute,
  onViewDetails,
  onEdit,
  onToggleStatus,
  className = ''
}: VehicleCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleToggleStatus = () => {
    if (onToggleStatus) {
      onToggleStatus(vehicle.id);
    }
    setShowMenu(false);
  };

  const capacityUsagePercentage = vehicle.capacity.weight_lbs > 0 ? 65 : 0; // Simulación de uso

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`w-full ${className}`}
    >
      <Card className="backdrop-blur-lg bg-white/10 border-white/20 overflow-hidden hover:bg-white/15 transition-all duration-300">
        {/* Header del vehículo */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Foto del vehículo */}
              <div className="relative">
                {vehicle.photo_url ? (
                  <img
                    src={vehicle.photo_url}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-24 h-20 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) {
                        nextElement.classList.remove('hidden');
                      }
                    }}
                  />
                ) : null}
                <div className={`w-24 h-20 bg-gradient-to-br from-exa-primary/20 to-exa-secondary/20 rounded-lg flex items-center justify-center ${vehicle.photo_url ? 'hidden' : ''}`}>
                  <Truck className="w-10 h-10 text-white/50" />
                </div>

                {/* Badge de disponibilidad */}
                <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold ${availabilityColors[vehicle.availability]}`}>
                  {vehicle.availability === 'AVAILABLE' ? 'Disponible' :
                   vehicle.availability === 'ASSIGNED' ? 'Asignado' : 'No disponible'}
                </div>
              </div>

              {/* Información básica */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">
                  {vehicle.make} {vehicle.model}
                </h3>
                <p className="text-gray-300 text-sm mb-2">
                  Año {vehicle.year} • {vehicle.body_type}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[vehicle.status]}`}>
                    {statusIcons[vehicle.status]}
                    {vehicle.status === 'ACTIVE' ? 'Activo' :
                     vehicle.status === 'MAINTENANCE' ? 'Mantenimiento' :
                     vehicle.status === 'INACTIVE' ? 'Inactivo' : 'En tránsito'}
                  </span>
                  {vehicle.color && (
                    <span className="text-gray-400 text-sm">
                      {vehicle.color}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Menú de acciones */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>

              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-0 top-8 w-48 bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-10"
                >
                  <div className="p-1">
                    {onViewDetails && (
                      <button
                        onClick={() => { onViewDetails(vehicle.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver detalles
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => { onEdit(vehicle.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                    {vehicle.availability === 'AVAILABLE' && onAssignRoute && (
                      <button
                        onClick={() => { onAssignRoute(vehicle.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded transition-colors"
                      >
                        <Route className="w-4 h-4" />
                        Asignar ruta
                      </button>
                    )}
                    {onToggleStatus && (
                      <button
                        onClick={handleToggleStatus}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Cambiar estado
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* VIN */}
          <div className="bg-white/5 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-gray-400 mb-1">VIN</p>
            <p className="font-mono text-sm text-white">{vehicle.vin}</p>
          </div>
        </div>

        {/* Capacidad de carga */}
        <div className="px-6 pb-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Capacidad de Carga
          </h4>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Capacidad de peso */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Peso</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-white">
                  {vehicle.capacity.weight_lbs.toLocaleString()} <span className="text-sm text-gray-400">lbs</span>
                </p>
                <p className="text-sm text-gray-300">
                  {vehicle.capacity.weight_kg.toLocaleString()} <span className="text-xs text-gray-400">kg</span>
                </p>
              </div>

              {/* Barra de progreso de uso */}
              <div className="mt-2">
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-exa-primary to-exa-secondary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${capacityUsagePercentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {capacityUsagePercentage}% utilizado
                </p>
              </div>
            </div>

            {/* Capacidad de volumen */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Volumen</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-white">
                  {vehicle.capacity.volume_cubic_ft.toLocaleString()} <span className="text-sm text-gray-400">ft³</span>
                </p>
                <p className="text-sm text-gray-300">
                  {vehicle.capacity.volume_cubic_m.toFixed(1)} <span className="text-xs text-gray-400">m³</span>
                </p>
              </div>

              {/* Barra de progreso de volumen */}
              <div className="mt-2">
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-exa-primary to-exa-secondary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${capacityUsagePercentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {capacityUsagePercentage}% utilizado
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            {vehicle.availability === 'AVAILABLE' && onAssignRoute && (
              <Button
                onClick={() => onAssignRoute(vehicle.id)}
                className="flex-1 bg-exa-primary hover:bg-exa-primary/90 text-sm"
              >
                <Route className="w-4 h-4 mr-2" />
                Asignar Ruta
              </Button>
            )}

            {vehicle.status === VehicleStatus.ACTIVE && onToggleStatus && (
              <Button
                variant="outline"
                onClick={handleToggleStatus}
                className="border-white/20 text-white hover:bg-white/10 text-sm"
              >
                <Pause className="w-4 h-4 mr-2" />
                Desactivar
              </Button>
            )}

            {vehicle.status === VehicleStatus.INACTIVE && onToggleStatus && (
              <Button
                variant="outline"
                onClick={handleToggleStatus}
                className="border-white/20 text-white hover:bg-white/10 text-sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Activar
              </Button>
            )}
          </div>

          {/* Información de ruta actual */}
          {vehicle.current_route_id && (
            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Actualmente en ruta #{vehicle.current_route_id}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}