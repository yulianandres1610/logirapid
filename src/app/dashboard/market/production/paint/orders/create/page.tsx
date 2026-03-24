'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Loader2, Trash2, ArrowLeft, Check, Factory, Palette, Box, Calculator } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ColorCard { id: number; code: string; name: string; baseTypeName: string; hexColor: string | null }
interface PackagingSpec { id: number; name: string; volumeLiters: number; netWeightKg: number }
interface Warehouse { id: number; name: string; code: string }
interface OrderLine { id: string; colorCardId: number | null; packagingSpecId: number | null; quantityUnits: string }

export default function CreatePaintOrderPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()

  const [colorCards, setColorCards] = useState<ColorCard[]>([])
  const [packagingSpecs, setPackagingSpecs] = useState<PackagingSpec[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [lines, setLines] = useState<OrderLine[]>([{ id: '1', colorCardId: null, packagingSpecId: null, quantityUnits: '' }])
  const [warehouseId, setWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/market/production/paint/color-cards').then(r => r.json()),
      fetch('/api/market/production/paint/packaging-specs').then(r => r.json()),
      fetch('/api/market/warehouses').then(r => r.json())
    ]).then(([ccData, psData, wData]) => {
      if (ccData.success) setColorCards(ccData.data)
      if (psData.success) setPackagingSpecs(psData.data)
      if (wData.success) setWarehouses(wData.data?.warehouses || wData.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), colorCardId: null, packagingSpecId: null, quantityUnits: '' }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) return
    setLines(lines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, updates: Partial<OrderLine>) => {
    setLines(lines.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const validLines = lines.filter(l => l.colorCardId && l.packagingSpecId && parseInt(l.quantityUnits) > 0)

  const totalWeight = validLines.reduce((sum, l) => {
    const pkg = packagingSpecs.find(p => p.id === l.packagingSpecId)
    return sum + (parseInt(l.quantityUnits) || 0) * (pkg?.netWeightKg || 0)
  }, 0)

  const totalUnits = validLines.reduce((sum, l) => sum + (parseInt(l.quantityUnits) || 0), 0)

  const handleCreate = async () => {
    if (validLines.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: validLines.map(l => ({
            colorCardId: l.colorCardId,
            packagingSpecId: l.packagingSpecId,
            quantityUnits: parseInt(l.quantityUnits)
          })),
          warehouseId: warehouseId ? parseInt(warehouseId) : null,
          targetWarehouseId: targetWarehouseId ? parseInt(targetWarehouseId) : null,
          plannedDate: plannedDate || null,
          notes: notes || null
        })
      })
      const data = await res.json()
      if (data.success) {
        // Auto-calculate
        await fetch(`/api/market/production/paint/orders/${data.data.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'calculate' })
        })
        router.push(`/dashboard/market/production/paint/orders/${data.data.id}`)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')
  const labelCls = cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
    </DashboardLayout></ProtectedRoute>
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className={cn('p-2 rounded-xl', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Orden de Producción</h1>
              <p className="text-sm text-gray-500">Selecciona colores, envases y cantidades</p>
            </div>
          </div>

          {/* Lines */}
          <div className={cn('rounded-xl border p-5 mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Palette className="w-5 h-5 text-orange-500" /> Productos a Fabricar
              </h2>
              <button onClick={addLine} className="text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Agregar línea
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const cc = colorCards.find(c => c.id === line.colorCardId)
                return (
                  <motion.div key={line.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={cn('p-4 rounded-xl border', isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-100 bg-gray-50')}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 pt-2">
                        {cc?.hexColor && <div className="w-6 h-6 rounded-lg border shadow-sm" style={{ backgroundColor: cc.hexColor }} />}
                        <span className="text-sm font-bold text-gray-400">{idx + 1}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Color *</label>
                          <select value={line.colorCardId || ''} onChange={e => updateLine(line.id, { colorCardId: parseInt(e.target.value) || null })} className={inputCls}>
                            <option value="">Seleccionar...</option>
                            {colorCards.map(c => <option key={c.id} value={c.id}>{c.name} ({c.baseTypeName})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Envase *</label>
                          <select value={line.packagingSpecId || ''} onChange={e => updateLine(line.id, { packagingSpecId: parseInt(e.target.value) || null })} className={inputCls}>
                            <option value="">Seleccionar...</option>
                            {packagingSpecs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.volumeLiters}L / {p.netWeightKg}kg)</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Cantidad *</label>
                          <input type="number" min="1" value={line.quantityUnits} onChange={e => updateLine(line.id, { quantityUnits: e.target.value })}
                            placeholder="1000" className={inputCls} />
                        </div>
                      </div>
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(line.id)} className="mt-7 p-1.5 text-red-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Summary */}
            {validLines.length > 0 && (
              <div className={cn('mt-4 p-3 rounded-lg flex items-center justify-between', isDark ? 'bg-orange-900/20' : 'bg-orange-50')}>
                <div className="flex gap-6 text-sm">
                  <span className="flex items-center gap-1.5"><Palette className="w-4 h-4 text-orange-500" /> {validLines.length} producto{validLines.length > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1.5"><Box className="w-4 h-4 text-orange-500" /> {totalUnits.toLocaleString()} unidades</span>
                  <span className="flex items-center gap-1.5"><Calculator className="w-4 h-4 text-orange-500" /> {totalWeight.toLocaleString()} kg total</span>
                </div>
              </div>
            )}
          </div>

          {/* Config */}
          <div className={cn('rounded-xl border p-5 mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <h2 className={cn('font-bold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
              <Factory className="w-5 h-5 text-amber-500" /> Configuración
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Almacén de Materias Primas</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
                  <option value="">Automático (central)</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Almacén Destino (Producto Terminado)</label>
                <select value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)} className={inputCls}>
                  <option value="">Mismo almacén</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha Planificada</label>
                <input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." className={inputCls} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => router.back()} className={cn('px-6 py-3 rounded-xl font-medium', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || validLines.length === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Factory className="w-5 h-5" />}
              {saving ? 'Creando y calculando...' : 'Crear Orden y Calcular'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
