'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Car } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/contexts/NotificationContext';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { ModernVehicleRegistrationForm } from '@/components/forms/ModernVehicleRegistrationForm';
import { VehicleFormData } from '@/types/vehicle';
import { createVehicle } from '@/services/vehicleService';

export default function RegisterVehiclePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showNotification } = useNotifications();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateVehicle = async (data: VehicleFormData) => {
    try {
      setIsCreating(true);

      // Use direct values from form data, falling back to vin_data for VIN-decoded vehicles
      const response = await createVehicle({
        vin: data.vin,
        make: (data as any).make || data.vin_data?.make || 'Unknown',
        model: (data as any).model || data.vin_data?.model || 'Unknown',
        year: (data as any).year || data.vin_data?.model_year || new Date().getFullYear(),
        body_type: (data as any).body_type || data.vin_data?.body_type || 'Unknown',
        color: (data as any).color || data.vin_data?.color || 'Unknown',
        nickname: (data as any).nickname || `${(data as any).make || data.vin_data?.make || 'Unknown'} ${(data as any).model || data.vin_data?.model || 'Unknown'}`,
        photo_url: data.photo_url,
        license_plate: (data as any).license_plate,
        empty_boxes: (data as any).capacity?.empty_boxes || 0,
        full_boxes: (data as any).capacity?.full_boxes || 0,
        capacity: {
          weight_lbs: data.capacity_weight_lbs,
          weight_kg: data.capacity_weight_kg,
          volume_cubic_ft: data.capacity_volume_cubic_ft,
          volume_cubic_m: data.capacity_volume_cubic_m,
        },
        mileage: (data as any).mileage || 0,
        insurance_expiry: (data as any).insurance_expiry,
        oil_change_frequency: (data as any).oil_change_frequency || 5000,
        can_collect_durable: (data as any).can_collect_durable || false,
        status: 'ACTIVE' as const,
        availability: 'AVAILABLE' as const,
        vin_data: data.vin_data,
      });

      if (response.success) {
        showNotification(
          'success',
          'Vehículo Registrado',
          'El vehículo ha sido registrado exitosamente'
        );
        router.push('/dashboard/admin/vehicles');
      } else {
        showNotification(
          'error',
          'Error al Registrar',
          response.error || 'No se pudo registrar el vehículo'
        );
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      showNotification(
        'error',
        'Error Inesperado',
        'Ocurrió un error al registrar el vehículo'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/admin/vehicles');
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-end mb-6">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className={cn(
                "p-2",
                theme === 'dark'
                  ? "text-gray-400 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Form Content */}
        <div className={cn(
          "rounded-2xl border p-8",
          theme === 'dark'
            ? "bg-gray-900/50 border-gray-800 backdrop-blur-lg"
            : "bg-white border-gray-200 shadow-lg"
        )}>
          <ModernVehicleRegistrationForm
            onSubmit={handleCreateVehicle}
            isLoading={isCreating}
          />
        </div>

        {/* Quick Tips */}
        <div className={cn(
          "mt-8 rounded-xl border p-6",
          theme === 'dark'
            ? "bg-gray-900/30 border-gray-800"
            : "bg-blue-50 border-blue-200"
        )}>
          <h3 className={cn(
            "font-semibold mb-3 flex items-center gap-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            <CheckCircle2 className={cn(
              "w-5 h-5",
              theme === 'dark' ? "text-blue-400" : "text-blue-600"
            )} />
            Consejos Rápidos
          </h3>
          <ul className={cn(
            "space-y-2 text-sm",
            theme === 'dark' ? "text-gray-300" : "text-gray-700"
          )}>
            <li>• El VIN debe tener exactamente 17 caracteres alfanuméricos</li>
            <li>• Puedes encontrar el VIN en el parabrisas, documentos del vehículo o puerta del conductor</li>
            <li>• La foto del vehículo ayudará a identificarlo rápidamente en las asignaciones</li>
            <li>• Configura correctamente la capacidad de carga para optimizar rutas</li>
          </ul>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}