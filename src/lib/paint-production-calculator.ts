/**
 * Paint Production Calculator
 * Calculates base needs, mixer assignments, tinting steps, packaging steps, and costs
 */

interface CalcLine {
  colorCardId: number
  colorName: string
  baseTypeId: number
  baseTypeName: string
  baseTypeCode: string
  packagingSpecId: number
  packagingName: string
  volumeLiters: number
  netWeightKg: number
  finishedProductId?: number | null
  quantityUnits: number
}

interface CalcTint {
  tintProductId: number
  tintProductName: string
  quantityPerKg: number
  unit: string
  unitCost: number
}

interface CalcColorCard {
  id: number
  name: string
  baseTypeId: number
  tints: CalcTint[]
}

interface CalcBaseType {
  id: number
  code: string
  name: string
  formulaId: number | null
  yieldKg: number
  formulaMaterials: { productId: number; productName: string; quantity: number; unitCost: number }[]
  laborCostPerBatch: number
}

interface CalcMixer {
  id: number
  name: string
  capacityMinKg: number
  capacityMaxKg: number
  mixerType: string
}

interface CalcPackagingSpec {
  id: number
  name: string
  volumeLiters: number
  netWeightKg: number
  containerProductId: number | null
  containerName: string | null
  containerCost: number
  labelProductId: number | null
  labelName: string | null
  labelCost: number
  lidProductId: number | null
  lidName: string | null
  lidCost: number
  laborCostPerUnit: number
}

export interface CalcStep {
  stepNumber: number
  stepType: 'base_preparation' | 'tinting' | 'packaging'
  description: string
  baseTypeId?: number
  colorCardId?: number
  packagingSpecId?: number
  paintLineIndex?: number
  weightKg?: number
  quantityUnits?: number
  mixerId?: number
  mixerName?: string
  mixerBatches?: number
  estimatedTimeMinutes?: number
  materials: { productId: number; productName: string; quantityRequired: number; unitCost: number; totalCost: number }[]
  materialsCost: number
  laborCost: number
}

export interface CalcResult {
  lines: (CalcLine & { totalWeightKg: number; baseCost: number; tintCost: number; packagingCost: number; laborCost: number; totalCost: number; costPerUnit: number })[]
  steps: CalcStep[]
  baseSummary: { baseTypeId: number; baseTypeName: string; totalKg: number; batches: number; mixerName: string }[]
  totals: { baseCost: number; tintCost: number; packagingCost: number; laborCost: number; totalCost: number }
}

