'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  Truck,
  Grid,
  List,
  SlidersHorizontal,
  Download,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VehicleCard } from './VehicleCard';
import { Vehicle, VehicleStatus, VehicleAvailability } from '@/types/vehicle';
import { getVehicles } from '@/services/vehicleService';
import { Grid as GridIcon, List as ListIcon } from 'lucide-react';

interface VehicleListProps {
  onCreateVehicle?: () => void;
  onAssignRoute?: (vehicleId: string) => void;
  onViewDetails?: (vehicleId: string) => void;
  onEdit?: (vehicleId: string) => void;
  onToggleStatus?: (vehicleId: string) => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'make' | 'year' | 'capacity' | 'status' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface FilterOptions {
  status: VehicleStatus | '';
  availability: VehicleAvailability | '';
  make: string;
  search: string;
}

export function VehicleList({
  onCreateVehicle,
  onAssignRoute,
  onViewDetails,
  onEdit,
  onToggleStatus,
  className = ''
}: VehicleListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    availability: '',
    make: '',
    search: ''
  });

  // Cargar vehículos
  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const response = await getVehicles(1, 100); // Cargar hasta 100 vehículos
      if (response.success && response.data) {
        setVehicles(response.data.data);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Filtrar y ordenar vehículos
  useEffect(() => {
    let filtered = [...vehicles];

    // Aplicar filtros
    if (filters.status) {
      filtered = filtered.filter(v => v.status === filters.status);
    }
    if (filters.availability) {
      filtered = filtered.filter(v => v.availability === filters.availability);
    }
    if (filters.make) {
      filtered = filtered.filter(v => v.make.toLowerCase().includes(filters.make.toLowerCase()));
    }
    if (filters.search || searchTerm) {
      const search = (filters.search || searchTerm).toLowerCase();
      filtered = filtered.filter(v =>
        v.make.toLowerCase().includes(search) ||
        v.model.toLowerCase().includes(search) ||
        v.vin.toLowerCase().includes(search) ||
        v.year.toString().includes(search)
      );
    }

    // Ordenar
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'make':
          comparison = a.make.localeCompare(b.make);
          break;
        case 'year':
          comparison = a.year - b.year;
          break;
        case 'capacity':
          comparison = a.capacity.weight_lbs - b.capacity.weight_lbs;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredVehicles(filtered);
  }, [vehicles, filters, searchTerm, sortBy, sortOrder]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters(prev => ({ ...prev, search: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      availability: '',
      make: '',
      search: ''
    });
    setSearchTerm('');
  };

  const uniqueMakes = [...new Set(vehicles.map(v => v.make))].sort();

  const getStats = () => {
    const total = vehicles.length;
    const available = vehicles.filter(v => v.availability === 'AVAILABLE').length;
    const active = vehicles.filter(v => v.status === 'ACTIVE').length;
    const inTransit = vehicles.filter(v => v.status === 'IN_TRANSIT').length;

    return { total, available, active, inTransit };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-300">Cargando vehículos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Resultados */}
      <div className="text-sm text-gray-300 mb-4">
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400 mb-2">No se encontraron vehículos</p>
            <p className="text-gray-500">
              {vehicles.length === 0
                ? 'No hay vehículos registrados. Crea tu primer vehículo.'
                : 'Intenta ajustar los filtros o términos de búsqueda.'
              }
            </p>
          </div>
        ) : (
          <p>Mostrando {filteredVehicles.length} de {vehicles.length} vehículos</p>
        )}
      </div>

      {/* Grid de vehículos */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          <AnimatePresence>
            {filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onAssignRoute={onAssignRoute}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                className={viewMode === 'list' ? 'w-full' : ''}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}