import Store from 'electron-store'
import { safeStorage } from 'electron'

interface CredentialsData {
  serviceId: number
  apiKey: string
  apiSecretEncrypted: string
  serverUrl: string
  configured: boolean
}

interface StoreSchema {
  credentials: CredentialsData | null
  settings: {
    pollInterval: number
    heartbeatInterval: number
    autoStart: boolean
    minimizeToTray: boolean
    showNotifications: boolean
  }
}

const store = new Store<StoreSchema>({
  defaults: {
    credentials: null,
    settings: {
      pollInterval: 5000,
      heartbeatInterval: 30000,
      autoStart: true,
      minimizeToTray: true,
      showNotifications: true
    }
  }
})

export function isConfigured(): boolean {
  const credentials = store.get('credentials')
  return credentials !== null && credentials.configured
}

export function saveCredentials(
  serviceId: number,
  apiKey: string,
  apiSecret: string,
  serverUrl: string
): void {
  // Encrypt the API secret using Electron's safeStorage
  const encryptedSecret = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(apiSecret).toString('base64')
    : Buffer.from(apiSecret).toString('base64')

  store.set('credentials', {
    serviceId,
    apiKey,
    apiSecretEncrypted: encryptedSecret,
    serverUrl: serverUrl.replace(/\/$/, ''), // Remove trailing slash
    configured: true
  })
}

export function getCredentials(): {
  serviceId: number
  apiKey: string
  apiSecret: string
  serverUrl: string
} | null {
  const credentials = store.get('credentials')
  if (!credentials || !credentials.configured) {
    return null
  }

  // Decrypt the API secret
  let apiSecret: string
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(credentials.apiSecretEncrypted, 'base64')
      apiSecret = safeStorage.decryptString(buffer)
    } else {
      apiSecret = Buffer.from(credentials.apiSecretEncrypted, 'base64').toString()
    }
  } catch {
    console.error('Failed to decrypt API secret')
    return null
  }

  return {
    serviceId: credentials.serviceId,
    apiKey: credentials.apiKey,
    apiSecret,
    serverUrl: credentials.serverUrl
  }
}

export function clearCredentials(): void {
  store.set('credentials', null)
}

export function getSettings() {
  return store.get('settings')
}

export function updateSettings(settings: Partial<StoreSchema['settings']>) {
  const current = store.get('settings')
  store.set('settings', { ...current, ...settings })
}

export function getServerUrl(): string {
  return store.get('credentials')?.serverUrl || ''
}

export default store
