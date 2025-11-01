'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Truck, Package, AlertCircle, CheckCircle, Camera, Settings, FileText, Upload, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { decodeVinWithPhotos, validateVin, formatVin, calculateCargoCapacity } from '@/services/vehicleService';
import { VehicleFormData, VinDecodeResponse } from '@/types/vehicle';

// Schema de validación para el paso inicial de VIN
const initialVinSchema = z.object({
  vin: z.string()
    .min(17, 'El VIN debe tener 17 caracteres')
    .max(17, 'El VIN debe tener 17 caracteres')
    .regex(/^[A-HJ-NPR-Z0-9]+$/i, 'El VIN contiene caracteres inválidos'),
});

// Schema de validación para el formulario manual
const manualRegistrationSchema = z.object({
  make: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  year: z.number()
    .min(1900, 'El año debe ser mayor a 1900')
    .max(new Date().getFullYear() + 1, 'El año no puede ser futuro'),
  body_type: z.string().min(1, 'El tipo de vehículo es requerido'),
  color: z.string().optional(),
  nickname: z.string().optional(),
});

// Schema de validación para el paso final de registro (ambos caminos)
const finalRegistrationSchema = z.object({
  vin: z.string().min(1, 'El VIN es requerido'),
  license_plate: z.string().optional(),
  capacity_weight_lbs: z.number()
    .min(100, 'La capacidad mínima es 100 lbs')
    .max(50000, 'La capacidad máxima es 50,000 lbs'),
  capacity_weight_kg: z.number()
    .min(50, 'La capacidad mínima es 50 kg')
    .max(22680, 'La capacidad máxima es 22,680 kg'),
  capacity_volume_cubic_ft: z.number()
    .min(1, 'El volumen mínimo es 1 pie cúbico')
    .max(2000, 'El volumen máximo es 2,000 pies cúbicos'),
  capacity_volume_cubic_m: z.number()
    .min(0.1, 'El volumen mínimo es 0.1 metros cúbicos')
    .max(56.6, 'El volumen máximo es 56.6 metros cúbicos'),
});

type InitialVinFormData = z.infer<typeof initialVinSchema>;
type ManualRegistrationFormData = z.infer<typeof manualRegistrationSchema>;
type FinalRegistrationFormData = z.infer<typeof finalRegistrationSchema>;

interface VehicleRegistrationFormProps {
  onSubmit: (data: VehicleFormData) => Promise<void>;
  isLoading?: boolean;
}

