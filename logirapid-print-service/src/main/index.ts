import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { isConfigured, getCredentials, saveCredentials, clearCredentials, getSettings, updateSettings } from '../store/credentials'
import { apiClient } from '../services/api-client'
import { printerService } from '../services/printer-service'
import { jobProcessor } from '../services/job-processor'
import axios from 'axios'
import os from 'os'

// Auto-updater configuration
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
// Disable code signing verification (app is not signed)
autoUpdater.forceCodeSigning = false
// Force allow downgrade in case of rollback
autoUpdater.allowDowngrade = false

// Log the updater feed URL for debugging
autoUpdater.logger = {
  info: (msg: string) => console.log('[Auto-Updater]', msg),
  warn: (msg: string) => console.warn('[Auto-Updater]', msg),
  error: (msg: string) => console.error('[Auto-Updater]', msg),
  debug: (msg: string) => console.log('[Auto-Updater][debug]', msg),
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('[Auto-Updater] Checking for updates...')
  console.log('[Auto-Updater] Current version:', app.getVersion())
  mainWindow?.webContents.send('update-status', { status: 'checking' })
})

autoUpdater.on('update-available', (info) => {
  console.log('[Auto-Updater] Update available:', info.version)
  console.log('[Auto-Updater] Release date:', info.releaseDate)
  console.log('[Auto-Updater] Files:', JSON.stringify(info.files?.map(f => f.url)))
  mainWindow?.webContents.send('update-status', {
    status: 'available',
    version: info.version
  })
})

