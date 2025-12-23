import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  isConfigured: () => ipcRenderer.invoke('is-configured'),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (data: {
    serviceId: number
    apiKey: string
    apiSecret: string
    serverUrl: string
  }) => ipcRenderer.invoke('save-credentials', data),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('update-settings', settings),

  // Printers
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  refreshPrinters: () => ipcRenderer.invoke('refresh-printers'),

  // Service
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  startService: () => ipcRenderer.invoke('start-service'),
  stopService: () => ipcRenderer.invoke('stop-service'),

  // App
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Events
  onPrintersUpdated: (callback: () => void) => {
    ipcRenderer.on('printers-updated', callback)
    return () => ipcRenderer.removeListener('printers-updated', callback)
  }
})

// Type definitions for the renderer
declare global {
  interface Window {
    electronAPI: {
      isConfigured: () => Promise<boolean>
      getCredentials: () => Promise<{ serviceId: number; serverUrl: string } | null>
      saveCredentials: (data: {
        serviceId: number
        apiKey: string
        apiSecret: string
        serverUrl: string
      }) => Promise<{ success: boolean; error?: string }>
      clearCredentials: () => Promise<{ success: boolean }>
      getSettings: () => Promise<{
        pollInterval: number
        heartbeatInterval: number
        autoStart: boolean
        minimizeToTray: boolean
        showNotifications: boolean
      }>
      updateSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>
      getPrinters: () => Promise<Array<{
        systemName: string
        printerName: string
        printerType: string
        connectionType: string
        isOnline: boolean
        isDefault: boolean
      }>>
      refreshPrinters: () => Promise<Array<unknown>>
      getServiceStatus: () => Promise<{
        isRunning: boolean
        processingCount: number
        processingJobs: Array<{
          jobNumber: string
          documentType: string
          startedAt: Date
        }>
      }>
      startService: () => Promise<{ success: boolean; error?: string }>
      stopService: () => Promise<{ success: boolean }>
      openExternal: (url: string) => Promise<void>
      getAppVersion: () => Promise<string>
      onPrintersUpdated: (callback: () => void) => () => void
    }
  }
}
