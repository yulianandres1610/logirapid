import { create } from 'zustand'
import {
  checkForUpdate,
  installUpdate,
  cancelDownload,
  getDownloadEventEmitter,
  type UpdateInfo,
  type DownloadProgress,
  type DownloadStatus,
} from '../services/app-updater'

interface UpdateState {
  updateInfo: UpdateInfo | null
  downloading: boolean
  progress: number
  error: string | null
  showModal: boolean
  _initialized: boolean
  _subscriptions: any[]

  init: () => void
  checkNow: () => Promise<UpdateInfo>
  startUpdate: () => void
  dismiss: () => void
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  updateInfo: null,
  downloading: false,
  progress: 0,
  error: null,
  showModal: false,
  _initialized: false,
  _subscriptions: [],

  init: () => {
    if (get()._initialized) return
    set({ _initialized: true })

    setTimeout(async () => {
      console.log('[UpdateStore] Auto-checking for update...')
      try {
        const info = await checkForUpdate()
        console.log('[UpdateStore] Auto-check result:', JSON.stringify(info))
        if (info.updateAvailable) {
          set({ updateInfo: info, showModal: true })
        }
      } catch (err) {
        console.warn('[UpdateStore] Auto-check error:', err)
      }
    }, 2000)
  },

  checkNow: async () => {
    console.log('[UpdateStore] Manual check for update...')
    const info = await checkForUpdate()
    console.log('[UpdateStore] Manual check result:', JSON.stringify(info))
    if (info.updateAvailable) {
      set({ updateInfo: info, showModal: true, error: null })
    }
    return info
  },

  startUpdate: async () => {
    let { updateInfo } = get()

    try {
      const freshInfo = await checkForUpdate()
      if (freshInfo.updateAvailable && freshInfo.downloadUrl) {
        updateInfo = freshInfo
        set({ updateInfo: freshInfo })
      }
    } catch (err) {
      console.warn('[UpdateStore] Failed to refresh update info:', err)
    }

    if (!updateInfo?.downloadUrl || !updateInfo?.version) {
      set({ error: 'No hay información de actualización disponible' })
      return
    }

    set({ downloading: true, progress: 0, error: null })

    get()._subscriptions.forEach(s => s.remove())

    const emitter = getDownloadEventEmitter()
    const subs: any[] = []

    if (emitter) {
      const progressSub = emitter.addListener('ApkDownloadProgress', (data: DownloadProgress) => {
        set({ progress: Math.round(data.progress) })
      })

      const statusSub = emitter.addListener('ApkDownloadStatus', (data: DownloadStatus) => {
        if (data.status === 'completed') {
          set({ progress: 100 })
        } else if (data.status === 'failed' || data.status === 'install_failed') {
          set({
            error: data.error || 'Error durante la actualización',
            downloading: false,
          })
        }
      })

      subs.push(progressSub, statusSub)
    }

    set({ _subscriptions: subs })

    try {
      await installUpdate(updateInfo.downloadUrl, updateInfo.version)
    } catch (err: any) {
      set({
        error: err.message || 'Error al iniciar descarga',
        downloading: false,
      })
    }
  },

  dismiss: () => {
    const { updateInfo, downloading } = get()
    if (updateInfo?.mandatory) return
    if (downloading) {
      cancelDownload()
    }
    get()._subscriptions.forEach(s => s.remove())
    set({
      showModal: false,
      downloading: false,
      progress: 0,
      error: null,
      _subscriptions: [],
    })
  },
}))
