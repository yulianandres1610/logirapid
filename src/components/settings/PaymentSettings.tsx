'use client'

import { useState } from 'react'
import { PlatformPaymentConfig } from './PlatformPaymentConfig'
import { CompanyPaymentConfig } from './CompanyPaymentConfig'
import { TerminalsList } from './TerminalsList'

interface Props {
  role: string
  companyId?: number
}

type PlatformTab = 'platform-config' | 'platform-terminals'
type CompanyTab = 'company-config' | 'company-terminals'

export function PaymentSettings({ role, companyId }: Props) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const [platformTab, setPlatformTab] = useState<PlatformTab>('platform-config')
  const [companyTab, setCompanyTab] = useState<CompanyTab>('company-config')

  if (isSuperAdmin) {
    return (
      <div className="space-y-6">
        {/* Platform Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Configuración de Pagos de Plataforma
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Credenciales y terminales para recibir pagos de recargas de wallet de todas las empresas.
          </p>

          {/* Platform Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setPlatformTab('platform-config')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  platformTab === 'platform-config'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Credenciales
              </button>
              <button
                onClick={() => setPlatformTab('platform-terminals')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  platformTab === 'platform-terminals'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Terminales de Plataforma
              </button>
            </nav>
          </div>

          {/* Platform Content */}
          {platformTab === 'platform-config' && <PlatformPaymentConfig />}
          {platformTab === 'platform-terminals' && <TerminalsList isPlatform={true} />}
        </div>
      </div>
    )
  }

  // ADMIN / Company view
  if (!companyId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <p className="text-yellow-800 dark:text-yellow-300">
          No se pudo determinar la empresa. Por favor recarga la página.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Configuración de Pagos
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Configure sus credenciales de pago para cobrar a sus clientes por sus servicios.
        </p>

        {/* Company Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setCompanyTab('company-config')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                companyTab === 'company-config'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Credenciales
            </button>
            <button
              onClick={() => setCompanyTab('company-terminals')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                companyTab === 'company-terminals'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Mis Terminales
            </button>
          </nav>
        </div>

        {/* Company Content */}
        {companyTab === 'company-config' && <CompanyPaymentConfig companyId={companyId} />}
        {companyTab === 'company-terminals' && <TerminalsList companyId={companyId} />}
      </div>
    </div>
  )
}