autoUpdater.on('update-not-available', (info) => {
  console.log('[Auto-Updater] No updates available. Latest:', info?.version, '| Current:', app.getVersion())
  mainWindow?.webContents.send('update-status', { status: 'not-available' })
})

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[Auto-Updater] Download progress: ${progressObj.percent.toFixed(1)}% (${(progressObj.transferred / 1048576).toFixed(1)}/${(progressObj.total / 1048576).toFixed(1)} MB)`)
  mainWindow?.webContents.send('update-download-progress', {
    percent: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  })
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Auto-Updater] ✓ Update downloaded successfully:', info.version)
  console.log('[Auto-Updater] Downloaded file:', info.downloadedFile)
  mainWindow?.webContents.send('update-status', {
    status: 'downloaded',
    version: info.version
  })

  // Auto-install after 10 seconds if user doesn't respond
  const autoInstallTimeout = setTimeout(() => {
    console.log('[Auto-Updater] Auto-installing update (timeout)...')
    autoUpdater.quitAndInstall(false, true)
  }, 30000)

  // Notify user about the update
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización Disponible',
    message: `Nueva versión ${info.version} descargada.`,
    detail: 'Se reiniciará la aplicación para instalar la actualización.',
    buttons: ['Reiniciar Ahora', 'Más Tarde'],
    defaultId: 0,
    noLink: true
  }).then((result) => {
    clearTimeout(autoInstallTimeout)
    if (result.response === 0) {
      console.log('[Auto-Updater] User chose to install now')
      // isSilent=false (show installer), isForceRunAfter=true (restart after install)
      autoUpdater.quitAndInstall(false, true)
    } else {
      console.log('[Auto-Updater] User chose to install later — will install on quit')
    }
  })
})

autoUpdater.on('error', (err) => {
  console.error('[Auto-Updater] ERROR:', err?.message || err)
  console.error('[Auto-Updater] Stack:', err?.stack)
  mainWindow?.webContents.send('update-status', {
    status: 'error',
    error: err.message
  })
})

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
      preload: join(__dirname, '../preload/index.js'),
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
        const printers = await printerService.detectPrinters()
        // Re-register with server to sync new printers
        if (apiClient.isInitialized()) {
          console.log('[Tray] Re-registering printers with server...')
          const result = await apiClient.register(printers)
          if (result.success) {
            console.log('[Tray] Printers synced with server successfully')
          } else {
            console.error('[Tray] Failed to sync printers:', result.error)
          }
        }
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
      const serverUrl = data.serverUrl.replace(/\/$/, '')
      const registerUrl = `${serverUrl}/api/print/services/${data.serviceCode}/register`

      console.log('[Save Credentials] =====================')
      console.log('[Save Credentials] Testing connection...')
      console.log('[Save Credentials] URL:', registerUrl)
      console.log('[Save Credentials] Service Code:', data.serviceCode)
      console.log('[Save Credentials] API Key:', data.apiKey.substring(0, 10) + '...')
      console.log('[Save Credentials] Platform:', process.platform)
      console.log('[Save Credentials] Hostname:', os.hostname())
      console.log('[Save Credentials] App Version:', app.getVersion())

      const requestBody = {
        platform: process.platform,
        hostname: os.hostname(),
        version: app.getVersion(),
        printers: []
      }

      console.log('[Save Credentials] Request body:', JSON.stringify(requestBody))

      try {
        // Test connection to the server
        const testResponse = await axios.post(
          registerUrl,
          requestBody,
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.apiKey}:${data.apiSecret}`
            },
            validateStatus: () => true // Accept ALL status codes to see what we get
          }
        )

        console.log('[Save Credentials] Response received!')
        console.log('[Save Credentials] Status:', testResponse.status)
        console.log('[Save Credentials] Status Text:', testResponse.statusText)
        console.log('[Save Credentials] Headers:', JSON.stringify(testResponse.headers))
        console.log('[Save Credentials] Data:', JSON.stringify(testResponse.data))

        if (testResponse.status === 401) {
          return {
            success: false,
            error: 'Credenciales inválidas. Verifica el API Key y API Secret.'
          }
        }

        if (testResponse.status === 404) {
          return {
            success: false,
            error: 'Servicio no encontrado. Verifica el código del servicio.'
          }
        }

        if (testResponse.status >= 500) {
          return {
            success: false,
            error: `Error del servidor (${testResponse.status}): ${testResponse.data?.error || 'Error interno'}`
          }
        }

        if (!testResponse.data?.success) {
          return {
            success: false,
            error: testResponse.data?.error || 'Error de autenticación. Verifica las credenciales.'
          }
        }

        console.log('[Save Credentials] Connection successful!')
        console.log('[Save Credentials] =====================')

      } catch (axiosError: any) {
        console.error('[Save Credentials] =====================')
        console.error('[Save Credentials] AXIOS ERROR CAUGHT!')
        console.error('[Save Credentials] Error name:', axiosError.name)
        console.error('[Save Credentials] Error code:', axiosError.code)
        console.error('[Save Credentials] Error message:', axiosError.message)
        console.error('[Save Credentials] Error stack:', axiosError.stack)

        if (axiosError.request) {
          console.error('[Save Credentials] Request was made but no response received')
        }

        if (axiosError.response) {
          console.error('[Save Credentials] Response status:', axiosError.response.status)
          console.error('[Save Credentials] Response data:', JSON.stringify(axiosError.response.data))
        }

        if (axiosError.cause) {
          console.error('[Save Credentials] Cause:', axiosError.cause)
        }

        // Handle specific error codes
        if (axiosError.code === 'ENOTFOUND') {
          return {
            success: false,
            error: 'No se pudo encontrar el servidor. Verifica la URL.'
          }
        }

        if (axiosError.code === 'ECONNREFUSED') {
          return {
            success: false,
            error: 'Conexión rechazada. El servidor no está disponible.'
          }
        }

        if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Tiempo de conexión agotado. Verifica tu conexión a internet.'
          }
        }

        if (axiosError.code === 'CERT_HAS_EXPIRED') {
          return {
            success: false,
            error: 'Certificado SSL expirado.'
          }
        }

        if (axiosError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || axiosError.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          return {
            success: false,
            error: 'Error de certificado SSL. Contacta al administrador.'
          }
        }

        // Generic error with full details
        return {
          success: false,
          error: `Error de conexión: ${axiosError.code || ''} - ${axiosError.message || 'Error desconocido'}`
        }
      }

      // Connection successful, save credentials
      saveCredentials(data.serviceCode, data.apiKey, data.apiSecret, serverUrl)
      console.log('[Save Credentials] Credentials saved successfully')

      // Initialize API client and start service
      if (apiClient.initialize()) {
        await jobProcessor.start()
        updateTrayMenu()
        console.log('[Save Credentials] Service started')
      }

      return { success: true }
    } catch (error: any) {
      console.error('[Save Credentials] =====================')
      console.error('[Save Credentials] UNEXPECTED ERROR!')
      console.error('[Save Credentials] Error:', error)
      console.error('[Save Credentials] Stack:', error?.stack)
      return {
        success: false,
        error: error?.message || 'Error inesperado al guardar credenciales'
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

    // Re-register with server to sync new printers
    if (apiClient.isInitialized()) {
      console.log('[IPC] Re-registering printers with server...')
      const result = await apiClient.register(printers)
      if (result.success) {
        console.log('[IPC] Printers synced with server successfully')
      } else {
        console.error('[IPC] Failed to sync printers with server:', result.error)
      }
    }

    return printers
  })

  ipcMain.handle('test-print', async (_, printerName: string) => {
    console.log('[IPC] Test print requested for:', printerName)
    const result = await printerService.printTestPage(printerName)
    return result
  })

  ipcMain.handle('check-printer-online', async (_, printerName: string) => {
    const isOnline = await printerService.checkPrinterOnline(printerName)
    return { isOnline }
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

  // Auto-update handlers
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      return { updateAvailable: false, message: 'Updates disabled in development mode' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        updateAvailable: result?.updateInfo?.version !== app.getVersion(),
        currentVersion: app.getVersion(),
        latestVersion: result?.updateInfo?.version
      }
    } catch (error) {
      console.error('[Auto-Updater] Check failed:', error)
      return { updateAvailable: false, error: 'Failed to check for updates' }
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  // Auto-start with system
  ipcMain.handle('get-auto-start', () => {
    const settings = app.getLoginItemSettings()
    return { enabled: settings.openAtLogin }
  })

  ipcMain.handle('set-auto-start', (_, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true, // Start minimized to tray
        path: process.execPath,
        args: ['--hidden']
      })
      return { success: true, enabled }
    } catch (error: any) {
      console.error('[Auto-Start] Error:', error)
      return { success: false, error: error.message }
    }
  })
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

  // Check for updates in production
  if (!isDev) {
    // Check for updates after 5 seconds to not slow startup
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 5000)

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 4 * 60 * 60 * 1000)
  }
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
