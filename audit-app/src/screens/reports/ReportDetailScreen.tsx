import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { HomeStackParamList } from '@/src/navigation/types'
import { useThemeStore } from '@/src/stores/theme-store'
import { useAuditStore, type AuditCount } from '@/src/stores/audit-store'

export function ReportDetailScreen() {
  const route = useRoute<RouteProp<HomeStackParamList, 'ReportDetail'>>()
  const { countId } = route.params
  const { isDark, colors } = useThemeStore()
  const fetchReportDetail = useAuditStore((s) => s.fetchReportDetail)

  const [report, setReport] = useState<AuditCount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const data = await fetchReportDetail(countId)
      setReport(data)
      setLoading(false)
    }
    load()
  }, [countId])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#eb5b0c" />
      </View>
    )
  }

  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, marginBottom: 8 }}>❌</Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>Conteo no encontrado</Text>
      </View>
    )
  }

  const isProducts = report.auditType === 'products'

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }} showsVerticalScrollIndicator={false}>
      {/* Header info */}
      <View style={cardStyle}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
          {report.countNumber}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>{report.warehouseName}</Text>

        <View style={{ marginTop: 12, gap: 8 }}>
          <InfoRow label="Estado" value={report.status === 'completed' ? 'Completado' : report.status === 'applied' ? 'Aplicado' : report.status} colors={colors} />
          <InfoRow label="Tipo" value={isProducts ? 'Productos' : 'Activos Fijos'} colors={colors} />
          <InfoRow label="Contado por" value={report.countedByName || '-'} colors={colors} />
          <InfoRow label="Iniciado" value={formatDate(report.startedAt)} colors={colors} />
          <InfoRow label="Completado" value={formatDate(report.completedAt)} colors={colors} />
        </View>
      </View>

      {/* Summary */}
      {isProducts ? (
        <View style={cardStyle}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Resumen</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatBox label="Productos" value={String(report.totalProducts || 0)} color="#6b7280" />
            <StatBox label="Con Diferencia" value={String(report.productsWithDifferences || 0)} color="#f59e0b" />
            <StatBox label="Faltante $" value={`$${(report.totalShortageValue || 0).toFixed(2)}`} color="#ef4444" />
            <StatBox label="Excedente $" value={`$${(report.totalExcessValue || 0).toFixed(2)}`} color="#3b82f6" />
          </View>
        </View>
      ) : (
        <View style={cardStyle}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Resumen</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatBox label="Total Activos" value={String(report.totalAssets || 0)} color="#6b7280" />
            <StatBox label="Encontrados" value={String(report.assetsFound || 0)} color="#10b981" />
            <StatBox label="Faltantes" value={String(report.assetsMissing || 0)} color="#ef4444" />
            <StatBox label="Valor en Riesgo" value={`$${(report.totalValueAtRisk || 0).toFixed(2)}`} color="#f59e0b" />
          </View>
        </View>
      )}

      {/* Lines */}
      {report.lines && report.lines.length > 0 && (
        <View style={cardStyle}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
            Detalle ({report.lines.length} líneas)
          </Text>

          {report.lines.map((line: any, i: number) => {
            if (isProducts) {
              const diff = (line.countedQuantity || 0) - (line.systemQuantity || 0)
              return (
                <View key={i} style={{
                  paddingVertical: 10, borderBottomWidth: i < report.lines!.length - 1 ? 1 : 0,
                  borderBottomColor: colors.separator,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {line.productName}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Sistema: {line.systemQuantity} | Contado: {line.countedQuantity}
                    </Text>
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444',
                    }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </Text>
                  </View>
                </View>
              )
            } else {
              return (
                <View key={i} style={{
                  paddingVertical: 10, borderBottomWidth: i < report.lines!.length - 1 ? 1 : 0,
                  borderBottomColor: colors.separator, flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                      {line.assetName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{line.assetCode}</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                    backgroundColor: line.scanStatus === 'found' ? '#dcfce7' : '#fef2f2',
                  }}>
                    <Text style={{
                      fontSize: 11, fontWeight: '700',
                      color: line.scanStatus === 'found' ? '#16a34a' : '#dc2626',
                    }}>
                      {line.scanStatus === 'found' ? 'Encontrado' : 'Faltante'}
                    </Text>
                  </View>
                </View>
              )
            }
          })}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      backgroundColor: `${color}15`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
      minWidth: '45%' as any, flex: 1,
    }}>
      <Text style={{ fontSize: 11, color, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color, marginTop: 2 }}>{value}</Text>
    </View>
  )
}
