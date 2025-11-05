'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Printer, X } from 'lucide-react'
import QRCode from 'qrcode'

interface LabelPrinterProps {
  box: {
    id: string
    barcode: string
    size: string
    supplier: string
    cost: number
  }
  isOpen: boolean
  onClose: () => void
}

export function LabelPrinter({ box, isOpen, onClose }: LabelPrinterProps) {
  const { theme } = useTheme()
  const [isPrinting, setIsPrinting] = useState(false)
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate QR code using the real library
  useEffect(() => {
    if (box.barcode && isOpen) {
      generateQRCode()
    }
  }, [box.barcode, isOpen])

  const generateQRCode = async () => {
    setIsGenerating(true)

    try {
      console.log('Generating QR for:', box.barcode)

      // Generate QR code using the real library
      const qrDataUrl = await QRCode.toDataURL(box.barcode, {
        width: 240,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M' // Medium error correction
      })

      console.log('QR generated successfully')
      setBarcodeDataUrl(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)

      // Create fallback QR with text
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        canvas.width = 300
        canvas.height = 300
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw a simple pattern as fallback
        ctx.fillStyle = 'black'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('PKG', canvas.width / 2, canvas.height / 2 - 30)
        ctx.font = 'bold 24px monospace'
        ctx.fillText(box.barcode, canvas.width / 2, canvas.height / 2 + 20)

        const fallbackUrl = canvas.toDataURL()
        setBarcodeDataUrl(fallbackUrl)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const printLabel = () => {
    if (!barcodeDataUrl) return

    setIsPrinting(true)

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=400')

    if (printWindow) {
      const labelContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code ${box.barcode}</title>
            <style>
              @page {
                size: 2in 2in;
                margin: 0;
              }

              body {
                margin: 0;
                padding: 0;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }

              .label-container {
                width: 2in;
                height: 2in;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #ccc;
              }

              .qr-image {
                max-width: 85%;
                max-height: 85%;
                object-fit: contain;
              }

              @media print {
                body {
                  margin: 0;
                  padding: 0;
                  background: white;
                }
                .label-container {
                  border: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="label-container">
              <img src="${barcodeDataUrl}" alt="QR Code" class="qr-image" />
            </div>
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
      `

      printWindow.document.write(labelContent)
      printWindow.document.close()

      setTimeout(() => {
        setIsPrinting(false)
      }, 1000)
    } else {
      setIsPrinting(false)
    }
  }

  const downloadImage = () => {
    if (barcodeDataUrl) {
      const a = document.createElement('a')
      a.href = barcodeDataUrl
      a.download = `barcode_${box.barcode}.png`
      a.click()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={cn(
        "rounded-2xl shadow-2xl max-w-md w-full",
        theme === 'dark' ? "bg-gray-900" : "bg-white"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-6 border-b",
          theme === 'dark' ? "border-gray-700" : "border-gray-200"
        )}>
          <h2 className={cn(
            "text-xl font-semibold",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Imprimir Etiqueta - {box.barcode}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className={cn(
          "p-6",
          theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
        )}>
          <div className={cn(
            "rounded-lg shadow-lg p-6 mb-4 mx-auto",
            theme === 'dark' ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          )} style={{ width: '300px' }}>
            <div
              className="bg-white border-2 border-gray-800 mx-auto flex items-center justify-center"
              style={{
                width: '260px',
                height: '260px',
                aspectRatio: '1/1',
                padding: '5px'
              }}
            >
              {barcodeDataUrl ? (
                <img
                  src={barcodeDataUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-black text-sm font-mono font-bold text-center">
                  {isGenerating ? 'Generando QR...' : 'Esperando...'}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={printLabel}
              disabled={isPrinting || !barcodeDataUrl || isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isPrinting ? 'Imprimiendo...' : isGenerating ? 'Generando...' : 'Imprimir'}
            </Button>

            <Button
              onClick={downloadImage}
              disabled={!barcodeDataUrl || isGenerating}
              variant="outline"
              className={cn(
                "flex-1",
                theme === 'dark'
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              📄 Descargar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LabelPrinter