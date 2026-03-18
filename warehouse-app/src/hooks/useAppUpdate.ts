import { useState, useEffect, useCallback, useRef } from 'react'
import {
  checkForUpdate,
  installUpdate,
  cancelDownload,
  getDownloadEventEmitter,
  type UpdateInfo,
  type DownloadProgress,
  type DownloadStatus,
} from '../services/app-updater'

interface UseAppUpdateReturn {
  updateInfo: UpdateInfo | null
  downloading: boolean
  progress: number
  error: string | null
  startUpdate: () => void
  dismiss: () => void
  showModal: boolean
}

export function useAppUpdate(): UseAppUpdateReturn {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const subscriptions = useRef<any[]>([])

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      // Wait 2 seconds after app start before checking
      console.log('[AppUpdate] Starting update check...')
      await new Promise(r => setTimeout(r, 2000))
      if (cancelled) return

      console.log('[AppUpdate] Checking for update now...')
      const info = await checkForUpdate()
      console.log('[AppUpdate] Check result:', JSON.stringify(info))
      if (cancelled) return

      if (info.updateAvailable) {
        console.log('[AppUpdate] Update available! Showing modal')
        setUpdateInfo(info)
        setShowModal(true)
      } else {
        console.log('[AppUpdate] No update available')
      }
    }

    check()

    return () => {
      cancelled = true
      subscriptions.current.forEach(s => s.remove())
    }
  }, [])

  const startUpdate = useCallback(() => {
    if (!updateInfo?.downloadUrl || !updateInfo?.version) return

    setDownloading(true)
    setProgress(0)
    setError(null)

    // Subscribe to native events
    const emitter = getDownloadEventEmitter()
    if (emitter) {
      subscriptions.current.forEach(s => s.remove())
      subscriptions.current = []

      const progressSub = emitter.addListener('ApkDownloadProgress', (data: DownloadProgress) => {
        setProgress(Math.round(data.progress))
      })

      const statusSub = emitter.addListener('ApkDownloadStatus', (data: DownloadStatus) => {
        if (data.status === 'completed') {
          setProgress(100)
        } else if (data.status === 'failed' || data.status === 'install_failed') {
          setError(data.error || 'Error durante la actualización')
          setDownloading(false)
        }
      })

      subscriptions.current = [progressSub, statusSub]
    }

    installUpdate(updateInfo.downloadUrl, updateInfo.version).catch(err => {
      setError(err.message || 'Error al iniciar descarga')
      setDownloading(false)
    })
  }, [updateInfo])

  const dismiss = useCallback(() => {
    if (updateInfo?.mandatory) return // Can't dismiss mandatory updates
    if (downloading) {
      cancelDownload()
    }
    setShowModal(false)
    setDownloading(false)
    setProgress(0)
    setError(null)
  }, [updateInfo?.mandatory, downloading])

  return {
    updateInfo,
    downloading,
    progress,
    error,
    startUpdate,
    dismiss,
    showModal,
  }
}
