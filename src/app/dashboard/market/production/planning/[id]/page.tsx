'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Factory,
  Package,
  Warehouse,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  Truck,
  FileText,
  Printer,
  Loader2,
  XCircle,
  Barcode,
  DollarSign,
  Scale
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Material {
  id: number
  raw_material_id: number
  material_name: string
  material_sku: string
  unit_of_measure: string
  quantity_required: number
  quantity_issued: number
  unit_cost: number
  total_cost: number
  status: string
  available_stock: number
}

interface Plan {
  id: number
  plan_number: string
  formula_id: number
  formula_name: string
  formula_code: string
  target_product_id: number
  target_product_name: string
  target_product_sku: string
  yield_unit: string
  warehouse_id: number
  warehouse_name: string
  target_warehouse_id: number | null
  target_warehouse_name: string | null
  planned_date: string
  planned_quantity: number
  batches: number
  status: string
  lot_number: string | null
  barcode: string | null
  actual_quantity: number | null
  waste_quantity: number | null
  materials_cost: number
  labor_cost: number
  total_cost: number
  cost_per_unit: number | null
  notes: string | null
  created_at: string
  scheduled_at: string | null
  materials_issued_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by_name: string | null
  scheduled_by_name: string | null
  materials_issued_by_name: string | null
  started_by_name: string | null
  completed_by_name: string | null
  materials: Material[]
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'bg-gray-500', icon: FileText },
  scheduled: { label: 'Programado', color: 'bg-blue-500', icon: Calendar },
  materials_issued: { label: 'Materiales Entregados', color: 'bg-orange-500', icon: Truck },
  in_production: { label: 'En Producción', color: 'bg-yellow-500', icon: Factory },
  completed: { label: 'Completado', color: 'bg-green-500', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle }
}

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Dialog states
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [forceSchedule, setForceSchedule] = useState(false)
  const [shortages, setShortages] = useState<any[]>([])

  // Complete form
  const [actualQuantity, setActualQuantity] = useState('')
  const [wasteQuantity, setWasteQuantity] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')

  useEffect(() => {
    fetchPlan()
  }, [resolvedParams.id])

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/market/production/plans/${resolvedParams.id}`)
      const data = await response.json()

      if (data.success) {
        setPlan(data.data)
        setActualQuantity(String(data.data.planned_quantity))
      } else {
        setError(data.error || 'Error al cargar el plan')
        router.push('/dashboard/market/production/planning')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Error al cargar el plan')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!plan) return
    setActionLoading('schedule')

    try {
      const response = await fetch(`/api/market/production/plans/${plan.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSchedule })
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        setShowScheduleDialog(false)
        setForceSchedule(false)
        setShortages([])
        fetchPlan()
      } else if (data.canForce && data.shortages) {
        setShortages(data.shortages)
        setShowScheduleDialog(true)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al programar el plan')
    } finally {
      setActionLoading(null)
    }
  }

  const handleIssueMaterials = async () => {
    if (!plan) return
    setActionLoading('issue')

    try {
      const response = await fetch(`/api/market/production/plans/${plan.id}/issue-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        fetchPlan()
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al entregar materiales')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStart = async () => {
    if (!plan) return
    setActionLoading('start')

    try {
      const response = await fetch(`/api/market/production/plans/${plan.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        fetchPlan()
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al iniciar producción')
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async () => {
    if (!plan) return

    const qty = parseFloat(actualQuantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Ingrese una cantidad válida')
      return
    }

    setActionLoading('complete')

    try {
      const response = await fetch(`/api/market/production/plans/${plan.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualQuantity: qty,
          wasteQuantity: parseFloat(wasteQuantity) || 0,
          notes: completeNotes || undefined
        })
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        setShowCompleteDialog(false)
        fetchPlan()
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al completar producción')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!plan) return
    setActionLoading('cancel')

    try {
      const response = await fetch(`/api/market/production/plans/${plan.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        setSuccess('Plan cancelado')
        router.push('/dashboard/market/production/planning')
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al cancelar el plan')
    } finally {
      setActionLoading(null)
      setShowCancelDialog(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'currency',
      currency: 'CUP',
      minimumFractionDigits: 2
    }).format(value)
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

  const StatusIcon = statusConfig[plan.status]?.icon || FileText
  const canSchedule = plan.status === 'draft'
  const canIssueMaterials = plan.status === 'scheduled'
  const canStart = plan.status === 'materials_issued'
  const canComplete = plan.status === 'in_production'
  const canCancel = ['draft', 'scheduled'].includes(plan.status)
  const isCompleted = plan.status === 'completed'

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/market/production/planning">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{plan.plan_number}</h1>
              <Badge className={`${statusConfig[plan.status]?.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[plan.status]?.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {plan.formula_name} • {plan.planned_quantity} {plan.yield_unit}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canCancel && (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={actionLoading !== null}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Plan
            </Button>
          )}

          {canSchedule && (
            <Button
              onClick={handleSchedule}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'schedule' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Programar
            </Button>
          )}

          {canIssueMaterials && (
            <Button
              onClick={handleIssueMaterials}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'issue' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-2" />
              )}
              Entregar Materiales
            </Button>
          )}

          {canStart && (
            <Button
              onClick={handleStart}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'start' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Iniciar Producción
            </Button>
          )}

          {canComplete && (
            <Button
              onClick={() => setShowCompleteDialog(true)}
              disabled={actionLoading !== null}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Completar Producción
            </Button>
          )}

          {isCompleted && plan.lot_number && (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/market/production/planning/${plan.id}/labels`}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Etiquetas
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-700 dark:text-green-300">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Detalles del Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fórmula</p>
                  <p className="font-medium">{plan.formula_name}</p>
                  <p className="text-xs text-muted-foreground">{plan.formula_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Producto Final</p>
                  <p className="font-medium">{plan.target_product_name}</p>
                  <p className="text-xs text-muted-foreground">{plan.target_product_sku}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Planificada</p>
                  <p className="font-medium">{formatDate(plan.planned_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cantidad Planificada</p>
                  <p className="font-medium">{plan.planned_quantity} {plan.yield_unit}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lotes/Tandas</p>
                  <p className="font-medium">{plan.batches}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Almacén Origen</p>
                  <p className="font-medium">{plan.warehouse_name}</p>
                </div>
                {plan.target_warehouse_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Almacén Destino</p>
                    <p className="font-medium">{plan.target_warehouse_name}</p>
                  </div>
                )}
              </div>

              {/* Completed info */}
              {isCompleted && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Producción Completada
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cantidad Real</p>
                      <p className="font-medium text-green-600">
                        {plan.actual_quantity} {plan.yield_unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Merma</p>
                      <p className="font-medium">{plan.waste_quantity || 0} {plan.yield_unit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Número de Lote</p>
                      <p className="font-medium font-mono">{plan.lot_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Código de Barras</p>
                      <p className="font-medium font-mono">{plan.barcode}</p>
                    </div>
                  </div>
                </div>
              )}

              {plan.notes && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Materials Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Materiales Requeridos
              </CardTitle>
              <CardDescription>
                {plan.materials?.length || 0} materiales para esta producción
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Requerido</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Entregado</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.materials?.map((mat) => {
                    const hasShortage = mat.available_stock < mat.quantity_required && mat.status === 'pending'
                    return (
                      <TableRow key={mat.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mat.material_name}</p>
                            <p className="text-xs text-muted-foreground">{mat.material_sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {mat.quantity_required} {mat.unit_of_measure}
                        </TableCell>
                        <TableCell className={`text-right ${hasShortage ? 'text-red-600' : ''}`}>
                          {hasShortage && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {mat.available_stock} {mat.unit_of_measure}
                        </TableCell>
                        <TableCell className="text-right">
                          {mat.quantity_issued > 0 ? (
                            <span className="text-green-600">{mat.quantity_issued} {mat.unit_of_measure}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(mat.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(mat.total_cost || mat.quantity_required * mat.unit_cost)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mat.status === 'issued' ? 'default' : 'secondary'}>
                            {mat.status === 'issued' ? 'Entregado' : 'Pendiente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Costs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Costos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materiales</span>
                <span className="font-medium">{formatCurrency(plan.materials_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mano de Obra</span>
                <span className="font-medium">{formatCurrency(plan.labor_cost)}</span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">{formatCurrency(plan.total_cost)}</span>
              </div>
              {plan.cost_per_unit && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Costo por unidad</span>
                  <span>{formatCurrency(plan.cost_per_unit)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TimelineItem
                  icon={FileText}
                  title="Creado"
                  date={plan.created_at}
                  user={plan.created_by_name}
                  active
                />
                <TimelineItem
                  icon={Calendar}
                  title="Programado"
                  date={plan.scheduled_at}
                  user={plan.scheduled_by_name}
                  active={['scheduled', 'materials_issued', 'in_production', 'completed'].includes(plan.status)}
                />
                <TimelineItem
                  icon={Truck}
                  title="Materiales Entregados"
                  date={plan.materials_issued_at}
                  user={plan.materials_issued_by_name}
                  active={['materials_issued', 'in_production', 'completed'].includes(plan.status)}
                />
                <TimelineItem
                  icon={PlayCircle}
                  title="Producción Iniciada"
                  date={plan.started_at}
                  user={plan.started_by_name}
                  active={['in_production', 'completed'].includes(plan.status)}
                />
                <TimelineItem
                  icon={CheckCircle}
                  title="Completado"
                  date={plan.completed_at}
                  user={plan.completed_by_name}
                  active={plan.status === 'completed'}
                  isLast
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Dialog with Shortages */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Stock Insuficiente
            </DialogTitle>
            <DialogDescription>
              Algunos materiales no tienen suficiente stock disponible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {shortages.map((s, i) => (
              <div key={i} className="flex justify-between p-2 bg-yellow-50 rounded">
                <span>{s.materialName}</span>
                <span className="text-red-600">
                  Faltan {s.shortage.toFixed(2)} {s.unit}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowScheduleDialog(false)
              setShortages([])
            }}>
              Cancelar
            </Button>
            <Button onClick={() => {
              setForceSchedule(true)
              setTimeout(handleSchedule, 100)
            }}>
              Programar de Todos Modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Producción</DialogTitle>
            <DialogDescription>
              Ingrese la cantidad real producida para completar la producción
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualQuantity">Cantidad Producida *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="actualQuantity"
                  type="number"
                  step="0.001"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(e.target.value)}
                  placeholder="0"
                />
                <span className="text-muted-foreground">{plan.yield_unit}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Planificado: {plan.planned_quantity} {plan.yield_unit}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wasteQuantity">Merma (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="wasteQuantity"
                  type="number"
                  step="0.001"
                  value={wasteQuantity}
                  onChange={(e) => setWasteQuantity(e.target.value)}
                  placeholder="0"
                />
                <span className="text-muted-foreground">{plan.yield_unit}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="completeNotes">Notas (opcional)</Label>
              <textarea
                id="completeNotes"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Observaciones de la producción..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleComplete} disabled={actionLoading === 'complete'}>
              {actionLoading === 'complete' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Completar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Plan</DialogTitle>
            <DialogDescription>
              ¿Está seguro de cancelar este plan de producción? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              No, Mantener
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading === 'cancel'}>
              {actionLoading === 'cancel' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Sí, Cancelar Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TimelineItem({
  icon: Icon,
  title,
  date,
  user,
  active,
  isLast = false
}: {
  icon: any
  title: string
  date: string | null
  user: string | null
  active: boolean
  isLast?: boolean
}) {
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`p-1.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          <Icon className="h-3 w-3" />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 my-1 ${active ? 'bg-primary' : 'bg-muted'}`} />
        )}
      </div>
      <div className="pb-4">
        <p className={`text-sm font-medium ${!active ? 'text-muted-foreground' : ''}`}>
          {title}
        </p>
        {date && (
          <p className="text-xs text-muted-foreground">
            {formatDateTime(date)}
            {user && ` • ${user}`}
          </p>
        )}
      </div>
    </div>
  )
}