export function VehicleRegistrationForm({ onSubmit, isLoading = false }: VehicleRegistrationFormProps) {
  const [registrationPath, setRegistrationPath] = useState<'vin' | 'manual' | null>(null);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [vinData, setVinData] = useState<VinDecodeResponse | null>(null);
  const [vinError, setVinError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'vin-input' | 'manual-info' | 'final-registration'>('vin-input');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
    setError,
    clearErrors,
    reset,
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      vin: '',
      license_plate: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      body_type: '',
      color: '',
      nickname: '',
      capacity_weight_lbs: 0,
      capacity_weight_kg: 0,
      capacity_volume_cubic_ft: 0,
      capacity_volume_cubic_m: 0,
    },
  });

  const vinValue = watch('vin');
  const licensePlateValue = watch('license_plate');
  const makeValue = watch('make');
  const modelValue = watch('model');
  const yearValue = watch('year');
  const bodyTypeValue = watch('body_type');
  const weightLbs = watch('capacity_weight_lbs');
  const weightKg = watch('capacity_weight_kg');
  const volumeCubicFt = watch('capacity_volume_cubic_ft');
  const volumeCubicM = watch('capacity_volume_cubic_m');

  // Manejar cambios en el VIN
  const handleVinChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedVin = formatVin(value);

    setValue('vin', formattedVin);
    clearErrors('vin');
    setVinError(null);

    // Validar longitud del VIN
    if (formattedVin.length === 17 && validateVin(formattedVin)) {
      await decodeVinAndDecidePath(formattedVin);
    } else if (formattedVin.length === 17) {
      setVinError('El formato del VIN es inválido');
    }
  };

  // Decodificar VIN y decidir camino
  const decodeVinAndDecidePath = async (vin: string) => {
    setIsDecodingVin(true);
    setVinError(null);

    try {
      const response = await decodeVinWithPhotos(vin);

      if (response.success && response.data) {
        setVinData(response.data);
        setRegistrationPath('vin');
        setCurrentStep('final-registration');

        // Calcular capacidades sugeridas basadas en el tipo de vehículo
        const suggestedCapacity = calculateCargoCapacity(response.data.gvwr, response.data.vehicle_type);
        setValue('capacity_weight_lbs', suggestedCapacity.weight_lbs);
        setValue('capacity_weight_kg', suggestedCapacity.weight_kg);
        setValue('capacity_volume_cubic_ft', suggestedCapacity.volume_cubic_ft);
        setValue('capacity_volume_cubic_m', suggestedCapacity.volume_cubic_m);
      } else {
        // No se encontró información del VIN, ir a registro manual
        setRegistrationPath('manual');
        setCurrentStep('manual-info');
        setVinError('No se encontró información para este VIN. Por favor, ingrese los datos manualmente.');
      }
    } catch (error) {
      // Error en la decodificación, ir a registro manual
      setRegistrationPath('manual');
      setCurrentStep('manual-info');
      setVinError('No se pudo decodificar el VIN. Por favor, ingrese los datos manualmente.');
    } finally {
      setIsDecodingVin(false);
    }
  };

  // Convertir unidades automáticamente
  const handleWeightLbsChange = (value: string) => {
    const lbs = parseFloat(value) || 0;
    setValue('capacity_weight_lbs', lbs);
    setValue('capacity_weight_kg', Math.round(lbs * 0.453592));
  };

  const handleWeightKgChange = (value: string) => {
    const kg = parseFloat(value) || 0;
    setValue('capacity_weight_kg', kg);
    setValue('capacity_weight_lbs', Math.round(kg * 2.20462));
  };

  const handleVolumeCubicFtChange = (value: string) => {
    const cubicFt = parseFloat(value) || 0;
    setValue('capacity_volume_cubic_ft', cubicFt);
    setValue('capacity_volume_cubic_m', parseFloat((cubicFt * 0.0283168).toFixed(2)));
  };

  const handleVolumeCubicMChange = (value: string) => {
    const cubicM = parseFloat(value) || 0;
    setValue('capacity_volume_cubic_m', cubicM);
    setValue('capacity_volume_cubic_ft', Math.round(cubicM * 35.3147));
  };

  // Validar formulario manual
  const validateManualForm = () => {
    const formData = watch();
    const result = manualRegistrationSchema.safeParse(formData);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        setError(issue.path[0] as string, {
          message: issue.message,
        });
      });
      return false;
    }

    return true;
  };

  // Validar formulario final
  const validateFinalForm = () => {
    const formData = watch();
    const result = finalRegistrationSchema.safeParse(formData);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        setError(issue.path[0] as string, {
          message: issue.message,
        });
      });
      return false;
    }

    return true;
  };

  // Continuar desde formulario manual
  const continueFromManual = () => {
    if (!validateManualForm()) {
      return;
    }
    setCurrentStep('final-registration');
  };

  // Enviar formulario
  const onFormSubmit = async (data: any) => {
    if (!validateFinalForm()) {
      return;
    }

    let formData: VehicleFormData;

    if (registrationPath === 'vin' && vinData) {
      // Camino VIN exitoso
      formData = {
        ...data,
        vin_data: vinData,
        photo_url: vinData.photo_urls?.[0],
      };
    } else {
      // Camino manual
      const manualVinData = {
        vin: data.vin,
        make: data.make,
        model: data.model,
        model_year: data.year,
        body_type: data.body_type,
        color: data.color || 'Unknown',
        manufacturer: '',
        plant: '',
        series: '',
        trim: '',
        style: '',
        vehicle_type: '',
        gvwr: '',
        wmi: '',
        squishVin: '',
        checksum: false,
        vinValid: true,
        photo_urls: [],
      };

      formData = {
        ...data,
        vin_data: manualVinData,
        photo_url: undefined,
      };
    }

    await onSubmit(formData);
  };

  // Resetear formulario
  const resetForm = () => {
    setVinData(null);
    setVinError(null);
    setRegistrationPath(null);
    setCurrentStep('vin-input');
    setUploadedFiles([]);
    clearErrors();
    reset({
      vin: '',
      license_plate: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      body_type: '',
      color: '',
      nickname: '',
      capacity_weight_lbs: 0,
      capacity_weight_kg: 0,
      capacity_volume_cubic_ft: 0,
      capacity_volume_cubic_m: 0,
    });
  };

  // Manejo de archivos
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Validar si se puede continuar al paso final
  const canContinueToFinal = () => {
    return makeValue && modelValue && yearValue && bodyTypeValue;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="backdrop-blur-lg bg-white/10 border-white/20 p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Registrar Nuevo Vehículo</h2>
          <p className="text-gray-300">
            Ingrese el número VIN para comenzar el registro del vehículo
          </p>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Paso 1: Entrada de VIN */}
          <AnimatePresence mode="wait">
            {currentStep === 'vin-input' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Número de Identificación del Vehículo (VIN)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      {...register('vin')}
                      placeholder="Ej: 1HGCM82633A004352"
                      className="pl-10 bg-white/5 border-white/20 text-white placeholder-gray-400"
                      maxLength={17}
                      value={vinValue}
                      onChange={handleVinChange}
                      disabled={isDecodingVin}
                    />
                    {isDecodingVin && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                  {(errors.vin || vinError) && (
                    <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.vin?.message || vinError}
                    </p>
                  )}
                  {vinValue && !isDecodingVin && (
                    <p className="mt-1 text-sm text-gray-400">
                      {vinValue.length}/17 caracteres
                    </p>
                  )}
                </div>

                {registrationPath === 'vin' && vinData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-400 mb-2">Vehículo Identificado</h4>
                        <p className="text-sm text-green-300 mb-2">VIN decodificado correctamente. Continúe al registro final.</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400">Marca:</span>
                            <span className="ml-2 text-white">{vinData.make}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Modelo:</span>
                            <span className="ml-2 text-white">{vinData.model}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Año:</span>
                            <span className="ml-2 text-white">{vinData.model_year}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Tipo:</span>
                            <span className="ml-2 text-white">{vinData.body_type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {registrationPath === 'vin' && (
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      onClick={() => setCurrentStep('final-registration')}
                      disabled={!vinData}
                      className="flex-1 bg-exa-primary hover:bg-exa-primary/90"
                    >
                      Continuar al Registro
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Limpiar
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Paso 2: Información Manual (cuando el VIN no se encuentra) */}
            {currentStep === 'manual-info' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-400 mb-1">VIN no encontrado</h4>
                      <p className="text-sm text-yellow-300">
                        No se encontró información para el VIN ingresado. Por favor, complete los datos del vehículo manualmente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Información del Vehículo
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Marca
                      </label>
                      <Input
                        {...register('make')}
                        placeholder="Ej: Toyota, Ford, Honda"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                      />
                      {errors.make && (
                        <p className="mt-1 text-sm text-red-400">{errors.make.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Modelo
                      </label>
                      <Input
                        {...register('model')}
                        placeholder="Ej: Corolla, F-150, Accord"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                      />
                      {errors.model && (
                        <p className="mt-1 text-sm text-red-400">{errors.model.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Año
                      </label>
                      <Input
                        {...register('year', { valueAsNumber: true })}
                        type="number"
                        placeholder="Ej: 2023"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                        min={1900}
                        max={new Date().getFullYear() + 1}
                      />
                      {errors.year && (
                        <p className="mt-1 text-sm text-red-400">{errors.year.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Tipo de Vehículo
                      </label>
                      <Input
                        {...register('body_type')}
                        placeholder="Ej: Sedan, SUV, Pickup, Van"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                      />
                      {errors.body_type && (
                        <p className="mt-1 text-sm text-red-400">{errors.body_type.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Color (Opcional)
                      </label>
                      <Input
                        {...register('color')}
                        placeholder="Ej: Negro, Blanco, Azul"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Apodo (Opcional)
                      </label>
                      <Input
                        {...register('nickname')}
                        placeholder="Ej: Camión de Entregas"
                        className="bg-white/5 border-white/20 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    onClick={continueFromManual}
                    disabled={!canContinueToFinal()}
                    className="flex-1 bg-exa-primary hover:bg-exa-primary/90"
                  >
                    Continuar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep('vin-input')}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Atrás
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Paso 3: Registro Final */}
            {currentStep === 'final-registration' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Resumen del vehículo */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Información del Vehículo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {registrationPath === 'vin' && vinData ? (
                      <>
                        <div>
                          <span className="text-gray-400">Vehículo:</span>
                          <p className="text-white">{vinData.make} {vinData.model}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Año:</span>
                          <p className="text-white">{vinData.model_year}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Tipo:</span>
                          <p className="text-white">{vinData.body_type}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-gray-400">Vehículo:</span>
                          <p className="text-white">{makeValue} {modelValue}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Año:</span>
                          <p className="text-white">{yearValue}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Tipo:</span>
                          <p className="text-white">{bodyTypeValue}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Datos de Registro */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Datos de Registro
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        VIN
                      </label>
                      <Input
                        {...register('vin')}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="VIN del vehículo"
                      />
                      {errors.vin && (
                        <p className="mt-1 text-sm text-red-400">{errors.vin.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Placa (Opcional)
                      </label>
                      <Input
                        {...register('license_plate')}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="Ej: ABC123"
                      />
                      {errors.license_plate && (
                        <p className="mt-1 text-sm text-red-400">{errors.license_plate.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Configuración de capacidad */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Configuración de Capacidad de Carga
                  </h3>

                  {/* Capacidad de peso */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Capacidad de Peso (Libras)
                      </label>
                      <Input
                        type="number"
                        {...register('capacity_weight_lbs', {
                          valueAsNumber: true,
                          onChange: (e) => handleWeightLbsChange(e.target.value)
                        })}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="4000"
                      />
                      {errors.capacity_weight_lbs && (
                        <p className="mt-1 text-sm text-red-400">{errors.capacity_weight_lbs.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Capacidad de Peso (Kilogramos)
                      </label>
                      <Input
                        type="number"
                        {...register('capacity_weight_kg', {
                          valueAsNumber: true,
                          onChange: (e) => handleWeightKgChange(e.target.value)
                        })}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="1814"
                      />
                      {errors.capacity_weight_kg && (
                        <p className="mt-1 text-sm text-red-400">{errors.capacity_weight_kg.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Capacidad de volumen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Capacidad de Volumen (Pies Cúbicos)
                      </label>
                      <Input
                        type="number"
                        {...register('capacity_volume_cubic_ft', {
                          valueAsNumber: true,
                          onChange: (e) => handleVolumeCubicFtChange(e.target.value)
                        })}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="500"
                      />
                      {errors.capacity_volume_cubic_ft && (
                        <p className="mt-1 text-sm text-red-400">{errors.capacity_volume_cubic_ft.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Capacidad de Volumen (Metros Cúbicos)
                      </label>
                      <Input
                        type="number"
                        {...register('capacity_volume_cubic_m', {
                          valueAsNumber: true,
                          onChange: (e) => handleVolumeCubicMChange(e.target.value)
                        })}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="14.2"
                        step="0.1"
                      />
                      {errors.capacity_volume_cubic_m && (
                        <p className="mt-1 text-sm text-red-400">{errors.capacity_volume_cubic_m.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Documentación del Seguro */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FileImage className="w-5 h-5" />
                    Documentación del Seguro
                  </h3>

                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <div className="text-white">
                        <p className="mb-2">Subir archivo del seguro</p>
                        <p className="text-sm text-gray-400 mb-4">
                          PDF, JPG o PNG (máximo 10MB)
                        </p>
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="insurance-upload"
                      />
                      <label
                        htmlFor="insurance-upload"
                        className="inline-flex items-center px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md hover:bg-white/20 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Seleccionar Archivos
                      </label>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-gray-300">Archivos seleccionados:</p>
                        {uploadedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white/5 rounded p-2"
                          >
                            <div className="flex items-center gap-2">
                              <FileImage className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-white truncate">
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-exa-primary hover:bg-exa-primary/90"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Registrando vehículo...
                      </div>
                    ) : (
                      'Registrar Vehículo'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => registrationPath === 'vin' ? setCurrentStep('vin-input') : setCurrentStep('manual-info')}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Atrás
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Card>
    </div>
  );
}