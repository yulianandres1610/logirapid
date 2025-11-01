'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Upload, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface VehiclePhotoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
  disabled?: boolean;
  vinData?: any;
  autoPhotoFromAPI?: boolean;
}

export function VehiclePhotoUpload({
  value,
  onChange,
  className = '',
  disabled = false,
  vinData,
  autoPhotoFromAPI = false
}: VehiclePhotoUploadProps) {
  const { theme } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Create a local URL for the image (in production, upload to cloud storage)
      const imageUrl = URL.createObjectURL(file);

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      onChange(imageUrl);
    } catch (error) {
      setError('Error al subir la imagen. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const removePhoto = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      <AnimatePresence mode="wait">
        {value ? (
          // Photo preview
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative group"
          >
            <div className={cn(
              "relative aspect-square rounded-2xl overflow-hidden border-2",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700"
                : "bg-gray-100 border-gray-200"
            )}>
              <img
                src={value}
                alt="Vehículo"
                className="w-full h-full object-cover"
              />

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                  >
                    <Camera className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={disabled}
                    className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* Photo source indicator */}
              <div className="absolute top-3 right-3">
                {autoPhotoFromAPI ? (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center" title="Foto de Auto.dev API">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center" title="Foto subida manualmente">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          // Upload area
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={cn(
                'relative aspect-square rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden',
                isDragging
                  ? theme === 'dark'
                    ? 'border-blue-500 bg-blue-900/20 scale-102'
                    : 'border-blue-500 bg-blue-50 scale-102'
                  : theme === 'dark'
                    ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Upload content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <AnimatePresence mode="wait">
                  {isUploading ? (
                    <motion.div
                      key="uploading"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <div className="w-12 h-12 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-300" : "text-gray-600"
                      )}>
                        Subiendo foto...
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex flex-col items-center text-center"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center mb-3",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                      )}>
                        <Camera className={cn(
                          "w-8 h-8",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          "text-sm font-medium mb-1",
                          theme === 'dark' ? "text-gray-200" : "text-gray-700"
                        )}>
                          Añadir foto del vehículo
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Arrastra una imagen o haz clic para seleccionar
                        </p>
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? "text-gray-500" : "text-gray-400"
                        )}>
                          PNG, JPG hasta 5MB
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Upload hint icon */}
              <div className="absolute top-3 right-3">
                <Upload className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                )} />
              </div>
            </div>

            {/* API Photos Section */}
            {vinData?.photo_urls && vinData.photo_urls.length > 0 && (
              <div className="mt-4">
                <p className={cn(
                  "text-sm font-medium mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  Fotos disponibles de Auto.dev:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {vinData.photo_urls.map((photoUrl: string, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onChange(photoUrl)}
                      disabled={disabled}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200",
                        value === photoUrl
                          ? theme === 'dark'
                            ? "border-blue-500 ring-2 ring-blue-500/50"
                            : "border-blue-500 ring-2 ring-blue-200"
                          : theme === 'dark'
                            ? "border-gray-700 hover:border-gray-600"
                            : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      <img
                        src={photoUrl}
                        alt={`Foto del vehículo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.classList.add('hidden');
                        }}
                      />
                      {value === photoUrl && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 flex items-center gap-2 text-red-600 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}