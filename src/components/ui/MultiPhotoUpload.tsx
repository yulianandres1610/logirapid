'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  Camera,
  FileText,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MultiPhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  className?: string;
  disabled?: boolean;
  maxFiles?: number;
  acceptedTypes?: string[];
}

interface PhotoFile {
  file: File;
  preview: string;
  type: 'vehicle' | 'insurance';
}

export function MultiPhotoUpload({
  value = [],
  onChange,
  className,
  disabled = false,
  maxFiles = 10,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
}: MultiPhotoUploadProps) {
  const { theme } = useTheme();
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Inicializar con URLs existentes (solo una vez)
  React.useEffect(() => {
    if (value.length > 0 && photos.length === 0) {
      const existingPhotos = value.map((url, index) => ({
        file: new File([], `existing-${index}`),
        preview: url,
        type: url.includes('insurance') || url.includes('seguro') ? 'insurance' : 'vehicle' as const
      }));
      setPhotos(existingPhotos);
    }
  }, []); // Sin dependencias para evitar bucles

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file =>
      acceptedTypes.includes(file.type)
    );

    if (validFiles.length !== fileArray.length) {
      alert('Algunos archivos no fueron aceptados. Solo se permiten imágenes y PDFs.');
      return;
    }

    if (photos.length + validFiles.length > maxFiles) {
      alert(`Solo se permiten ${maxFiles} archivos como máximo.`);
      return;
    }

    const newPhotos = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type === 'application/pdf' ? 'insurance' : 'vehicle' as const
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  }, [photos.length, maxFiles, acceptedTypes]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  }, []);

  const changePhotoType = useCallback((index: number, type: 'vehicle' | 'insurance') => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      newPhotos[index] = { ...newPhotos[index], type };
      return newPhotos;
    });
  }, []);

  // Actualizar URLs cuando cambian las fotos (evitando bucles)
  React.useEffect(() => {
    const urls = photos.map(photo => photo.preview);
    // Solo llamar onChange si las URLs realmente cambiaron
    if (JSON.stringify(urls) !== JSON.stringify(value)) {
      onChange(urls);
    }
  }, [photos, onChange, value]);

  const vehiclePhotos = photos.filter(p => p.type === 'vehicle');
  const insurancePhotos = photos.filter(p => p.type === 'insurance');

  return (
    <div className={cn("space-y-4", className)}>
      {/* Zona de carga */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          dragActive
            ? theme === 'dark'
              ? "border-blue-500 bg-blue-900/20"
              : "border-blue-500 bg-blue-50"
            : theme === 'dark'
              ? "border-gray-600 bg-gray-800/50 hover:border-gray-500"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="multi-photos"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled || photos.length >= maxFiles}
        />
        <label
          htmlFor="multi-photos"
          className={cn(
            "cursor-pointer flex flex-col items-center gap-3",
            (disabled || photos.length >= maxFiles) && "opacity-50 cursor-not-allowed"
          )}
        >
          <Upload className={cn(
            "w-8 h-8",
            theme === 'dark' ? "text-gray-400" : "text-gray-500"
          )} />
          <div>
            <p className={cn(
              "font-medium",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              {photos.length >= maxFiles
                ? `Máximo ${maxFiles} archivos alcanzados`
                : "Arrastra fotos aquí o haz clic para seleccionar"
              }
            </p>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )}>
              Imágenes (JPG, PNG, WebP) y PDFs (Máx. {maxFiles} archivos)
            </p>
          </div>
        </label>
      </div>

      {/* Fotos del vehículo */}
      {vehiclePhotos.length > 0 && (
        <div className="space-y-2">
          <h4 className={cn(
            "font-medium flex items-center gap-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            <Camera className="w-4 h-4" />
            Fotos del vehículo ({vehiclePhotos.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AnimatePresence>
              {vehiclePhotos.map((photo, index) => (
                <motion.div
                  key={`vehicle-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "relative group rounded-lg overflow-hidden border",
                    theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                  )}
                >
                  {photo.file.type === 'application/pdf' ? (
                    <div className="p-4 flex flex-col items-center">
                      <FileText className="w-8 h-8 text-red-500 mb-2" />
                      <p className="text-xs text-center truncate w-full">{photo.file.name}</p>
                    </div>
                  ) : (
                    <img
                      src={photo.preview}
                      alt={`Vehículo ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  )}

                  {/* Overlay con acciones */}
                  <div className={cn(
                    "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2",
                    disabled && "pointer-events-none"
                  )}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => changePhotoType(photos.indexOf(photo), 'insurance')}
                      className="text-white hover:bg-white/20 h-8 w-8 p-0"
                      title="Cambiar a seguro"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhoto(photos.indexOf(photo))}
                      className="text-red-500 hover:bg-red-500/20 h-8 w-8 p-0"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Fotos del seguro */}
      {insurancePhotos.length > 0 && (
        <div className="space-y-2">
          <h4 className={cn(
            "font-medium flex items-center gap-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            <FileText className="w-4 h-4" />
            Documentos del seguro ({insurancePhotos.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AnimatePresence>
              {insurancePhotos.map((photo, index) => (
                <motion.div
                  key={`insurance-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "relative group rounded-lg overflow-hidden border",
                    theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                  )}
                >
                  {photo.file.type === 'application/pdf' ? (
                    <div className="p-4 flex flex-col items-center">
                      <FileText className="w-8 h-8 text-red-500 mb-2" />
                      <p className="text-xs text-center truncate w-full">{photo.file.name}</p>
                    </div>
                  ) : (
                    <img
                      src={photo.preview}
                      alt={`Seguro ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  )}

                  {/* Overlay con acciones */}
                  <div className={cn(
                    "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2",
                    disabled && "pointer-events-none"
                  )}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => changePhotoType(photos.indexOf(photo), 'vehicle')}
                      className="text-white hover:bg-white/20 h-8 w-8 p-0"
                      title="Cambiar a vehículo"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhoto(photos.indexOf(photo))}
                      className="text-red-500 hover:bg-red-500/20 h-8 w-8 p-0"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Mensaje informativo */}
      <div className={cn(
        "text-xs p-3 rounded-lg border",
        theme === 'dark'
          ? "bg-blue-900/20 border-blue-800 text-blue-300"
          : "bg-blue-50 border-blue-200 text-blue-700"
      )}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Consejos para las fotos:</p>
            <ul className="space-y-1 text-xs">
              <li>• Fotos del vehículo: Frontal, lateral, trasera e interior</li>
              <li>• Documentos del seguro: Póliza, tarjeta de circulación</li>
              <li>• Puedes cambiar el tipo de cada foto usando los botones</li>
              <li>• Formatos aceptados: JPG, PNG, WebP y PDF</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}