'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Building2, ChevronDown } from 'lucide-react'

interface Company {
  id: number
  name: string
  code: string
}

interface CompanySelectorProps {
  selectedCompanyId: number | null
  onCompanyChange: (companyId: number | null) => void
}

export default function CompanySelector({ selectedCompanyId, onCompanyChange }: CompanySelectorProps) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [companies, setCompanies] = useState<Company[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadCompanies = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/companies?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.data || [])
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadCompanies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Solo mostrar el selector si el usuario es SUPER_ADMIN
  if (user?.role !== 'SUPER_ADMIN') {
    return null
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  return (
    <div className={cn(
      "relative mb-6 p-4 rounded-lg border",
      theme === 'dark'
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className={cn(
            "w-5 h-5",
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          )} />
          <h3 className={cn(
            "text-lg font-semibold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Vista de Empresa
          </h3>
        </div>
        <span className={cn(
          "text-xs px-2 py-1 rounded-full",
          theme === 'dark'
            ? 'bg-purple-900 text-purple-200'
            : 'bg-purple-100 text-purple-800'
        )}>
          SUPER ADMIN
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className={cn(
            "w-full px-4 py-3 rounded-lg border flex items-center justify-between transition-colors",
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 hover:bg-gray-650 text-white'
              : 'bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-900',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="flex items-center gap-2">
            {isLoading ? (
              'Cargando empresas...'
            ) : selectedCompany ? (
              <>
                <Building2 className="w-4 h-4" />
                {selectedCompany.name}
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                )}>
                  {selectedCompany.code}
                </span>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                Todas las Empresas
              </>
            )}
          </span>
          <ChevronDown className={cn(
            "w-5 h-5 transition-transform",
            isOpen && 'rotate-180'
          )} />
        </button>

        {isOpen && !isLoading && (
          <div className={cn(
            "absolute z-50 w-full mt-2 rounded-lg border shadow-lg max-h-96 overflow-y-auto",
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600'
              : 'bg-white border-gray-200'
          )}>
            {/* Opcion "Todas las Empresas" */}
            <button
              onClick={() => {
                onCompanyChange(null)
                setIsOpen(false)
              }}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors flex items-center gap-2 border-b",
                theme === 'dark'
                  ? 'hover:bg-gray-600 border-gray-600'
                  : 'hover:bg-gray-50 border-gray-200',
                !selectedCompanyId && (theme === 'dark' ? 'bg-gray-600' : 'bg-blue-50')
              )}
            >
              <Building2 className="w-4 h-4" />
              <span className="font-medium">Todas las Empresas</span>
              {!selectedCompanyId && (
                <span className={cn(
                  "ml-auto text-xs px-2 py-1 rounded-full",
                  theme === 'dark'
                    ? 'bg-blue-900 text-blue-200'
                    : 'bg-blue-100 text-blue-800'
                )}>
                  Seleccionado
                </span>
              )}
            </button>

            {/* Lista de empresas */}
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  onCompanyChange(company.id)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  theme === 'dark'
                    ? 'hover:bg-gray-600'
                    : 'hover:bg-gray-50',
                  selectedCompanyId === company.id && (theme === 'dark' ? 'bg-gray-600' : 'bg-blue-50')
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">{company.name}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}>
                      {company.code}
                    </span>
                  </div>
                  {selectedCompanyId === company.id && (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      theme === 'dark'
                        ? 'bg-blue-900 text-blue-200'
                        : 'bg-blue-100 text-blue-800'
                    )}>
                      Seleccionado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCompany && (
        <p className={cn(
          "mt-2 text-sm",
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Viendo configuracion de: <strong>{selectedCompany.name}</strong>
        </p>
      )}
      {!selectedCompanyId && (
        <p className={cn(
          "mt-2 text-sm",
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Viendo configuracion de: <strong>Todas las empresas</strong>
        </p>
      )}
    </div>
  )
}
