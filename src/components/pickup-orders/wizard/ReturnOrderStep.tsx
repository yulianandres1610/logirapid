'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReturnOrderWizard from '@/components/orders/ReturnOrderWizard'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext?: () => void
}

export default function ReturnOrderStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const router = useRouter()

  // Siempre permitir proceder ya que el wizard interno maneja su propia validación
  useEffect(() => {
    setCanProceed(true)
  }, [setCanProceed])

  const handleComplete = () => {
    // Cuando se completa el retorno, redirigir a la lista de órdenes
    router.push('/dashboard/admin/pickup-orders')
  }

  // Obtener company ID del contexto o usar un valor por defecto
  // TODO: Implementar obtención real del company ID desde el contexto de autenticación
  const companyId = '1'

  return (
    <div className="-m-6 sm:-m-8">
      <ReturnOrderWizard
        companyId={companyId}
        onComplete={handleComplete}
      />
    </div>
  )
}
