import { useState } from 'react'

interface SetupPageProps {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: SetupPageProps) {
  const [step, setStep] = useState<'welcome' | 'credentials' | 'connecting'>('welcome')
  const [formData, setFormData] = useState({
    serverUrl: 'https://agencias.logirapid.com',
    serviceCode: '',
    apiKey: '',
    apiSecret: ''
  })
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setError('')

    if (!formData.serverUrl || !formData.serviceCode || !formData.apiKey || !formData.apiSecret) {
      setError('Por favor complete todos los campos')
      return
    }

    // Validate service code format (PRS-YYYY-XXXX)
    const serviceCodePattern = /^PRS-\d{4}-\d{4}$/
    if (!serviceCodePattern.test(formData.serviceCode)) {
      setError('Código de servicio inválido. Formato esperado: PRS-2025-0001')
      return
    }

    setStep('connecting')

    try {
      console.log('[Setup] Calling saveCredentials with:', {
        serviceCode: formData.serviceCode,
        apiKey: formData.apiKey.substring(0, 10) + '...',
        serverUrl: formData.serverUrl
      })

      const result = await window.electronAPI.saveCredentials({
        serviceCode: formData.serviceCode,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        serverUrl: formData.serverUrl
      })

      console.log('[Setup] Result from saveCredentials:', result)

      if (result.success) {
        onComplete()
      } else {
        console.error('[Setup] Error:', result.error)
        setError(result.error || 'Error al conectar')
        setStep('credentials')
      }
    } catch (err: any) {
      console.error('[Setup] Exception caught:', err)
      setError(`Error: ${err?.message || 'Error de conexión desconocido'}`)
      setStep('credentials')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">LogiRapid Print Service</h1>
          <p className="text-white/60 mt-2">Servicio de impresión silenciosa</p>
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4">Bienvenido</h2>
            <p className="text-white/70 mb-6">
              Este servicio permite imprimir documentos automáticamente desde LogiRapid
              sin necesidad de intervención manual.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3 text-white/80">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Impresión silenciosa de recibos POS</span>
              </li>
              <li className="flex items-start gap-3 text-white/80">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Etiquetas de envío y productos</span>
              </li>
              <li className="flex items-start gap-3 text-white/80">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Detección automática de impresoras</span>
              </li>
            </ul>
            <button
              onClick={() => setStep('credentials')}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              Comenzar Configuración
            </button>
          </div>
        )}

        {/* Credentials Step */}
        {step === 'credentials' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4">Conectar al Servidor</h2>
            <p className="text-white/70 mb-6">
              Ingresa las credenciales proporcionadas en el panel de LogiRapid.
            </p>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  URL del Servidor
                </label>
                <input
                  type="url"
                  value={formData.serverUrl}
                  onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                  placeholder="https://app.logirapid.com"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Código del Servicio
                </label>
                <input
                  type="text"
                  value={formData.serviceCode}
                  onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value.toUpperCase() })}
                  placeholder="PRS-2025-0001"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="pk_xxxx..."
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  API Secret
                </label>
                <input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  placeholder="sk_xxxx..."
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={handleConnect}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Conectar
              </button>
            </div>
          </div>
        )}

        {/* Connecting Step */}
        {step === 'connecting' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl text-center">
            <div className="w-16 h-16 border-4 border-white/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Conectando...</h2>
            <p className="text-white/60">
              Verificando credenciales y detectando impresoras
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-white/40 text-sm mt-6">
          LogiRapid Print Service v1.6.0
        </p>
      </div>
    </div>
  )
}