export function calculatePaintProduction(
  lines: CalcLine[],
  colorCards: Map<number, CalcColorCard>,
  baseTypes: Map<number, CalcBaseType>,
  mixers: CalcMixer[],
  packagingSpecs: Map<number, CalcPackagingSpec>
): CalcResult {
  const steps: CalcStep[] = []
  let stepNum = 0

  // === STEP 1: Aggregate base needs by base type ===
  const baseNeeds = new Map<number, { baseType: CalcBaseType; totalKg: number; colors: { colorCardId: number; colorName: string; weightKg: number }[] }>()

  const calcLines = lines.filter(line => baseTypes.has(line.baseTypeId)).map(line => {
    const totalWeightKg = line.quantityUnits * line.netWeightKg
    const bt = baseTypes.get(line.baseTypeId)!

    if (!baseNeeds.has(line.baseTypeId)) {
      baseNeeds.set(line.baseTypeId, { baseType: bt, totalKg: 0, colors: [] })
    }
    const need = baseNeeds.get(line.baseTypeId)!
    need.totalKg += totalWeightKg

    // Aggregate color needs for this base type
    const existingColor = need.colors.find(c => c.colorCardId === line.colorCardId)
    if (existingColor) {
      existingColor.weightKg += totalWeightKg
    } else {
      need.colors.push({ colorCardId: line.colorCardId, colorName: line.colorName, weightKg: totalWeightKg })
    }

    return { ...line, totalWeightKg, baseCost: 0, tintCost: 0, packagingCost: 0, laborCost: 0, totalCost: 0, costPerUnit: 0 }
  })

  // === STEP 2: Create base preparation steps with mixer assignment ===
  const baseSummary: CalcResult['baseSummary'] = []
  const baseCostPerKg = new Map<number, number>()

  for (const [baseTypeId, need] of baseNeeds) {
    const bt = need.baseType
    if (!bt) continue

    // Find best mixer for this volume
    const mixer = findBestMixer(mixers, need.totalKg)
    const batches = mixer ? Math.ceil(need.totalKg / mixer.capacityMaxKg) : 1

    // Calculate base materials
    const multiplier = need.totalKg / (bt.yieldKg || 1)
    const materials = bt.formulaMaterials.map(fm => ({
      productId: fm.productId,
      productName: fm.productName,
      quantityRequired: Math.ceil(fm.quantity * multiplier * 1000) / 1000,
      unitCost: fm.unitCost,
      totalCost: Math.round(fm.quantity * multiplier * fm.unitCost * 100) / 100
    }))

    const materialsCost = materials.reduce((sum, m) => sum + m.totalCost, 0)
    const laborCost = bt.laborCostPerBatch * batches

    stepNum++
    steps.push({
      stepNumber: stepNum,
      stepType: 'base_preparation',
      description: `Preparar ${need.totalKg.toLocaleString()} kg de ${bt.name}`,
      baseTypeId,
      weightKg: need.totalKg,
      mixerId: mixer?.id,
      mixerName: mixer?.name,
      mixerBatches: batches,
      estimatedTimeMinutes: batches * 45, // ~45 min per batch
      materials,
      materialsCost,
      laborCost
    })

    const costPerKg = need.totalKg > 0 ? (materialsCost + laborCost) / need.totalKg : 0
    baseCostPerKg.set(baseTypeId, costPerKg)

    baseSummary.push({
      baseTypeId,
      baseTypeName: bt.name,
      totalKg: need.totalKg,
      batches,
      mixerName: mixer?.name || 'Sin asignar'
    })
  }

  // === STEP 3: Create tinting steps ===
  const tintCostPerKgColor = new Map<number, number>()

  for (const [, need] of baseNeeds) {
    for (const colorNeed of need.colors) {
      const cc = colorCards.get(colorNeed.colorCardId)
      if (!cc) continue

      const mixer = findBestMixer(mixers, colorNeed.weightKg)
      const batches = mixer ? Math.ceil(colorNeed.weightKg / mixer.capacityMaxKg) : 1

      const materials = cc.tints.map(tint => {
        const qtyRequired = Math.ceil(tint.quantityPerKg * colorNeed.weightKg * 1000) / 1000
        return {
          productId: tint.tintProductId,
          productName: tint.tintProductName,
          quantityRequired: qtyRequired,
          unitCost: tint.unitCost || 0,
          totalCost: Math.round(qtyRequired * (tint.unitCost || 0) * 100) / 100
        }
      })

      const materialsCost = materials.reduce((sum, m) => sum + m.totalCost, 0)

      stepNum++
      steps.push({
        stepNumber: stepNum,
        stepType: 'tinting',
        description: `Tinturar ${colorNeed.weightKg.toLocaleString()} kg — ${colorNeed.colorName}`,
        colorCardId: colorNeed.colorCardId,
        weightKg: colorNeed.weightKg,
        mixerId: mixer?.id,
        mixerName: mixer?.name,
        mixerBatches: batches,
        estimatedTimeMinutes: batches * 30, // ~30 min per batch
        materials,
        materialsCost,
        laborCost: 0
      })

      const tintCostKg = colorNeed.weightKg > 0 ? materialsCost / colorNeed.weightKg : 0
      tintCostPerKgColor.set(colorNeed.colorCardId, tintCostKg)
    }
  }

  // === STEP 4: Create packaging steps ===
  for (let i = 0; i < calcLines.length; i++) {
    const line = calcLines[i]
    const pkg = packagingSpecs.get(line.packagingSpecId)
    if (!pkg) continue

    const materials: CalcStep['materials'] = []

    if (pkg.containerProductId) {
      materials.push({
        productId: pkg.containerProductId,
        productName: pkg.containerName || 'Envase',
        quantityRequired: line.quantityUnits,
        unitCost: pkg.containerCost,
        totalCost: line.quantityUnits * pkg.containerCost
      })
    }
    if (pkg.labelProductId) {
      materials.push({
        productId: pkg.labelProductId,
        productName: pkg.labelName || 'Etiqueta',
        quantityRequired: line.quantityUnits,
        unitCost: pkg.labelCost,
        totalCost: line.quantityUnits * pkg.labelCost
      })
    }
    if (pkg.lidProductId) {
      materials.push({
        productId: pkg.lidProductId,
        productName: pkg.lidName || 'Tapa',
        quantityRequired: line.quantityUnits,
        unitCost: pkg.lidCost,
        totalCost: line.quantityUnits * pkg.lidCost
      })
    }

    const materialsCost = materials.reduce((sum, m) => sum + m.totalCost, 0)
    const laborCost = pkg.laborCostPerUnit * line.quantityUnits

    stepNum++
    steps.push({
      stepNumber: stepNum,
      stepType: 'packaging',
      description: `Empaquetar ${line.quantityUnits} × ${line.colorName} ${pkg.name}`,
      packagingSpecId: line.packagingSpecId,
      paintLineIndex: i,
      quantityUnits: line.quantityUnits,
      materials,
      materialsCost,
      laborCost,
      estimatedTimeMinutes: Math.ceil(line.quantityUnits * 0.5) // ~0.5 min per unit
    })
  }

  // === STEP 5: Calculate line costs ===
  for (const line of calcLines) {
    const baseKgCost = baseCostPerKg.get(line.baseTypeId) || 0
    const tintKgCost = tintCostPerKgColor.get(line.colorCardId) || 0
    const pkg = packagingSpecs.get(line.packagingSpecId)

    line.baseCost = Math.round(baseKgCost * line.totalWeightKg * 100) / 100
    line.tintCost = Math.round(tintKgCost * line.totalWeightKg * 100) / 100

    const pkgMaterialCost = pkg
      ? (pkg.containerCost + pkg.labelCost + pkg.lidCost) * line.quantityUnits
      : 0
    const pkgLaborCost = pkg ? pkg.laborCostPerUnit * line.quantityUnits : 0
    line.packagingCost = Math.round(pkgMaterialCost * 100) / 100
    line.laborCost = Math.round(pkgLaborCost * 100) / 100
    line.totalCost = Math.round((line.baseCost + line.tintCost + line.packagingCost + line.laborCost) * 100) / 100
    line.costPerUnit = line.quantityUnits > 0 ? Math.round(line.totalCost / line.quantityUnits * 10000) / 10000 : 0
  }

  // === STEP 6: Totals ===
  const totals = {
    baseCost: calcLines.reduce((sum, l) => sum + l.baseCost, 0),
    tintCost: calcLines.reduce((sum, l) => sum + l.tintCost, 0),
    packagingCost: calcLines.reduce((sum, l) => sum + l.packagingCost, 0),
    laborCost: calcLines.reduce((sum, l) => sum + l.laborCost, 0),
    totalCost: calcLines.reduce((sum, l) => sum + l.totalCost, 0)
  }

  return { lines: calcLines, steps, baseSummary, totals }
}

function findBestMixer(mixers: CalcMixer[], weightKg: number): CalcMixer | null {
  if (mixers.length === 0) return null

  // Sort by capacity ascending
  const sorted = [...mixers].sort((a, b) => a.capacityMaxKg - b.capacityMaxKg)

  // First try to find one that can do it in 1 batch
  const single = sorted.find(m => m.capacityMaxKg >= weightKg && m.capacityMinKg <= weightKg)
  if (single) return single

  // Otherwise pick the largest to minimize batches
  return sorted[sorted.length - 1]
}
