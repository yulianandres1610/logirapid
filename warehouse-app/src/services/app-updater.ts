import { NativeModules, NativeEventEmitter } from 'react-native'
import { CONFIG } from '@/src/config'

const APP_ID = 'warehouse'
const CURRENT_VERSION_CODE = 10008
const CURRENT_VERSION = '1.0.8'

export interface UpdateInfo {
  updateAvailable: boolean
  version?: string
  versionCode?: number
  mandatory?: boolean
  changelog?: string
  downloadUrl?: string
  apkSize?: number | null
  releasedAt?: string
}

export interface DownloadProgress {
  progress: number
  bytesDownloaded: number
  bytesTotal: number
}

export interface DownloadStatus {
  status: 'downloading' | 'completed' | 'failed' | 'install_failed'
  error?: string
  progress?: number
  downloadId?: number
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const url = `${CONFIG.BASE_URL}/api/apps/${APP_ID}/check-update?versionCode=${CURRENT_VERSION_CODE}`
    const res = await fetch(url)
    const json = await res.json()

    if (!json.success) {
      console.warn('[AppUpdater] Check failed:', json.error)
      return { updateAvailable: false }
    }

    return json.data
  } catch (error) {
    console.warn('[AppUpdater] Check error:', error)
    return { updateAvailable: false }
  }
}

export function installUpdate(downloadUrl: string, version: string): Promise<boolean> {
  const { ApkInstaller } = NativeModules
  if (!ApkInstaller) {
    console.warn('[AppUpdater] ApkInstaller native module not available')
    return Promise.reject(new Error('ApkInstaller not available'))
  }

  const fileName = `${APP_ID}-${version}.apk`
  return ApkInstaller.downloadAndInstall(downloadUrl, fileName)
}

export function cancelDownload(): Promise<boolean> {
  const { ApkInstaller } = NativeModules
  if (!ApkInstaller) return Promise.resolve(false)
  return ApkInstaller.cancelDownload()
}

export function getDownloadEventEmitter(): NativeEventEmitter | null {
  const { ApkInstaller } = NativeModules
  if (!ApkInstaller) return null
  return new NativeEventEmitter(ApkInstaller)
}

export function getCurrentVersion() {
  return { version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE }
}
