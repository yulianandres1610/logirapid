'use client'

import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ReturnOrderWizard from '@/components/orders/ReturnOrderWizard'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateReturnOrderPage() {
  const router = useRouter()

  const handleComplete = () => {
    router.push('/dashboard/admin/pickup-orders')
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/admin/pickup-orders"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Órdenes
          </Link>
          <h1 className="text-3xl font-bold">Crear Orden de Retorno</h1>
          <p className="text-gray-500 mt-2">
            Crea una orden de recogida basada en una entrega previa de cajas vacías
          </p>
        </div>

        {/* Wizard Component */}
        <ReturnOrderWizard
          companyId="1" // TODO: Obtener del contexto de autenticación
          onComplete={handleComplete}
        />
      </div>
    </DashboardLayout>
  )
}
