'use client'

import React, { useRef } from 'react'
import { Download, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ReportHeaderProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isLoading?: boolean
  reportRef?: React.RefObject<HTMLDivElement>
}

export function ReportHeader({
  title,
  subtitle,
  onRefresh,
  isLoading = false,
  reportRef
}: ReportHeaderProps) {
  const handleExportPDF = async () => {
    if (!reportRef?.current) return

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Header
      pdf.setFontSize(16)
      pdf.text(title, 10, 15)
      pdf.setFontSize(10)
      pdf.setTextColor(128)
      pdf.text(`Generado: ${new Date().toLocaleString('es')}`, 10, 22)

      // Image content
      let yPos = 30
      let remainingHeight = imgHeight

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - 40)
        pdf.addImage(
          imgData,
          'PNG',
          10,
          yPos,
          imgWidth,
          imgHeight,
          undefined,
          'FAST'
        )

        remainingHeight -= sliceHeight
        if (remainingHeight > 0) {
          pdf.addPage()
          yPos = 10
        }
      }

      const filename = `${title.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          className="no-print"
        >
          <Download className="w-4 h-4 mr-2" />
          PDF
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="no-print"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>
    </div>
  )
}
