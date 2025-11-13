'use client';

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@/contexts/theme-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Camera,
  Car,
  Package,
  Plus,
  ArrowLeft,
  Info,
  Upload,
  FileText,
  X,
  Shield,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { VehiclePhotoUpload } from '@/components/ui/vehicle-photo-upload';
import { MultiPhotoUpload } from '@/components/ui/MultiPhotoUpload';
import { decodeVinWithPhotos, formatVin, validateVin, calculateCargoCapacity } from '@/services/vehicleService';
import { VinDecodeResponse, VehicleFormData } from '@/types/vehicle';

// Función para verificar si el VIN ya existe
const checkVinExists = async (vin: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/vehicles/check-vin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vin }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.exists;
  } catch (error) {
    console.error('Error checking VIN existence:', error);
    return false;
  }
};

// Schema de validación para paso de VIN inicial
const initialVinSchema = z.object({
  vin: z.string()
    .min(17, 'El VIN debe tener 17 caracteres')
    .max(17, 'El VIN debe tener 17 caracteres')
    .regex(/^[A-HJ-NPR-Z0-9]+$/i, 'El VIN contiene caracteres inválidos'),
});

// Schema para información manual del vehículo
const manualVehicleInfoSchema = z.object({
  make: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  year: z.number().min(1900, 'El año debe ser válido').max(new Date().getFullYear() + 1),
  body_type: z.string().optional(),
  color: z.string().optional(),
  nickname: z.string().min(1, 'El apodo es requerido'),
});

// Schema para registro final con placa y capacidad
const finalRegistrationSchema = z.object({
  vin: z.string().min(1, 'El VIN es requerido'),
  license_plate: z.string().optional(),
  nickname: z.string().min(1, 'El apodo es requerido'),
  photo_url: z.string().optional(),
  empty_boxes: z.number()
    .min(0, 'La cantidad mínima es 0')
    .max(1000, 'La cantidad máxima es 1,000 cajas'),
  full_boxes: z.number()
    .min(0, 'La cantidad mínima es 0')
    .max(1000, 'La cantidad máxima es 1,000 cajas'),
  can_collect_durable: z.boolean().optional(),
});

// Schema para información de mantenimiento
const maintenanceInfoSchema = z.object({
  mileage: z.number()
    .min(0, 'Las millas deben ser 0 o más')
    .max(1000000, 'Las millas máximas son 1,000,000'),
  insurance_expiry: z.string().min(1, 'La fecha de vencimiento del seguro es requerida'),
  oil_change_frequency: z.number()
    .min(1000, 'La frecuencia mínima es 1,000 millas')
    .max(20000, 'La frecuencia máxima es 20,000 millas'),
});

type InitialVinData = z.infer<typeof initialVinSchema>;
type ManualVehicleInfoData = z.infer<typeof manualVehicleInfoSchema>;
type FinalRegistrationData = z.infer<typeof finalRegistrationSchema>;
type MaintenanceInfoData = z.infer<typeof maintenanceInfoSchema>;

interface ModernVehicleRegistrationFormProps {
  onSubmit: (data: VehicleFormData) => Promise<void>;
  isLoading?: boolean;
}

