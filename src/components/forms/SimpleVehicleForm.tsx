'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Camera, FileText, AlertCircle, Save, Car, Settings, Search, Shield, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleVehicleFormProps {
  onSuccess?: (vehicle: any) => void;
  onCancel?: () => void;
}

export function SimpleVehicleForm({ onSuccess, onCancel }: SimpleVehicleFormProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [insuranceDocs, setInsuranceDocs] = useState<File[]>([]);

  // Estados para el flujo del formulario
  const [registrationType, setRegistrationType] = useState<'vin' | 'manual' | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [vin, setVin] = useState('');

  const [formData, setFormData] = useState({
    vin: '',
    license_plate: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    body_type: 'Sedan',
    color: '',
    nickname: '',
    empty_boxes: 0,
    full_boxes: 0,
    can_collect_durable: false,
    status: 'ACTIVE',
    availability: 'AVAILABLE'
  });

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const handleFileChange = (files: FileList | null, type: 'photos' | 'insurance') => {
    if (!files) return;

    const fileList = type === 'photos' ? photos : insuranceDocs;
    const newFiles = Array.from(files).slice(0, 5 - fileList.length);

    if (type === 'photos') {
      setPhotos(prev => [...prev, ...newFiles]);
    } else {
      setInsuranceDocs(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number, type: 'photos' | 'insurance') => {
    if (type === 'photos') {
      setPhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setInsuranceDocs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    if (!registrationType) {
      setError('Por favor selecciona un tipo de registro');
      return false;
    }

    if (registrationType === 'vin' && !formData.vin.trim()) {
      setError('El VIN es requerido para registro con VIN');
      return false;
    }

    if (!formData.license_plate.trim()) {
      setError('La placa es requerida');
      return false;
    }
    if (!formData.make.trim()) {
      setError('La marca es requerida');
      return false;
    }
    if (!formData.model.trim()) {
      setError('El modelo es requerido');
      return false;
    }
    if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      setError('El año no es válido');
      return false;
    }
    return true;
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];

    for (const file of files) {
      // For now, create placeholder URLs
      urls.push(`/uploads/${file.name}`);
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Upload files and get URLs
      const photoUrls = await uploadFiles(photos);
      const insuranceUrls = await uploadFiles(insuranceDocs);

      const vehicleData = {
        ...formData,
        // Generar VIN automáticamente si está vacío solo en modo manual
        vin: registrationType === 'manual'
          ? `MANUAL${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
          : formData.vin.trim(),
        photos: photoUrls,
        insurance_documents: insuranceUrls
      };

      const response = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess?.(result.data);
        // Reset form
        setFormData({
          vin: '',
          license_plate: '',
          make: '',
          model: '',
          year: new Date().getFullYear(),
          body_type: 'Sedan',
          color: '',
          nickname: '',
          empty_boxes: 0,
          full_boxes: 0,
          can_collect_durable: false,
          status: 'ACTIVE',
          availability: 'AVAILABLE'
        });
        setPhotos([]);
        setInsuranceDocs([]);
        setRegistrationType(null);
        setCurrentStep(1);
        setVin('');
      } else {
        setError(result.error || 'Error al crear el vehículo');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
      console.error('Error creating vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  // Componente de indicadores de paso
  const StepIndicator = ({ step, title, icon: Icon, isActive, isCompleted }: {
    step: number;
    title: string;
    icon: any;
    isActive: boolean;
    isCompleted: boolean;
  }) => (
    <div className="flex items-center">
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
        isActive ? "bg-blue-600 text-white" :
        isCompleted ? "bg-green-600 text-white" :
        "bg-gray-700 text-gray-400"
      )}>
        {isCompleted ? (
          <Check className="w-5 h-5" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>
      <span className={cn(
        "ml-2 text-sm font-medium",
        isActive || isCompleted ? "text-white" : "text-gray-400"
      )}>
        {title}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border p-8 bg-gray-900/50 border-gray-800 backdrop-blur-lg">
      <div className="w-full max-w-2xl mx-auto">
        {/* Indicadores de paso */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <StepIndicator
              step={1}
              title="VIN"
              icon={Search}
              isActive={currentStep === 1}
              isCompleted={currentStep > 1}
            />
            <div className="flex-1 mx-4 h-0.5 bg-gray-700"></div>
            <StepIndicator
              step={2}
              title="Información"
              icon={Car}
              isActive={currentStep === 2}
              isCompleted={currentStep > 2}
            />
            <div className="flex-1 mx-4 h-0.5 bg-gray-700"></div>
            <StepIndicator
              step={3}
              title="Registro"
              icon={Shield}
              isActive={currentStep === 3}
              isCompleted={false}
            />
          </div>
        </div>

        {/* Contenido principal */}
        <div className="rounded-xl text-gray-950 backdrop-blur-lg shadow-2xl p-8 border bg-gray-900/95 border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={cn(
                "p-3 rounded-lg flex items-center gap-2",
                theme === 'dark'
                  ? "bg-red-900/20 border border-red-800 text-red-300"
                  : "bg-red-50 border border-red-200 text-red-700"
              )}>
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Paso 1: Selección de tipo de registro */}
            {currentStep === 1 && (
              <div className="space-y-6" style={{ opacity: 1, transform: 'none' }}>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-900/50">
                    <Search className="w-10 h-10 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-white">
                    ¿Cómo deseas registrar el vehículo?
                  </h2>
                  <p className="text-gray-400">
                    Selecciona una de las siguientes opciones para continuar
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-lg border-2",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 hover:border-blue-500"
                        : "bg-gray-50 border-gray-200 hover:border-blue-500"
                    )}
                    onClick={() => {
                      setRegistrationType('vin');
                      setCurrentStep(2);
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center",
                          theme === 'dark' ? "bg-green-900/50" : "bg-green-100"
                        )}>
                          <Search className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )} />
                        </div>
                        <div>
                          <h4 className={cn(
                            "font-semibold text-lg mb-1",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            Registro con VIN
                          </h4>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Ingresa el VIN del vehículo para obtener datos precisos
                          </p>
                        </div>
                        <div className={cn(
                          "px-4 py-2 rounded-full text-xs font-medium",
                          theme === 'dark'
                            ? "bg-green-900/30 text-green-300 border border-green-700"
                            : "bg-green-100 text-green-700 border border-green-200"
                        )}>
                          Datos precisos
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-lg border-2",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 hover:border-blue-500"
                        : "bg-gray-50 border-gray-200 hover:border-blue-500"
                    )}
                    onClick={() => {
                      setRegistrationType('manual');
                      setCurrentStep(2);
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center",
                          theme === 'dark' ? "bg-blue-900/50" : "bg-blue-100"
                        )}>
                          <Settings className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? "text-blue-400" : "text-blue-600"
                          )} />
                        </div>
                        <div>
                          <h4 className={cn(
                            "font-semibold text-lg mb-1",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            Registro Manual
                          </h4>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Ingresa los datos manualmente. El VIN se genera automáticamente
                          </p>
                        </div>
                        <div className={cn(
                          "px-4 py-2 rounded-full text-xs font-medium",
                          theme === 'dark'
                            ? "bg-blue-900/30 text-blue-300 border border-blue-700"
                            : "bg-blue-100 text-blue-700 border border-blue-200"
                        )}>
                          Rápido y sencillo
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Paso 2: Información del vehículo */}
            {currentStep === 2 && (
              <div className="space-y-6" style={{ opacity: 1, transform: 'none' }}>
                <div className="flex items-center justify-between mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                      setRegistrationType(null);
                    }}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                  </button>
                  <h2 className="text-xl font-semibold text-white">
                    Información del Vehículo
                  </h2>
                  <div className="w-16"></div>
                </div>

                {/* Campo VIN - Solo se muestra en modo VIN */}
                {registrationType === 'vin' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-900/50">
                        <Search className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-white">
                        Ingresa el VIN de tu vehículo
                      </h3>
                      <p className="text-gray-400">
                        Introduce el número de identificación de 17 caracteres
                      </p>
                    </div>

                    <div>
                      <Input
                        id="vin"
                        value={formData.vin}
                        onChange={(e) => handleInputChange('vin', e.target.value.toUpperCase())}
                        placeholder="Ej: 5FNYF8H52RB020006"
                        className={cn(
                          "text-center text-lg font-mono h-14",
                          theme === 'dark'
                            ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                        )}
                        maxLength={17}
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleInputChange('vin', '')}
                        className={cn(
                          "flex-1",
                          theme === 'dark'
                            ? "border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        Limpiar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        disabled={!formData.vin.trim()}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Continuar
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Formulario completo para modo manual o después de VIN */}
                {(registrationType === 'manual' || (registrationType === 'vin' && formData.vin.trim())) && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Espacio para VIN en modo manual */}
                      {registrationType === 'manual' && (
                        <div className="space-y-2">
                          <Label className={cn(
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            VIN (Generado automáticamente)
                          </Label>
                          <div className={cn(
                            "px-3 py-2 rounded-lg border text-sm",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-gray-400"
                              : "bg-gray-100 border-gray-300 text-gray-500"
                          )}>
                            Se generará automáticamente al guardar
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="license_plate" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Placa *
                        </Label>
                        <Input
                          id="license_plate"
                          value={formData.license_plate}
                          onChange={(e) => handleInputChange('license_plate', e.target.value.toUpperCase())}
                          placeholder="Ej: ABC123"
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="make" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Marca *
                        </Label>
                        <Input
                          id="make"
                          value={formData.make}
                          onChange={(e) => handleInputChange('make', e.target.value)}
                          placeholder="Ej: Toyota, Honda, Ford"
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="model" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Modelo *
                        </Label>
                        <Input
                          id="model"
                          value={formData.model}
                          onChange={(e) => handleInputChange('model', e.target.value)}
                          placeholder="Ej: Corolla, Accord, F-150"
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="year" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Año *
                        </Label>
                        <Input
                          id="year"
                          type="number"
                          value={formData.year}
                          onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                          min="1900"
                          max={new Date().getFullYear() + 1}
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body_type" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Tipo de Vehículo
                        </Label>
                        <Select value={formData.body_type} onValueChange={(value) => handleInputChange('body_type', value)}>
                          <SelectTrigger className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}>
                            <SelectValue placeholder="Selecciona el tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sedan">Sedán</SelectItem>
                            <SelectItem value="SUV">SUV</SelectItem>
                            <SelectItem value="Pickup">Pickup</SelectItem>
                            <SelectItem value="Van">Van</SelectItem>
                            <SelectItem value="Truck">Camión</SelectItem>
                            <SelectItem value="Motorcycle">Motocicleta</SelectItem>
                            <SelectItem value="Other">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="color" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Color
                        </Label>
                        <Input
                          id="color"
                          value={formData.color}
                          onChange={(e) => handleInputChange('color', e.target.value)}
                          placeholder="Ej: Blanco, Negro, Azul"
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nickname" className={cn(
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Apodo (Opcional)
                        </Label>
                        <Input
                          id="nickname"
                          value={formData.nickname}
                          onChange={(e) => handleInputChange('nickname', e.target.value)}
                          placeholder="Ej: Camión de Carga, Vehículo de Reparto"
                          className={cn(
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Continuar al registro
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Paso 3: Resumen y registro */}
            {currentStep === 3 && (
              <div className="space-y-6" style={{ opacity: 1, transform: 'none' }}>
                <div className="flex items-center justify-between mb-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                  </button>
                  <h2 className="text-xl font-semibold text-white">
                    Confirmar Registro
                  </h2>
                  <div className="w-16"></div>
                </div>

                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-900/50">
                    <Shield className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">
                    Revisa la información
                  </h3>
                  <p className="text-gray-400">
                    Confirma que todos los datos son correctos antes de guardar
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-lg",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                )}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={cn("font-medium", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        Tipo de Registro:
                      </span>
                      <p className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {registrationType === 'vin' ? 'Con VIN' : 'Manual'}
                      </p>
                    </div>
                    <div>
                      <span className={cn("font-medium", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        Placa:
                      </span>
                      <p className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formData.license_plate || 'No especificada'}
                      </p>
                    </div>
                    <div>
                      <span className={cn("font-medium", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        Marca:
                      </span>
                      <p className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formData.make || 'No especificada'}
                      </p>
                    </div>
                    <div>
                      <span className={cn("font-medium", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        Modelo:
                      </span>
                      <p className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formData.model || 'No especificado'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Vehículo
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}