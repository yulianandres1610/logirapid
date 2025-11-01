'use client'

import React, { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { BarcodeGenerator } from './barcode-generator'
import { Box } from '@/lib/package-types'

interface PackageLabelPrinterProps {
  box: Box
  isVisible: boolean
  onClose: () => void
}

export function PackageLabelPrinter({ box, isVisible, onClose }: PackageLabelPrinterProps) {
  const labelRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateLabelPDF = async () => {
    if (!labelRef.current) return

    setIsGenerating(true)
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150] // Custom label size
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = (pdfHeight - imgHeight * ratio) / 2

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`Etiqueta_${box.barcode}.pdf`)
    } catch (error) {
      console.error('Error generating label PDF:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const printLabel = async () => {
    if (!labelRef.current) return

    setIsGenerating(true)
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const printWindow = window.open('', '_blank')

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Label - ${box.barcode}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  font-family: Arial, sans-serif;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border: 2px solid #000;
                }
                @media print {
                  body { padding: 0; }
                  img { border: none; }
                }
              </style>
            </head>
            <body>
              <img src="${imgData}" alt="Package Label" />
              <script>
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                    window.close();
                  }, 500);
                }
              </script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    } catch (error) {
      console.error('Error printing label:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Imprimir Etiqueta - {box.barcode}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Label Preview */}
        <div className="p-6 bg-gray-50">
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div
              ref={labelRef}
              className="w-full max-w-sm mx-auto bg-white p-6 border-2 border-black"
              style={{ aspectRatio: '2/3' }}
            >
              {/* Company Header */}
              <div className="text-center mb-4 border-b pb-2">
                <h3 className="text-lg font-bold">LogiRapid Logistics</h3>
                <p className="text-xs text-gray-600">Sistema de Gestión de Paquetes</p>
              </div>

              {/* Barcode */}
              <div className="mb-4">
                <BarcodeGenerator
                  value={box.barcode}
                  width={1.5}
                  height={60}
                  displayValue={true}
                  className="w-full"
                />
              </div>

              {/* Package Information */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">ID Paquete:</span>
                  <span>{box.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Tamaño:</span>
                  <span className="capitalize">{box.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Dimensiones:</span>
                  <span>
                    {box.dimensions.length}x{box.dimensions.width}x{box.dimensions.height}cm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Capacidad:</span>
                  <span>{box.dimensions.weight_capacity}kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Proveedor:</span>
                  <span>{box.supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Estado:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    box.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                    box.status === 'IN_USE' ? 'bg-blue-100 text-blue-700' :
                    box.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-700' :
                    box.status === 'DAMAGED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {box.status === 'AVAILABLE' ? 'Disponible' :
                     box.status === 'IN_USE' ? 'En Uso' :
                     box.status === 'MAINTENANCE' ? 'Mantenimiento' :
                     box.status === 'DAMAGED' ? 'Dañado' :
                     box.status === 'DISPOSED' ? 'Desechado' : box.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Fecha:</span>
                  <span>{new Date(box.created_at).toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-2 border-t text-center">
                <p className="text-xs text-gray-500">
                  www.logirapid.com | contacto@logirapid.com
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={printLabel}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {isGenerating ? 'Generando...' : 'Imprimir'}
            </button>
            <button
              onClick={generateLabelPDF}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isGenerating ? 'Generando...' : 'Guardar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PackageLabelPrinter