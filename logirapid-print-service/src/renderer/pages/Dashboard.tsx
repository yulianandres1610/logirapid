import { useState, useEffect, useCallback } from 'react'

interface Printer {
  systemName: string
  printerName: string
  printerType: string
  connectionType: string
  networkAddress?: string
  isOnline: boolean
  isDefault: boolean
}

interface ServiceStatus {
  isRunning: boolean
  processingCount: number
  processingJobs: Array<{
    jobNumber: string
    documentType: string
    startedAt: Date
  }>
}

interface DashboardPageProps {
  onLogout: () => void
}

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [status, setStatus] = useState<ServiceStatus | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'status' | 'printers' | 'settings'>('status')
  const [credentials, setCredentials] = useState<{ serviceCode: string; serverUrl: string } | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [printingTest, setPrintingTest] = useState<string | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    available: boolean
    currentVersion?: string
    latestVersion?: string
    message?: string
  } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
  } | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'downloaded' | 'error'>('idle')

  const fetchStatus = useCallback(async () => {
    try {
      const [statusResult, printersResult, creds, version] = await Promise.all([
        window.electronAPI.getServiceStatus(),
        window.electronAPI.getPrinters(),
        window.electronAPI.getCredentials(),
        window.electronAPI.getAppVersion()
      ])

      setStatus(statusResult)
      setPrinters(printersResult)
      setCredentials(creds)
      setAppVersion(version)
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    const cleanup = window.electronAPI.onPrintersUpdated(() => {
      fetchStatus()
    })
    return cleanup
  }, [fetchStatus])

  // Listen for update status events
  useEffect(() => {
    const cleanup = window.electronAPI.onUpdateStatus((data) => {
      console.log('[Dashboard] Update status:', data)
      if (data.status === 'available') {
        setDownloadStatus('downloading')
        setUpdateStatus({
          available: true,
          latestVersion: data.version,
          message: `Descargando v${data.version}...`
        })
      } else if (data.status === 'downloaded') {
        setDownloadStatus('downloaded')
        setDownloadProgress(null)
        setUpdateStatus({
          available: true,
          latestVersion: data.version,
          message: `v${data.version} lista para instalar`
        })
      } else if (data.status === 'error') {
        setDownloadStatus('error')
        setDownloadProgress(null)
        setUpdateStatus({
          available: false,
          message: `Error: ${data.error}`
        })
      } else if (data.status === 'not-available') {
        setDownloadStatus('idle')
        setDownloadProgress(null)
        setCheckingUpdates(false)
      }
    })
    return cleanup
  }, [])

  // Listen for download progress events
  useEffect(() => {
    const cleanup = window.electronAPI.onUpdateDownloadProgress((data) => {
      setDownloadProgress(data)
      setDownloadStatus('downloading')
    })
    return cleanup
  }, [])

  const handleToggleService = async () => {
    if (status?.isRunning) {
      await window.electronAPI.stopService()
    } else {
      await window.electronAPI.startService()
    }
    fetchStatus()
  }

  const handleRefreshPrinters = async () => {
    const result = await window.electronAPI.refreshPrinters()
    setPrinters(result as Printer[])
  }

  const handleTestPrint = async (printerName: string) => {
    setPrintingTest(printerName)
    try {
      const result = await window.electronAPI.testPrint(printerName)
      if (result.success) {
        alert('Página de prueba enviada correctamente')
      } else {
        alert(`Error: ${result.error || 'No se pudo imprimir'}`)
      }
    } catch (error) {
      alert('Error al enviar página de prueba')
    } finally {
      setPrintingTest(null)
    }
  }

  const handleDisconnect = async () => {
    if (confirm('¿Desconectar este servicio? Tendrás que configurarlo nuevamente.')) {
      await window.electronAPI.clearCredentials()
      onLogout()
    }
  }

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true)
    setUpdateStatus(null)
    try {
      const result = await window.electronAPI.checkForUpdates()
      setUpdateStatus({
        available: result.updateAvailable,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        message: result.error || (result.updateAvailable
          ? `Nueva versión ${result.latestVersion} disponible`
          : 'Ya tienes la última versión')
      })

      if (result.updateAvailable) {
        if (confirm(`Nueva versión ${result.latestVersion} disponible.\n\n¿Descargar e instalar ahora?`)) {
          // La descarga ya se inició automáticamente, solo esperamos
          alert('La actualización se descargará en segundo plano.\nLa aplicación se reiniciará cuando esté lista.')
        }
      }
    } catch (error) {
      setUpdateStatus({
        available: false,
        message: 'Error al buscar actualizaciones'
      })
    } finally {
      setCheckingUpdates(false)
    }
  }

  const handleInstallUpdate = async () => {
    await window.electronAPI.installUpdate()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">LogiRapid Print Service</h1>
            <p className="text-white/60 text-sm">
              Servicio #{credentials?.serviceCode} • {credentials?.serverUrl}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          status?.isRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${status?.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-medium">{status?.isRunning ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/10 rounded-lg p-1 mb-6">
        {(['status', 'printers', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'status' && 'Estado'}
            {tab === 'printers' && 'Impresoras'}
            {tab === 'settings' && 'Ajustes'}
          </button>
        ))}
      </div>

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Estado</p>
              <p className={`text-2xl font-bold ${status?.isRunning ? 'text-green-400' : 'text-gray-400'}`}>
                {status?.isRunning ? 'Activo' : 'Detenido'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">En proceso</p>
              <p className="text-2xl font-bold text-white">{status?.processingCount || 0}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white/60 text-sm">Impresoras</p>
              <p className="text-2xl font-bold text-white">{printers.length}</p>
            </div>
          </div>

          {/* Control button */}
          <button
            onClick={handleToggleService}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
              status?.isRunning
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
            }`}
          >
            {status?.isRunning ? 'Detener Servicio' : 'Iniciar Servicio'}
          </button>

          {/* Processing jobs */}
          {status?.processingJobs && status.processingJobs.length > 0 && (
            <div className="bg-white/10 rounded-xl p-4">
              <h3 className="text-white font-medium mb-3">Trabajos en proceso</h3>
              <div className="space-y-2">
                {status.processingJobs.map((job, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white font-mono text-sm">{job.jobNumber}</p>
                      <p className="text-white/60 text-xs">{job.documentType}</p>
                    </div>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-blue-400 rounded-full animate-spin" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Printers Tab */}
      {activeTab === 'printers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white font-medium">Impresoras detectadas</h3>
            <button
              onClick={handleRefreshPrinters}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>

          {printers.length === 0 ? (
            <div className="bg-white/10 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-white/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <p className="text-white/60">No se detectaron impresoras</p>
            </div>
          ) : (
            <div className="space-y-3">
              {printers.map((printer, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        printer.printerType.includes('thermal') ? 'bg-orange-500/20' : 'bg-blue-500/20'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          printer.printerType.includes('thermal') ? 'text-orange-400' : 'text-blue-400'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{printer.printerName}</p>
                        <p className="text-white/60 text-sm">
                          {printer.printerType === 'standard' ? 'Documento' : printer.printerType.replace('_', ' ')} • {printer.connectionType}
                          {printer.networkAddress && ` • ${printer.networkAddress}`}
                          {printer.isDefault && ' • Por defecto'}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm ${
                      printer.isOnline ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        printer.isOnline ? 'bg-green-400' : 'bg-gray-400'
                      }`} />
                      {printer.isOnline ? 'En línea' : 'Offline'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTestPrint(printer.systemName)}
                    disabled={printingTest === printer.systemName}
                    className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/20 text-blue-400 disabled:text-gray-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {printingTest === printer.systemName ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400/30 border-t-blue-400 rounded-full animate-spin" />
                        Imprimiendo...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir página de prueba
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4">Información del servicio</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">ID del Servicio</span>
                <span className="text-white font-mono">{credentials?.serviceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Servidor</span>
                <span className="text-white">{credentials?.serverUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Versión de la app</span>
                <span className="text-white">v{appVersion}</span>
              </div>
            </div>
          </div>

          {/* Update Section */}
          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4">Actualizaciones</h3>

            {/* Download Progress Bar */}
            {downloadStatus === 'downloading' && downloadProgress && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/80">
                    Descargando actualización...
                  </span>
                  <span className="text-blue-400 font-mono">
                    {downloadProgress.percent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/50 mt-1">
                  <span>
                    {(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <span>
                    {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s
                  </span>
                </div>
              </div>
            )}

            {/* Downloaded - Ready to Install */}
            {downloadStatus === 'downloaded' && (
              <div className="mb-4 p-3 bg-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Actualización lista</span>
                </div>
                <p className="text-sm text-white/70 mb-3">
                  La versión {updateStatus?.latestVersion} está lista para instalar.
                </p>
                <button
                  onClick={handleInstallUpdate}
                  className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  Reiniciar e Instalar Ahora
                </button>
              </div>
            )}

            {/* Check for Updates Button - only show when not downloading */}
            {downloadStatus !== 'downloading' && downloadStatus !== 'downloaded' && (
              <button
                onClick={handleCheckUpdates}
                disabled={checkingUpdates}
                className="w-full py-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-500/20 text-blue-400 disabled:text-gray-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {checkingUpdates ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400/30 border-t-blue-400 rounded-full animate-spin" />
                    Buscando actualizaciones...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Buscar Actualizaciones
                  </>
                )}
              </button>
            )}

            {/* Status message when not downloading */}
            {updateStatus && downloadStatus !== 'downloading' && downloadStatus !== 'downloaded' && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${
                updateStatus.available
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                <div className="flex items-center gap-2">
                  {updateStatus.available ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {updateStatus.message}
                </div>
                {updateStatus.available && updateStatus.currentVersion && (
                  <p className="text-xs mt-1 opacity-75">
                    v{updateStatus.currentVersion} → v{updateStatus.latestVersion}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors"
          >
            Desconectar Servicio
          </button>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-white/30 text-sm mt-8">
        LogiRapid Print Service v{appVersion}
      </p>
    </div>
  )
}
