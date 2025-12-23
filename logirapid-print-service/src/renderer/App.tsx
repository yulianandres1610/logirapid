import { useState, useEffect } from 'react'
import SetupPage from './pages/Setup'
import DashboardPage from './pages/Dashboard'

function App() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    try {
      const configured = await window.electronAPI.isConfigured()
      setIsConfigured(configured)
    } catch (error) {
      console.error('Failed to check configuration:', error)
      setIsConfigured(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSetupComplete = () => {
    setIsConfigured(true)
  }

  const handleLogout = () => {
    setIsConfigured(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isConfigured) {
    return <SetupPage onComplete={handleSetupComplete} />
  }

  return <DashboardPage onLogout={handleLogout} />
}

export default App
