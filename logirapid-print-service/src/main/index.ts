import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { isConfigured, getCredentials, saveCredentials, clearCredentials, getSettings, updateSettings } from '../store/credentials'
import { apiClient } from '../services/api-client'
import { printerService } from '../services/printer-service'
import { jobProcessor } from '../services/job-processor'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const isDev = process.env.NODE_ENV === 'development'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Load the renderer
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting && getSettings().minimizeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  updateTrayMenu()

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

function updateTrayMenu(): void {
  if (!tray) return

  const isActive = jobProcessor.isActive()
  const processingCount = jobProcessor.getProcessingCount()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'LogiRapid Print Service',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isActive ? `Activo (${processingCount} en proceso)` : 'Inactivo',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Abrir Panel',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    {
      label: isActive ? 'Pausar Servicio' : 'Iniciar Servicio',
      click: async () => {
        if (isActive) {
          await jobProcessor.stop()
        } else if (isConfigured()) {
          apiClient.initialize()
          await jobProcessor.start()
        }
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Actualizar Impresoras',
      click: async () => {
        await printerService.detectPrinters()
        mainWindow?.webContents.send('printers-updated')
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip(`LogiRapid Print Service - ${isActive ? 'Activo' : 'Inactivo'}`)
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Configuration
  ipcMain.handle('is-configured', () => isConfigured())

  ipcMain.handle('get-credentials', () => {
    const creds = getCredentials()
    if (!creds) return null
    // Don't send the secret to renderer
    return {
      serviceCode: creds.serviceCode,
      serverUrl: creds.serverUrl
    }
  })

  ipcMain.handle('save-credentials', async (_, data: {
    serviceCode: string
    apiKey: string
    apiSecret: string
    serverUrl: string
  }) => {
    try {
      // First, test the connection before saving
      const axios = require('axios')

      try {
        // Test connection to the server
        const testResponse = await axios.post(
          `${data.serverUrl.replace(/\/$/, '')}/api/print/services/${data.serviceCode}/register`,
          {
            platform: process.platform,
            hostname: require('os').hostname(),
            version: '1.0.0',
            printers: []
          },
          {
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.apiKey}:${data.apiSecret}`
            }
          }
        )

        if (!testResponse.data?.success) {
          return {
            success: false,
            error: testResponse.data?.error || 'Error de autenticación. Verifica las credenciales.'
          }
        }
      } catch (axiosError: any) {
        console.error('[Save Credentials] Connection test failed:', axiosError.message)

        if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
          return {
            success: false,
            error: 'No se pudo conectar al servidor. Verifica la URL.'
          }
        }

        if (axiosError.response?.status === 401) {
          return {
            success: false,
            error: 'Credenciales inválidas. Verifica el API Key y API Secret.'
          }
        }

        if (axiosError.response?.status === 404) {
          return {
            success: false,
            error: 'Servicio no encontrado. Verifica el código del servicio.'
          }
        }

        if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Tiempo de conexión agotado. Verifica tu conexión a internet.'
          }
        }

        return {
          success: false,
          error: `Error de conexión: ${axiosError.message}`
        }
      }

      // Connection successful, save credentials
      saveCredentials(data.serviceCode, data.apiKey, data.apiSecret, data.serverUrl)

      // Initialize API client and start service
      if (apiClient.initialize()) {
        await jobProcessor.start()
        updateTrayMenu()
      }

      return { success: true }
    } catch (error) {
      console.error('[Save Credentials] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar credenciales'
      }
    }
  })

  ipcMain.handle('clear-credentials', async () => {
    await jobProcessor.stop()
    clearCredentials()
    updateTrayMenu()
    return { success: true }
  })

  // Settings
  ipcMain.handle('get-settings', () => getSettings())

  ipcMain.handle('update-settings', (_, settings) => {
    updateSettings(settings)
    return { success: true }
  })

  // Printers
  ipcMain.handle('get-printers', async () => {
    const printers = await printerService.detectPrinters()
    return printers
  })

  ipcMain.handle('refresh-printers', async () => {
    const printers = await printerService.detectPrinters()
    return printers
  })

  // Service status
  ipcMain.handle('get-service-status', () => ({
    isRunning: jobProcessor.isActive(),
    processingCount: jobProcessor.getProcessingCount(),
    processingJobs: jobProcessor.getProcessingJobs().map(j => ({
      jobNumber: j.job.jobNumber,
      documentType: j.job.documentType,
      startedAt: j.startedAt
    }))
  }))

  ipcMain.handle('start-service', async () => {
    if (isConfigured() && apiClient.initialize()) {
      await jobProcessor.start()
      updateTrayMenu()
      return { success: true }
    }
    return { success: false, error: 'Not configured' }
  })

  ipcMain.handle('stop-service', async () => {
    await jobProcessor.stop()
    updateTrayMenu()
    return { success: true }
  })

  // App actions
  ipcMain.handle('open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('get-app-version', () => app.getVersion())
}

// App lifecycle
app.whenReady().then(async () => {
  setupIpcHandlers()
  createTray()

  // If configured, start the service automatically
  if (isConfigured()) {
    if (apiClient.initialize()) {
      await jobProcessor.start()
    }
    // Only show window if not configured or in dev mode
    if (isDev) {
      createWindow()
    }
  } else {
    // Show setup window
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Update tray periodically
  setInterval(updateTrayMenu, 10000)
})

app.on('before-quit', async () => {
  isQuitting = true
  await jobProcessor.stop()
})

app.on('window-all-closed', () => {
  // Don't quit on macOS unless explicitly quitting
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}
