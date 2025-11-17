'use client'

import React, { useState, useEffect } from 'react'
import { Printer, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { motion } from 'framer-motion'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import {
  generateShippingLabelHTML,
  type ShippingLabelData
} from '../templates/shipping-label-template'

interface Label {
  id: string
  trackingCode: string
  serviceName: string
  serviceId: number
  boxNumber: number
  totalBoxes: number
  boxCode: string
  sender: string
  senderPhone: string
  senderAddress: string
  recipient: string
  recipientPhone: string
  recipientAddress: string
  recipientCity: string
  recipientState: string
  weight: string
  weightKg: string
  contentTypes: string[]
  companyName: string
  // Códigos de barras y QR como base64
  barcodeDataUrl?: string
  qrCodeDataUrl?: string
  warehouseBarcodeDataUrl?: string
}

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function LabelGenerationStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [labels, setLabels] = useState<Label[]>([])
  const [generating, setGenerating] = useState(false)
  const [barcodeImages, setBarcodeImages] = useState<Record<string, string>>({})
  const [qrCodeImages, setQrCodeImages] = useState<Record<string, string>>({})
  const [warehouseBarcodeImage, setWarehouseBarcodeImage] = useState<string>('')

  // Función para obtener el nombre de la compañía desde las cookies
  const getCompanyNameFromCookies = (): string => {
    try {
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === 'user-company-name') {
          return decodeURIComponent(value)
        }
      }
    } catch (error) {
      console.error('Error reading company name from cookies:', error)
    }
    return 'LogiRapid'
  }

  // Generar código de barras como Data URL
  const generateBarcodeDataUrl = (code: string): string => {
    try {
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: false,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000'
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error generating barcode:', error)
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  }

  // Generar código QR como Data URL
  const generateQRCodeDataUrl = async (trackingCode: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(trackingCode, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    } catch (error) {
      console.error('Error generating QR code:', error)
      return ''
    }
  }

  // Convertir lb a kg
  const convertLbToKg = (weightLb: string): string => {
    const match = weightLb.match(/[\d.]+/)
    if (!match) return ''
    const lb = parseFloat(match[0])
    if (isNaN(lb)) return ''
    const kg = (lb * 0.453592).toFixed(2)
    return `${kg} kg`
  }

  useEffect(() => {
    generateLabels()
    setCanProceed(true)
  }, [])

  const generateLabels = async () => {
    setGenerating(true)
    const newLabels: Label[] = []
    const newBarcodes: Record<string, string> = {}
    const newQRCodes: Record<string, string> = {}

    // Generar barcode del almacén PRIMERO
    let warehouseBarcodeDataUrl = ''
    if (wizardData.warehouse?.code) {
      warehouseBarcodeDataUrl = generateBarcodeDataUrl(wizardData.warehouse.code)
      setWarehouseBarcodeImage(warehouseBarcodeDataUrl)
    }

    // Función helper para formatear dirección
    const formatAddress = (person: any) => {
      if (!person) return 'N/A'

      const parts = []
      if (person.address) {
        parts.push(person.address)
      } else {
        // Construir dirección desde partes
        const streetParts = []
        if (person.street) streetParts.push(person.street)
        if (person.apartment) streetParts.push(person.apartment)
        if (streetParts.length) parts.push(streetParts.join(', '))

        const cityParts = []
        if (person.city) cityParts.push(person.city)
        if (person.state) cityParts.push(person.state)
        if (person.zipCode) cityParts.push(person.zipCode)
        if (cityParts.length) parts.push(cityParts.join(', '))
      }
      return parts.join('\n') || 'Dirección no disponible'
    }

    const companyName = getCompanyNameFromCookies()

    for (const [configIndex, config] of wizardData.serviceConfigs.entries()) {
      for (const [boxIndex, box] of config.boxes.entries()) {
        // Generar código único mejorado
        const timestamp = Date.now().toString(36).toUpperCase()
        const random = Math.random().toString(36).substring(2, 5).toUpperCase()
        const boxCode = box.boxCode || `CR-${timestamp}-${random}`

        const weightStr = box.weight ? `${box.weight} lb` : 'N/A'
        const weightKg = box.weight ? convertLbToKg(weightStr) : ''

        // Generar código de barras y QR primero
        const barcodeDataUrl = generateBarcodeDataUrl(boxCode)
        const qrCodeDataUrl = await generateQRCodeDataUrl(boxCode)

        const label: Label = {
          id: `${configIndex}-${boxIndex}`,
          trackingCode: boxCode,
          serviceName: config.serviceName,
          serviceId: config.serviceId,
          boxNumber: boxIndex + 1,
          totalBoxes: config.boxes.length,
          boxCode: boxCode,
          sender: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`,
          senderPhone: wizardData.sender.phone,
          senderAddress: formatAddress(wizardData.sender),
          recipient: wizardData.recipient
            ? `${wizardData.recipient.firstName} ${wizardData.recipient.lastName}`
            : 'Por asignar',
          recipientPhone: wizardData.recipient?.phone || '',
          recipientAddress: formatAddress(wizardData.recipient),
          recipientCity: wizardData.recipient?.city || '',
          recipientState: wizardData.recipient?.state || '',
          weight: weightStr,
          weightKg: weightKg,
          contentTypes: box.contentTypeIds || [],
          companyName: companyName,
          // Guardar las imágenes base64 en la etiqueta
          barcodeDataUrl: barcodeDataUrl,
          qrCodeDataUrl: qrCodeDataUrl,
          warehouseBarcodeDataUrl: warehouseBarcodeDataUrl
        }

        // Mantener también en los estados para la vista previa
        newBarcodes[label.id] = barcodeDataUrl
        newQRCodes[label.id] = qrCodeDataUrl

        newLabels.push(label)
      }
    }

    setLabels(newLabels)
    setBarcodeImages(newBarcodes)
    setQrCodeImages(newQRCodes)
    updateWizardData('labels', newLabels)
    setTimeout(() => setGenerating(false), 1000)
  }

  const printLabel = (label: Label) => {
    const labelData: ShippingLabelData = {
      companyName: label.companyName,
      boxNumber: label.boxNumber,
      totalBoxes: label.totalBoxes,
      boxCode: label.boxCode,
      sender: {
        name: label.sender,
        address: label.senderAddress,
        phone: label.senderPhone
      },
      recipient: {
        name: label.recipient,
        address: label.recipientAddress,
        phone: label.recipientPhone,
        city: label.recipientCity,
        state: label.recipientState
      },
      service: {
        name: label.serviceName,
        weight: label.weight,
        weightKg: label.weightKg
      },
      warehouse: {
        code: wizardData.warehouse?.code || 'N/A',
        name: wizardData.warehouse?.name || '',
        city: wizardData.warehouse?.city || ''
      },
      // Usar los datos guardados en la etiqueta
      barcodeDataUrl: label.barcodeDataUrl || '',
      qrCodeDataUrl: label.qrCodeDataUrl || '',
      warehouseBarcodeDataUrl: label.warehouseBarcodeDataUrl || ''
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const html = generateShippingLabelHTML(labelData)
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  const printAllLabels = () => {
    labels.forEach((label, index) => {
      setTimeout(() => printLabel(label), index * 500)
    })
  }

  const printServiceLabels = (serviceId: number) => {
    const serviceLabels = labels.filter(l => l.serviceId === serviceId)
    serviceLabels.forEach((label, index) => {
      setTimeout(() => printLabel(label), index * 500)
    })
  }

  // Agrupar etiquetas por servicio
  const groupedLabels = labels.reduce((acc, label) => {
    if (!acc[label.serviceName]) {
      acc[label.serviceName] = []
    }
    acc[label.serviceName].push(label)
    return acc
  }, {} as Record<string, Label[]>)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
            "bg-gradient-to-br",
            theme === 'dark'
              ? "from-indigo-600 to-indigo-700 shadow-indigo-500/30"
              : "from-indigo-500 to-indigo-600 shadow-indigo-400/30"
          )}
        >
          <Printer className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Etiquetas de Envío 4x6
          </h2>
          <p className={cn("text-base", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            {labels.length} {labels.length === 1 ? 'etiqueta lista' : 'etiquetas listas'} para impresión térmica
          </p>
        </div>
      </div>

      {/* Action Buttons - Solo Imprimir Todas */}
      <div className="flex justify-center">
        <Button
          onClick={printAllLabels}
          size="lg"
          className={cn(
            "flex items-center gap-2 shadow-lg",
            "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          )}
        >
          <Printer className="w-5 h-5" />
          Imprimir Todas ({labels.length})
        </Button>
      </div>

      {/* Labels by Service */}
      <div className="space-y-6">
        {Object.entries(groupedLabels).map(([serviceName, serviceLabels], groupIndex) => (
          <motion.div
            key={serviceName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.1 }}
            className={cn(
              "p-6 rounded-2xl border shadow-xl",
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            {/* Service Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-lg",
                  theme === 'dark' ? 'bg-blue-600/20' : 'bg-blue-100'
                )}>
                  <Package className={cn(
                    "w-6 h-6",
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )} />
                </div>
                <div>
                  <h3 className={cn(
                    "font-bold text-xl",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {serviceName}
                  </h3>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {serviceLabels.length} {serviceLabels.length === 1 ? 'etiqueta' : 'etiquetas'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => printServiceLabels(serviceLabels[0].serviceId)}
                size="default"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4" />
                Imprimir Servicio
              </Button>
            </div>

            {/* Labels Grid - Vista previa realista */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {serviceLabels.map((label, index) => (
                <motion.div
                  key={label.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "relative rounded-xl border-2 overflow-hidden shadow-lg",
                    theme === 'dark'
                      ? 'bg-white border-gray-600'
                      : 'bg-white border-gray-300'
                  )}
                  style={{ aspectRatio: '4/6' }}
                >
                  {/* Etiqueta Preview - Diseño 4x6 FONDO BLANCO */}
                  <div className="w-full h-full p-1.5 flex flex-col text-black bg-white relative">
                    {/* Header */}
                    <div className="text-center py-1 px-1.5 mb-0.5 bg-white">
                      <div className="font-bold text-base tracking-wide uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {label.companyName}
                      </div>
                    </div>

                    {/* Box Info */}
                    <div className="text-center py-1 px-1.5 mb-0.5 text-[11px] font-bold bg-white">
                      CAJA {label.boxNumber} DE {label.totalBoxes}
                    </div>

                    {/* Direcciones + QR (Dos columnas) */}
                    <div className="p-1 mb-0.5 flex gap-1.5 bg-white">
                      {/* Columna de Direcciones (70%) */}
                      <div className="flex-[0_0_70%] flex flex-col gap-1">
                        {/* Sender */}
                        <div className="flex-shrink-0">
                          <div className="text-[8px] font-bold uppercase mb-0.5">DE (REMITENTE):</div>
                          <div className="text-[10px]">
                            <div className="font-bold text-[11px]">{label.sender}</div>
                            <div className="text-[9px] line-clamp-2">{label.senderAddress.split('\n')[0]}</div>
                            <div className="text-[9px]">Tel: {label.senderPhone}</div>
                          </div>
                        </div>

                        {/* Recipient */}
                        <div className="flex-shrink-0">
                          <div className="text-[8px] font-bold uppercase mb-0.5">PARA (DESTINATARIO):</div>
                          <div className="text-[10px]">
                            <div className="font-bold text-[11px]">{label.recipient}</div>
                            <div className="text-[9px] line-clamp-2">{label.recipientAddress.split('\n')[0]}</div>
                            {label.recipientPhone && <div className="text-[9px]">Tel: {label.recipientPhone}</div>}
                          </div>
                        </div>
                      </div>

                      {/* Columna de QR Code (30%) */}
                      {qrCodeImages[label.id] && (
                        <div className="flex-[0_0_calc(30%-0.375rem)] flex flex-col items-center justify-center">
                          <img
                            src={qrCodeImages[label.id]}
                            alt="QR"
                            className="w-14 h-14 mb-0.5"
                          />
                          <div className="text-[7px] font-bold">SCAN</div>
                        </div>
                      )}
                    </div>

                    {/* Provincia/Municipio */}
                    {(label.recipientCity || label.recipientState) && (
                      <div className="text-center py-1.5 px-1 mb-0.5 bg-white">
                        {label.recipientCity && (
                          <div className="text-base font-extrabold uppercase tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            {label.recipientCity}
                          </div>
                        )}
                        {label.recipientState && (
                          <div className="text-[11px] font-semibold mt-0.5">
                            {label.recipientState}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Service */}
                    <div className="bg-white p-1 mb-0 text-[11px] flex-shrink-0">
                      <div className="mb-0.5"><strong>Servicio:</strong> {label.serviceName}</div>
                      <div className="font-bold"><strong>Peso:</strong> {label.weight}{label.weightKg && ` (${label.weightKg})`}</div>
                    </div>

                    {/* Códigos de Barra Apilados (Almacén + Empaque) */}
                    <div className="mt-auto py-0.5 px-1 bg-white flex flex-col gap-1 text-center">
                      {/* Código de Almacén (Arriba) */}
                      {warehouseBarcodeImage && (
                        <div className="flex flex-col items-center gap-px">
                          <div className="text-[8px] font-bold uppercase tracking-wide mb-px">ALMACÉN</div>
                          <img
                            src={warehouseBarcodeImage}
                            alt="Warehouse"
                            className="w-full max-w-[160px] h-auto"
                          />
                          <div className="font-mono text-[10px] font-bold tracking-wide mt-px">
                            {wizardData.warehouse?.code || 'N/A'}
                          </div>
                        </div>
                      )}

                      {/* Código de Empaque (Abajo) */}
                      <div className="flex flex-col items-center gap-px">
                        <div className="text-[8px] font-bold uppercase tracking-wide mb-px">CÓDIGO DE EMPAQUE</div>
                        {barcodeImages[label.id] && (
                          <img
                            src={barcodeImages[label.id]}
                            alt="Tracking"
                            className="w-full max-w-[160px] h-auto"
                          />
                        )}
                        <div className="font-mono text-[10px] font-bold tracking-wide mt-px">
                          {label.boxCode}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print Button Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <Button
                      onClick={() => printLabel(label)}
                      size="sm"
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Esta Etiqueta
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
