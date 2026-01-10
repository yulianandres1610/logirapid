'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Percent, Receipt, Package, Monitor,
  DollarSign, ShoppingCart, AlertTriangle, Clock,
  ArrowRight, BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { ReportSummaryCards, MetricCard } from '@/components/market/reports/ReportSummaryCards'

interface DashboardData {
  sales: {
    today: number
    month: number
    ordersToday: number
    ordersMonth: number
  }
  inventory: {
    totalValue: number
    expiringCount: number
    lowStockCount: number
  }
  margins: {
    averageMargin: number
    grossProfit: number
  }
  expenses: {
    totalMonth: number
    netProfit: number
  }
}

export default function ReportsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch from market dashboard API
      const response = await fetch('/api/market/dashboard')
      const result = await response.json()

      if (result.success) {
        setData({
          sales: {
            today: result.data.posSales?.today || 0,
            month: result.data.posSales?.month || 0,
            ordersToday: result.data.posSales?.ordersToday || 0,
            ordersMonth: result.data.posSales?.ordersMonth || 0
          },
          inventory: {
            totalValue: 0, // Will be fetched from inventory report
            expiringCount: 0,
            lowStockCount: result.data.products?.lowStock || 0
          },
          margins: {
            averageMargin: 0,
            grossProfit: 0
          },
          expenses: {
            totalMonth: 0,
            netProfit: 0
          }
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const reportLinks = [
    {
      title: 'Reporte de Ventas',
      description: 'Análisis detallado de ventas por período, producto, categoría y terminal',
      icon: TrendingUp,
      href: '/dashboard/market/reports/sales',
      color: 'blue'
    },
    {
      title: 'Reporte de Márgenes',
      description: 'Análisis de rentabilidad por producto y categoría',
      icon: Percent,
      href: '/dashboard/market/reports/margins',
      color: 'green'
    },
    {
      title: 'Reporte de Gastos',
      description: 'Comparativo de ingresos vs gastos y análisis P&L',
      icon: Receipt,
      href: '/dashboard/market/reports/expenses',
      color: 'red'
    },
    {
      title: 'Análisis de Inventario',
      description: 'Productos por vencer, rotación y valorización de stock',
      icon: Package,
      href: '/dashboard/market/reports/inventory',
      color: 'yellow'
    },
    {
      title: 'Terminales POS',
      description: 'Rendimiento y comparativo entre terminales de venta',
      icon: Monitor,
      href: '/dashboard/market/reports/pos-terminals',
      color: 'purple'
    }
  ]

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100'
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Centro de Reportes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Análisis y métricas de tu negocio
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Ventas Hoy"
          value={`$${(data?.sales.today || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`}
          subtitle={`${data?.sales.ordersToday || 0} órdenes`}
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          title="Ventas del Mes"
          value={`$${(data?.sales.month || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`}
          subtitle={`${data?.sales.ordersMonth || 0} órdenes`}
          icon={ShoppingCart}
          color="green"
        />
        <MetricCard
          title="Productos Stock Bajo"
          value={data?.inventory.lowStockCount || 0}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          color="yellow"
        />
        <MetricCard
          title="Por Vencer"
          value={data?.inventory.expiringCount || 0}
          subtitle="Próximos 30 días"
          icon={Clock}
          color="red"
        />
      </div>

      {/* Report Links */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Reportes Disponibles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportLinks.map((report, index) => (
          <motion.div
            key={report.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={report.href}>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 group cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${colorClasses[report.color]}`}>
                    <report.icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
                  {report.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {report.description}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
