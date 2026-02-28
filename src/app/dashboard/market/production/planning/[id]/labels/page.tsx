'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Printer,
  Loader2,
  Package,
  Calendar,
  Barcode,
  Hash,
  Factory
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import JsBarcode from 'jsbarcode'

interface Plan {
  id: number
  plan_number: string
  formula_name: string
  target_product_name: string
  target_product_sku: string
  lot_number: string
  barcode: string
  actual_quantity: number
  yield_unit: string
  completed_at: string
}

export default function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Label settings
  const [labelCount, setLabelCount] = useState(1)
  const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [showProductName, setShowProductName] = useState(true)
  const [showLotNumber, setShowLotNumber] = useState(true)
  const [showDate, setShowDate] = useState(true)

  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetchPlan()
  }, [resolvedParams.id])

  useEffect(() => {
    if (plan?.barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, plan.barcode, {
          format: 'EAN13',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10
        })
      } catch (error) {
        // Fallback to CODE128 if EAN13 fails
        JsBarcode(barcodeRef.current, plan.barcode, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10
        })
      }
    }
  }, [plan?.barcode])

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/market/production/plans/${resolvedParams.id}`)
      const data = await response.json()

      if (data.success) {
        if (data.data.status !== 'completed' || !data.data.lot_number) {
          console.warn('Este plan no tiene un lote generado')
          router.push(`/dashboard/market/production/planning/${resolvedParams.id}`)
          return
        }
        setPlan(data.data)
      } else {
        console.error(data.error || 'Error al cargar el plan')
        router.push('/dashboard/market/production/planning')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    setPrinting(true)

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('No se pudo abrir la ventana de impresión')
      setPrinting(false)
      return
    }

    const labelSizes = {
      small: { width: '50mm', height: '30mm', fontSize: '8px', barcodeWidth: 1.2, barcodeHeight: 30 },
      medium: { width: '70mm', height: '40mm', fontSize: '10px', barcodeWidth: 1.5, barcodeHeight: 45 },
      large: { width: '100mm', height: '60mm', fontSize: '12px', barcodeWidth: 2, barcodeHeight: 60 }
    }

    const size = labelSizes[labelSize]
    const formattedDate = plan ? new Date(plan.completed_at).toLocaleDateString('es-ES') : ''

    const labelsHtml = Array(labelCount).fill(null).map((_, i) => `
      <div class="label" style="
        width: ${size.width};
        height: ${size.height};
        border: 1px solid #ccc;
        padding: 4mm;
        margin: 2mm;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        page-break-inside: avoid;
        box-sizing: border-box;
      ">
        ${showProductName ? `
          <div style="font-size: ${size.fontSize}; font-weight: bold; text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${plan?.target_product_name}
          </div>
        ` : ''}

        <svg id="barcode-${i}"></svg>

        <div style="display: flex; justify-content: space-between; width: 100%; font-size: calc(${size.fontSize} * 0.85);">
          ${showLotNumber ? `<span>Lote: ${plan?.lot_number}</span>` : ''}
          ${showDate ? `<span>${formattedDate}</span>` : ''}
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas - ${plan?.lot_number}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
          }
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
            padding: 5mm;
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          document.querySelectorAll('svg[id^="barcode-"]').forEach(svg => {
            try {
              JsBarcode(svg, "${plan?.barcode}", {
                format: "EAN13",
                width: ${size.barcodeWidth},
                height: ${size.barcodeHeight},
                displayValue: true,
                fontSize: ${parseInt(size.fontSize) + 2},
                margin: 5
              });
            } catch (e) {
              JsBarcode(svg, "${plan?.barcode}", {
                format: "CODE128",
                width: ${size.barcodeWidth},
                height: ${size.barcodeHeight},
                displayValue: true,
                fontSize: ${parseInt(size.fontSize) + 2},
                margin: 5
              });
            }
          });
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()

    setPrinting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Plan no encontrado</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/market/production/planning">Volver a Planificación</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/market/production/planning/${plan.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Imprimir Etiquetas</h1>
          <p className="text-muted-foreground">
            {plan.plan_number} • Lote: {plan.lot_number}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Etiquetas</CardTitle>
            <CardDescription>
              Configure las opciones de impresión
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="labelCount">Cantidad de Etiquetas</Label>
              <Input
                id="labelCount"
                type="number"
                min="1"
                max="100"
                value={labelCount}
                onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="labelSize">Tamaño de Etiqueta</Label>
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Pequeña (50x30mm)</SelectItem>
                  <SelectItem value="medium">Mediana (70x40mm)</SelectItem>
                  <SelectItem value="large">Grande (100x60mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Mostrar en Etiqueta</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Nombre del Producto</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showLotNumber}
                    onChange={(e) => setShowLotNumber(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Número de Lote</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showDate}
                    onChange={(e) => setShowDate(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Fecha de Producción</span>
                </label>
              </div>
            </div>

            <Button onClick={handlePrint} disabled={printing} className="w-full">
              {printing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Imprimir {labelCount} Etiqueta{labelCount > 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>
              Así se verá cada etiqueta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-white flex flex-col items-center gap-3">
              {showProductName && (
                <p className="font-bold text-center">{plan.target_product_name}</p>
              )}

              <svg ref={barcodeRef}></svg>

              <div className="flex justify-between w-full text-sm text-muted-foreground">
                {showLotNumber && <span>Lote: {plan.lot_number}</span>}
                {showDate && (
                  <span>{new Date(plan.completed_at).toLocaleDateString('es-ES')}</span>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Producto:</span>
                <span className="font-medium">{plan.target_product_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-medium font-mono">{plan.target_product_sku}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Factory className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Lote:</span>
                <span className="font-medium font-mono">{plan.lot_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Barcode className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Código:</span>
                <span className="font-medium font-mono">{plan.barcode}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Producido:</span>
                <span className="font-medium">
                  {new Date(plan.completed_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
