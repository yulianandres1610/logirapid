'use client'

import React, { useState } from 'react'
import { PackageCheck, Send } from 'lucide-react'
import RecepcionBultosTab from './RecepcionBultosTab'
import EnvioBultosTab from './EnvioBultosTab'

interface GestionBultosTabProps {
  warehouse: any
  onRefresh?: () => void
}

type AccionType = 'recibir' | 'enviar'

export default function GestionBultosTab({ warehouse, onRefresh }: GestionBultosTabProps) {
  const [accionSeleccionada, setAccionSeleccionada] = useState<AccionType | null>(null)

  if (!accionSeleccionada) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Bultos
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Selecciona la acción que deseas realizar en {warehouse.name}
          </p>
        </div>

        {/* Action Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recibir Bultos */}
          <button
            onClick={() => setAccionSeleccionada('recibir')}
            className="group relative overflow-hidden rounded-2xl shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="p-8 text-left">
              <div className="mb-4 inline-flex p-4 bg-white/20 rounded-xl">
                <PackageCheck className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Recibir Bultos
              </h3>
              <p className="text-white/90 text-sm">
                Escanea y recibe bultos que llegan a este almacén. Los bultos deben estar en estado 'recogida'.
              </p>
            </div>
          </button>

          {/* Enviar Bultos */}
          <button
            onClick={() => setAccionSeleccionada('enviar')}
            className="group relative overflow-hidden rounded-2xl shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #cc0a46 0%, #a00838 100%)' }}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="p-8 text-left">
              <div className="mb-4 inline-flex p-4 bg-white/20 rounded-xl">
                <Send className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Enviar Bultos
              </h3>
              <p className="text-white/90 text-sm">
                Escanea y envía bultos desde este almacén hacia otro almacén. Los bultos deben estar en estado 'en_almacen'.
              </p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // Mostrar componente según acción seleccionada
  return (
    <div className="space-y-4">
      {/* Botón para volver */}
      <button
        onClick={() => setAccionSeleccionada(null)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver a selección de acción
      </button>

      {/* Renderizar componente según acción */}
      {accionSeleccionada === 'recibir' && (
        <RecepcionBultosTab warehouse={warehouse} onRefresh={onRefresh} />
      )}
      {accionSeleccionada === 'enviar' && (
        <EnvioBultosTab warehouse={warehouse} onRefresh={onRefresh} />
      )}
    </div>
  )
}