export function ModernVehicleRegistrationForm({
  onSubmit,
  isLoading = false
}: ModernVehicleRegistrationFormProps) {
  const { theme } = useTheme();

  // Estado para manejar el flujo de registro
  const [currentStep, setCurrentStep] = useState<'vin-input' | 'manual-info' | 'final-registration' | 'maintenance-info'>('vin-input');
  const [registrationPath, setRegistrationPath] = useState<'vin' | 'manual' | null>(null);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [isCheckingVin, setIsCheckingVin] = useState(false);
  const [vinData, setVinData] = useState<VinDecodeResponse | null>(null);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinExistsError, setVinExistsError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [skipVinDecoding, setSkipVinDecoding] = useState(false);

  // Datos recolectados en diferentes pasos
  const [collectedData, setCollectedData] = useState<{
    vin: string;
    make?: string;
    model?: string;
    year?: number;
    body_type?: string;
    color?: string;
    nickname?: string;
    vinData?: VinDecodeResponse;
    manualInfo?: ManualVehicleInfoData;
    finalInfo?: FinalRegistrationData;
    maintenanceInfo?: MaintenanceInfoData;
  }>({
    vin: '',
  });

  // Formulario para paso inicial de VIN
  const vinForm = useForm<InitialVinData>({
    resolver: zodResolver(initialVinSchema),
    mode: 'onChange',
    defaultValues: { vin: '' },
  });

  // Formulario para información manual
  const manualForm = useForm<ManualVehicleInfoData>({
    resolver: zodResolver(manualVehicleInfoSchema),
    mode: 'onChange',
    defaultValues: {
      make: '',
      model: '',
      year: new Date().getFullYear(),
      body_type: '',
      color: '',
      nickname: '',
    },
  });

  // Formulario para registro final
  const finalForm = useForm<FinalRegistrationData>({
    resolver: zodResolver(finalRegistrationSchema),
    mode: 'onChange',
    defaultValues: {
      vin: '',
      license_plate: '',
      nickname: '',
      photo_url: '',
      empty_boxes: 0,
      full_boxes: 0,
    },
  });

  // Formulario para información de mantenimiento
  const maintenanceForm = useForm<MaintenanceInfoData>({
    resolver: zodResolver(maintenanceInfoSchema),
    mode: 'onChange',
    defaultValues: {
      mileage: 0,
      insurance_expiry: '',
      oil_change_frequency: 5000,
    },
  });

  const vinValue = vinForm.watch('vin');
  const finalVinValue = finalForm.watch('vin');
  const licensePlate = finalForm.watch('license_plate');
  const finalNickname = finalForm.watch('nickname');
  const photoUrl = finalForm.watch('photo_url');
  const emptyBoxes = finalForm.watch('empty_boxes');
  const fullBoxes = finalForm.watch('full_boxes');

  // Manejar cambios en el VIN del paso inicial
  const handleVinChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedVin = formatVin(value);

    vinForm.setValue('vin', formattedVin);
    vinForm.clearErrors('vin');
    setVinError(null);
    setVinExistsError(null);

    // Validar longitud del VIN
    if (formattedVin.length === 17 && validateVin(formattedVin) && !skipVinDecoding) {
      await decodeVinData(formattedVin);
    } else if (formattedVin.length === 17 && validateVin(formattedVin) && skipVinDecoding) {
      // Si se omitió la decodificación, ir directamente a registro manual
      setRegistrationPath('manual');
      setCollectedData(prev => ({ ...prev, vin: formattedVin }));
      finalForm.setValue('vin', formattedVin);
      setTimeout(() => setCurrentStep('manual-info'), 500);
    } else if (formattedVin.length === 17) {
      setVinError('El formato del VIN es inválido');
    }
  };

  // Omitir decodificación del VIN
  const handleSkipVinDecoding = () => {
    setSkipVinDecoding(true);
    setVinError(null);
    setVinExistsError(null);
    if (vinValue && vinValue.length === 17 && validateVin(vinValue)) {
      setRegistrationPath('manual');
      setCollectedData(prev => ({ ...prev, vin: vinValue }));
      finalForm.setValue('vin', vinValue);
      setCurrentStep('manual-info');
    }
  };

  // Decodificar VIN y determinar ruta
  const decodeVinData = async (vin: string) => {
    setIsDecodingVin(true);
    setVinError(null);
    setVinExistsError(null);

    try {
      const response = await decodeVinWithPhotos(vin);

      if (response.success && response.data) {
        // Verificar si el VIN ya existe después de decodificar exitosamente
        setIsCheckingVin(true);
        const vinExists = await checkVinExists(vin);
        setIsCheckingVin(false);

        if (vinExists) {
          setVinExistsError(`Este vehículo (VIN: ${vin}) ya está registrado en el sistema. Por favor, verifica el número o contacta al administrador.`);
          setIsDecodingVin(false);
          return;
        }

        setVinData(response.data);
        setRegistrationPath('vin');
        setCollectedData(prev => ({
          ...prev,
          vin,
          make: response.data.make,
          model: response.data.model,
          year: response.data.model_year,
          body_type: response.data.body_type,
          color: response.data.color,
          vinData: response.data,
        }));

        // Preparar formulario final con datos del VIN
        finalForm.setValue('vin', vin);
        finalForm.setValue('nickname', `${response.data.make} ${response.data.model} ${response.data.model_year}`);

        // Calcular capacidades sugeridas
        const suggestedCapacity = calculateCargoCapacity(response.data.gvwr, response.data.vehicle_type);
        // Note: capacity fields are not part of finalRegistrationSchema, using empty_boxes/full_boxes instead
        // finalForm.setValue('capacity_weight_lbs', suggestedCapacity.weight_lbs);
        // finalForm.setValue('capacity_weight_kg', suggestedCapacity.weight_kg);
        // finalForm.setValue('capacity_volume_cubic_ft', suggestedCapacity.volume_cubic_ft);
        // finalForm.setValue('capacity_volume_cubic_m', suggestedCapacity.volume_cubic_m);

        // Auto-set photo from API if available
        if (response.data.photo_urls && response.data.photo_urls.length > 0) {
          finalForm.setValue('photo_url', response.data.photo_urls[0]);
        }

        // Ir directamente al registro final
        setTimeout(() => setCurrentStep('final-registration'), 500);
      } else {
        // Si el VIN no se puede decodificar, ir a ruta manual
        setRegistrationPath('manual');
        setCollectedData(prev => ({ ...prev, vin }));
        finalForm.setValue('vin', vin);
        setTimeout(() => setCurrentStep('manual-info'), 500);
      }
    } catch (error) {
      // Si hay error en la decodificación, ir a ruta manual
      setRegistrationPath('manual');
      setCollectedData(prev => ({ ...prev, vin }));
      finalForm.setValue('vin', vin);
      setTimeout(() => setCurrentStep('manual-info'), 500);
    } finally {
      setIsDecodingVin(false);
    }
  };

  // Continuar con registro manual
  const continueWithManual = async () => {
    setSkipVinDecoding(false);
    setVinExistsError(null);
    setRegistrationPath('manual');
    setCurrentStep('manual-info');
    finalForm.setValue('vin', vinValue);
  };

  // Enviar formulario de información manual
  const onManualInfoSubmit = async (data: ManualVehicleInfoData) => {
    // Verificar si el VIN ya existe antes de continuar
    setIsCheckingVin(true);
    const vinExists = await checkVinExists(vinValue);
    setIsCheckingVin(false);

    if (vinExists) {
      setVinExistsError(`Este vehículo (VIN: ${vinValue}) ya está registrado en el sistema. Por favor, verifica el número o contacta al administrador.`);
      return;
    }

    setCollectedData(prev => ({
      ...prev,
      ...data,
      manualInfo: data,
    }));

    // Preparar formulario final
    finalForm.setValue('nickname', data.nickname);

    // Calcular capacidades sugeridas basadas en el tipo de vehículo
    const defaultCapacity = {
      weight_lbs: 2000,
      weight_kg: 907,
      volume_cubic_ft: 200,
      volume_cubic_m: 5.7,
    };
    // Note: capacity fields are not part of finalRegistrationSchema, using empty_boxes/full_boxes instead
    // finalForm.setValue('capacity_weight_lbs', defaultCapacity.weight_lbs);
    // finalForm.setValue('capacity_weight_kg', defaultCapacity.weight_kg);
    // finalForm.setValue('capacity_volume_cubic_ft', defaultCapacity.volume_cubic_ft);
    // finalForm.setValue('capacity_volume_cubic_m', defaultCapacity.volume_cubic_m);

    setCurrentStep('final-registration');
  };

  // Manejo de archivos de seguro
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file =>
      file.type === 'application/pdf' ||
      file.type === 'image/jpeg' ||
      file.type === 'image/png'
    );

    if (validFiles.length !== files.length) {
      alert('Solo se permiten archivos PDF, JPG o PNG');
      return;
    }

    if (uploadedFiles.length + validFiles.length > 3) {
      alert('Máximo 3 archivos permitidos');
      return;
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Manejar cambios en cantidad de cajas
  const handleEmptyBoxesChange = useCallback((value: string) => {
    const boxes = parseInt(value) || 0;
    finalForm.setValue('empty_boxes', boxes);
  }, [finalForm]);

  const handleFullBoxesChange = useCallback((value: string) => {
    const boxes = parseInt(value) || 0;
    finalForm.setValue('full_boxes', boxes);
  }, [finalForm]);

  // Enviar formulario final
  const onFinalFormSubmit = async (data: FinalRegistrationData) => {
    // Guardar los datos del formulario final en collectedData
    setCollectedData(prev => ({
      ...prev,
      finalInfo: data
    }));

    // Ir al paso de mantenimiento
    setCurrentStep('maintenance-info');
  };

  // Enviar formulario de mantenimiento
  const onMaintenanceInfoSubmit = async (data: MaintenanceInfoData) => {
    const formData: any = {
      vin: collectedData.finalInfo?.vin || collectedData.vin,
      make: collectedData.make || vinData?.make || collectedData.manualInfo?.make,
      model: collectedData.model || vinData?.model || collectedData.manualInfo?.model,
      year: collectedData.year || vinData?.model_year || collectedData.manualInfo?.year,
      body_type: collectedData.body_type || vinData?.body_type || collectedData.manualInfo?.body_type || 'Unknown',
      color: collectedData.color || vinData?.color || collectedData.manualInfo?.color || 'Unknown',
      nickname: collectedData.finalInfo?.nickname || `${collectedData.make || 'Unknown'} ${collectedData.model || 'Unknown'}`,
      photo_url: collectedData.finalInfo?.photo_url || `https://via.placeholder.com/400x300?text=${collectedData.make || 'Vehicle'}+${collectedData.model || 'Photo'}`,
      license_plate: collectedData.finalInfo?.license_plate,
      capacity: {
        empty_boxes: collectedData.finalInfo?.empty_boxes || 0,
        full_boxes: collectedData.finalInfo?.full_boxes || 0,
        // Mantener compatibilidad con campos antiguos si son necesarios
        weight_lbs: (collectedData.finalInfo?.empty_boxes || 0) * 20, // Aproximación: 20 lbs por caja vacía
        weight_kg: (collectedData.finalInfo?.empty_boxes || 0) * 9,  // Aproximación: 9 kg por caja vacía
        volume_cubic_ft: (collectedData.finalInfo?.full_boxes || 0) * 2, // Aproximación: 2 pies cúbicos por caja llena
        volume_cubic_m: (collectedData.finalInfo?.full_boxes || 0) * 0.06, // Aproximación: 0.06 m³ por caja llena
      },
      vin_data: vinData || {
        vin: collectedData.vin,
        make: collectedData.make || collectedData.manualInfo?.make || '',
        model: collectedData.model || collectedData.manualInfo?.model || '',
        model_year: collectedData.year || collectedData.manualInfo?.year || new Date().getFullYear(),
        body_type: collectedData.body_type || collectedData.manualInfo?.body_type || 'Unknown',
        color: collectedData.color || collectedData.manualInfo?.color || 'Unknown',
        drivetrain: '',
        engine: '',
        transmission: '',
        fuel_type: '',
        doors: 0,
        cylinders: 0,
        displacement: 0,
      } as VinDecodeResponse,
      insurance_documents: uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        // En una aplicación real, aquí iría la URL del archivo después de subirlo
        url: URL.createObjectURL(file),
      })),
      // Nuevos campos de mantenimiento
      mileage: data.mileage,
      insurance_expiry: data.insurance_expiry,
      oil_change_frequency: data.oil_change_frequency,
      next_oil_change: new Date(Date.now() + (data.oil_change_frequency * 1609)).toISOString().split('T')[0], // Aproximación
      can_collect_durable: (collectedData.finalInfo as any)?.can_collect_durable || false,
    };

    await onSubmit(formData);
  };

  // Resetear formulario
  const resetForm = () => {
    setVinData(null);
    setVinError(null);
    setVinExistsError(null);
    setRegistrationPath(null);
    setCurrentStep('vin-input');
    setUploadedFiles([]);
    setCollectedData({ vin: '' });
    setSkipVinDecoding(false);

    vinForm.reset();
    manualForm.reset();
    finalForm.reset();
  };

  const canProceedToDetails = vinValue && vinValue.length === 17;
  const canProceedToFinal = (registrationPath === 'vin' && vinData) ||
                           (registrationPath === 'manual' && manualForm.formState.isValid);
  const canSubmitFinal = finalForm.formState.isValid;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { step: 'vin-input' as const, label: 'VIN', icon: Search },
            { step: 'manual-info' as const, label: 'Información', icon: Car },
            { step: 'final-registration' as const, label: 'Registro', icon: Shield },
            { step: 'maintenance-info' as const, label: 'Mantenimiento', icon: Wrench },
          ].map(({ step, label, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
                currentStep === step
                  ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-blue-600 text-white"
                  : (currentStep === 'final-registration' ||
                     (currentStep === 'manual-info' && step === 'vin-input') ||
                     (currentStep === 'maintenance-info'))
                  ? theme === 'dark' ? "bg-green-600 text-white" : "bg-green-600 text-white"
                  : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium",
                currentStep === step
                  ? theme === 'dark' ? "text-white" : "text-gray-900"
                  : theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card className={cn(
        "backdrop-blur-lg shadow-2xl p-8 border",
        theme === 'dark'
          ? "bg-gray-900/95 border-gray-800"
          : "bg-white/95 border-gray-200"
      )}>
        <AnimatePresence mode="wait">
          {/* Step 1: VIN Input */}
          {currentStep === 'vin-input' && (
            <motion.div
              key="vin-input"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                  theme === 'dark' ? "bg-blue-900/50" : "bg-blue-100"
                )}>
                  <Search className={cn(
                    "w-10 h-10",
                    theme === 'dark' ? "text-blue-400" : "text-blue-600"
                  )} />
                </div>
                <h2 className={cn(
                  "text-2xl font-bold mb-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Ingresa el VIN de tu vehículo
                </h2>
                <p className={cn(
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Introduce el número de identificación de 17 caracteres
                </p>
              </div>

              <div>
                <Input
                  {...vinForm.register('vin')}
                  placeholder="Ej: 5FNYF8H52RB020006"
                  className={cn(
                    "text-center text-lg font-mono h-14 border focus:ring-2 transition-colors",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  )}
                  maxLength={17}
                  value={vinValue}
                  onChange={handleVinChange}
                  disabled={isDecodingVin}
                />

                {(vinForm.formState.errors.vin || vinError) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-2 text-red-600 text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{vinForm.formState.errors.vin?.message || vinError}</span>
                  </motion.div>
                )}

                {vinExistsError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-start gap-2 text-orange-600 text-sm bg-orange-50 border border-orange-200 rounded-lg p-3"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Vehículo ya registrado</p>
                      <p className="text-xs mt-1">{vinExistsError}</p>
                    </div>
                  </motion.div>
                )}

                {vinValue && !isDecodingVin && (
                  <div className={cn(
                    "mt-2 text-center text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    {vinValue.length}/17 caracteres
                  </div>
                )}

                {isDecodingVin && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className={cn(
                      "ml-2 text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>Decodificando VIN...</span>
                  </div>
                )}

                {isCheckingVin && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                    <span className={cn(
                      "ml-2 text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>Verificando si el vehículo ya existe...</span>
                  </div>
                )}
              </div>

              {registrationPath === 'vin' && vinData && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "border rounded-xl p-4",
                    theme === 'dark'
                      ? "bg-green-900/20 border-green-800"
                      : "bg-green-50 border-green-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={cn(
                      "w-6 h-6 flex-shrink-0",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )} />
                    <div className="flex-1">
                      <h3 className={cn(
                        "font-semibold mb-1",
                        theme === 'dark' ? "text-green-300" : "text-green-800"
                      )}>Vehículo identificado automáticamente</h3>
                      <div className={cn(
                        "grid grid-cols-2 gap-2 text-sm",
                        theme === 'dark' ? "text-green-200" : "text-green-700"
                      )}>
                        <div>
                          <span className="font-medium">Marca:</span> {vinData.make}
                        </div>
                        <div>
                          <span className="font-medium">Modelo:</span> {vinData.model}
                        </div>
                        <div>
                          <span className="font-medium">Año:</span> {vinData.model_year}
                        </div>
                        <div>
                          <span className="font-medium">Tipo:</span> {vinData.body_type}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {registrationPath === 'manual' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "border rounded-xl p-4",
                    theme === 'dark'
                      ? "bg-yellow-900/20 border-yellow-800"
                      : "bg-yellow-50 border-yellow-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className={cn(
                      "w-6 h-6 flex-shrink-0",
                      theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                    )} />
                    <div className="flex-1">
                      <h3 className={cn(
                        "font-semibold mb-1",
                        theme === 'dark' ? "text-yellow-300" : "text-yellow-800"
                      )}>Registro manual requerido</h3>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-yellow-200" : "text-yellow-700"
                      )}>
                        No se pudo obtener información automáticamente. Por favor, ingresa los datos manualmente.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-3">
                {/* Opciones cuando no hay ruta determinada */}
                {!registrationPath && vinValue && vinValue.length === 17 && validateVin(vinValue) && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      onClick={continueWithManual}
                      disabled={isDecodingVin || isCheckingVin}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-12"
                    >
                      {isDecodingVin || isCheckingVin ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Procesando...
                        </div>
                      ) : (
                        'Decodificar automáticamente'
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSkipVinDecoding}
                      disabled={isDecodingVin || isCheckingVin}
                      variant="outline"
                      className={cn(
                        "h-12",
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      Omitir decodificación
                    </Button>
                  </div>
                )}

                {/* Botón principal de acción */}
                <div className="flex gap-3">
                  {registrationPath ? (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(registrationPath === 'vin' ? 'final-registration' : 'manual-info')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12"
                    >
                      {registrationPath === 'vin' ? 'Continuar al registro' : 'Ingresar datos manualmente'}
                    </Button>
                  ) : (
                    !skipVinDecoding && (
                      <Button
                        type="button"
                        onClick={() => {
                          if (vinValue && vinValue.length === 17 && validateVin(vinValue)) {
                            setSkipVinDecoding(true);
                            setRegistrationPath('manual');
                            setCollectedData(prev => ({ ...prev, vin: vinValue }));
                            finalForm.setValue('vin', vinValue);
                            setCurrentStep('manual-info');
                          }
                        }}
                        disabled={!canProceedToDetails}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12"
                      >
                        Ingresar datos manualmente
                      </Button>
                    )
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className={cn(
                      "px-6 h-12",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Limpiar
                  </Button>
                </div>

                {/* Mensaje cuando se omitió la decodificación */}
                {skipVinDecoding && (
                  <div className={cn(
                    "text-xs p-3 rounded-lg border",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-300"
                      : "bg-gray-100 border-gray-300 text-gray-600"
                  )}>
                    Modo manual activado: Ingresa todos los datos del vehículo manualmente
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Manual Vehicle Information */}
          {currentStep === 'manual-info' && (
            <motion.div
              key="manual-info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <form onSubmit={manualForm.handleSubmit(onManualInfoSubmit)} className="space-y-6">
                <div className="text-center">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? "bg-blue-900/50" : "bg-blue-100"
                  )}>
                    <Car className={cn(
                      "w-10 h-10",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )} />
                  </div>
                  <h2 className={cn(
                    "text-2xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Información del vehículo
                  </h2>
                  <p className={cn(
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Ingresa los datos de tu vehículo
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Marca *
                    </label>
                    <Input
                      {...manualForm.register('make')}
                      placeholder="Ej: Toyota, Honda"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                    {manualForm.formState.errors.make && (
                      <p className="mt-1 text-sm text-red-600">{manualForm.formState.errors.make.message}</p>
                    )}
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Modelo *
                    </label>
                    <Input
                      {...manualForm.register('model')}
                      placeholder="Ej: Corolla, Civic"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                    {manualForm.formState.errors.model && (
                      <p className="mt-1 text-sm text-red-600">{manualForm.formState.errors.model.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Año *
                    </label>
                    <Input
                      type="number"
                      {...manualForm.register('year', { valueAsNumber: true })}
                      placeholder="Ej: 2023"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                    {manualForm.formState.errors.year && (
                      <p className="mt-1 text-sm text-red-600">{manualForm.formState.errors.year.message}</p>
                    )}
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Tipo de carrocería
                    </label>
                    <Input
                      {...manualForm.register('body_type')}
                      placeholder="Ej: Sedan, SUV"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Color
                    </label>
                    <Input
                      {...manualForm.register('color')}
                      placeholder="Ej: Negro, Blanco"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Apodo del vehículo *
                    </label>
                    <Input
                      {...manualForm.register('nickname')}
                      placeholder="Ej: Mi Camioneta"
                      className={cn(
                        "h-12 border focus:ring-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                    {manualForm.formState.errors.nickname && (
                      <p className="mt-1 text-sm text-red-600">{manualForm.formState.errors.nickname.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!canProceedToFinal}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12"
                  >
                    Continuar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep('vin-input')}
                    className={cn(
                      "px-6 h-12",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 3: Final Registration */}
          {currentStep === 'final-registration' && (
            <motion.div
              key="final-registration"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <form onSubmit={finalForm.handleSubmit(onFinalFormSubmit)} className="space-y-6">
                <div className="text-center">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? "bg-blue-900/50" : "bg-blue-100"
                  )}>
                    <Shield className={cn(
                      "w-10 h-10",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )} />
                  </div>
                  <h2 className={cn(
                    "text-2xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Completa el registro
                  </h2>
                  <p className={cn(
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Añade los datos finales y documentos del vehículo
                  </p>
                </div>

                {/* Vehicle Summary */}
                <div className={cn(
                  "rounded-xl p-4",
                  theme === 'dark' ? "bg-gray-800/50 border border-gray-700" : "bg-gray-50"
                )}>
                  <h3 className={cn(
                    "font-semibold mb-3 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Info className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )} />
                    Resumen del vehículo
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>VIN:</span>
                      <p className={cn(
                        "font-mono",
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{finalVinValue}</p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Vehículo:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>
                        {collectedData.make || 'No especificado'} {collectedData.model || ''}
                      </p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Año:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{collectedData.year || 'No especificado'}</p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Tipo:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{collectedData.body_type || 'No especificado'}</p>
                    </div>
                  </div>
                </div>

                {/* License Plate */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Placa del vehículo
                  </label>
                  <Input
                    {...finalForm.register('license_plate')}
                    placeholder="Ej: ABC123"
                    className={cn(
                      "h-12 border focus:ring-2 transition-colors",
                      theme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                    )}
                    value={licensePlate}
                    onChange={(e) => finalForm.setValue('license_plate', e.target.value.toUpperCase())}
                  />
                </div>

                {/* Capacity Configuration */}
                <div className="space-y-4">
                  <h3 className={cn(
                    "font-semibold flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Package className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )} />
                    Capacidad de carga
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Cantidad de Cajas Vacías
                      </label>
                      <Input
                        type="number"
                        {...finalForm.register('empty_boxes', {
                          valueAsNumber: true,
                          onChange: (e) => handleEmptyBoxesChange(e.target.value)
                        })}
                        className={cn(
                          "h-12 border focus:ring-2 transition-colors",
                          theme === 'dark'
                            ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                        )}
                        placeholder="0"
                        min="0"
                        max="1000"
                      />
                      {finalForm.formState.errors.empty_boxes && (
                        <p className="mt-1 text-sm text-red-600">{finalForm.formState.errors.empty_boxes.message}</p>
                      )}
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Cantidad de Cajas Llenas
                      </label>
                      <Input
                        type="number"
                        {...finalForm.register('full_boxes', {
                          valueAsNumber: true,
                          onChange: (e) => handleFullBoxesChange(e.target.value)
                        })}
                        className={cn(
                          "h-12 border focus:ring-2 transition-colors",
                          theme === 'dark'
                            ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                        )}
                        placeholder="0"
                        min="0"
                        max="1000"
                      />
                      {finalForm.formState.errors.full_boxes && (
                        <p className="mt-1 text-sm text-red-600">{finalForm.formState.errors.full_boxes.message}</p>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "text-xs p-3 rounded-lg border",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-300"
                      : "bg-gray-100 border-gray-300 text-gray-600"
                  )}>
                    <p className="font-medium mb-1">Información de capacidad:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Cajas vacías: Para transporte sin carga</li>
                      <li>• Cajas llenas: Para transporte con carga</li>
                      <li>• Máximo 1,000 cajas por tipo</li>
                    </ul>
                  </div>
                </div>

                {/* Durable Collection Option */}
                <div className={cn(
                  "rounded-xl p-4 border",
                  theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                )}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...finalForm.register('can_collect_durable')}
                      className={cn(
                        "w-5 h-5 rounded border-2 transition-colors",
                        theme === 'dark'
                          ? "bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"
                          : "bg-white border-gray-300 text-blue-600 focus:ring-blue-500"
                      )}
                    />
                    <div className="flex-1">
                      <div className={cn(
                        "font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        ¿Puede recoger artículos duraderos?
                      </div>
                      <div className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Marque esta opción si el vehículo puede transportar artículos duraderos (electrodomésticos, muebles, etc.)
                      </div>
                    </div>
                  </label>
                </div>

                {/* Multi Photo Upload */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Fotos y Documentos
                  </label>
                  <MultiPhotoUpload
                    value={photoUrl ? [photoUrl] : []}
                    onChange={(urls) => {
                      finalForm.setValue('photo_url', urls[0] || '');
                      // Guardar las URLs adicionales en el estado si es necesario
                    }}
                    className="w-full"
                    disabled={isLoading}
                    maxFiles={10}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading || !canSubmitFinal}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Guardando datos...
                      </div>
                    ) : (
                      'Continuar'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(registrationPath === 'vin' ? 'vin-input' : 'manual-info')}
                    className={cn(
                      "px-6 h-12",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 4: Maintenance Information */}
          {currentStep === 'maintenance-info' && (
            <motion.div
              key="maintenance-info"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <form onSubmit={maintenanceForm.handleSubmit(onMaintenanceInfoSubmit)} className="space-y-6">
                <div className="text-center">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? "bg-green-900/50" : "bg-green-100"
                  )}>
                    <Shield className={cn(
                      "w-10 h-10",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )} />
                  </div>
                  <h2 className={cn(
                    "text-2xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Información de Mantenimiento
                  </h2>
                  <p className={cn(
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Añade los datos de mantenimiento y seguros del vehículo
                  </p>
                </div>

                {/* Vehicle Summary */}
                <div className={cn(
                  "rounded-xl p-4",
                  theme === 'dark' ? "bg-gray-800/50 border border-gray-700" : "bg-gray-50"
                )}>
                  <h3 className={cn(
                    "font-semibold mb-3 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Info className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )} />
                    Resumen del vehículo
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>VIN:</span>
                      <p className={cn(
                        "font-mono",
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{collectedData.finalInfo?.vin || collectedData.vin}</p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Vehículo:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>
                        {collectedData.make || 'No especificado'} {collectedData.model || ''}
                      </p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Año:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{collectedData.year || 'No especificado'}</p>
                    </div>
                    <div>
                      <span className={cn(
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>Placa:</span>
                      <p className={cn(
                        theme === 'dark' ? "text-gray-200" : "text-gray-900"
                      )}>{collectedData.finalInfo?.license_plate || 'No especificada'}</p>
                    </div>
                  </div>
                </div>

                {/* Mileage */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Millas actuales del vehículo
                  </label>
                  <Input
                    type="number"
                    {...maintenanceForm.register('mileage', {
                      valueAsNumber: true,
                    })}
                    className={cn(
                      "h-12 border focus:ring-2 transition-colors",
                      theme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                    )}
                    placeholder="Ej: 45000"
                    min="0"
                    max="1000000"
                  />
                  {maintenanceForm.formState.errors.mileage && (
                    <p className="text-red-500 text-sm mt-1">
                      {maintenanceForm.formState.errors.mileage.message}
                    </p>
                  )}
                </div>

                {/* Insurance Expiry */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Fecha de vencimiento del seguro
                  </label>
                  <Input
                    type="date"
                    {...maintenanceForm.register('insurance_expiry')}
                    className={cn(
                      "h-12 border focus:ring-2 transition-colors",
                      theme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                    )}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {maintenanceForm.formState.errors.insurance_expiry && (
                    <p className="text-red-500 text-sm mt-1">
                      {maintenanceForm.formState.errors.insurance_expiry.message}
                    </p>
                  )}
                </div>

                {/* Oil Change Frequency */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Frecuencia de cambio de aceite (millas)
                  </label>
                  <Input
                    type="number"
                    {...maintenanceForm.register('oil_change_frequency', {
                      valueAsNumber: true,
                    })}
                    className={cn(
                      "h-12 border focus:ring-2 transition-colors",
                      theme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                    )}
                    placeholder="Ej: 5000"
                    min="1000"
                    max="20000"
                  />
                  {maintenanceForm.formState.errors.oil_change_frequency && (
                    <p className="text-red-500 text-sm mt-1">
                      {maintenanceForm.formState.errors.oil_change_frequency.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Registrando vehículo...
                      </div>
                    ) : (
                      'Registrar vehículo'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep('final-registration')}
                    className={cn(
                      "px-6 h-12",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

// Helper function for className conditional
function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}