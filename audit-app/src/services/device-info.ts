import { NativeModules } from 'react-native'

const { SystemInfo } = NativeModules

export interface WifiNetwork {
  ssid: string
  level: number
  secure: boolean
}

export async function scanWifiNetworks(): Promise<WifiNetwork[]> {
  if (!SystemInfo) return []
  try {
    return await SystemInfo.getWifiList()
  } catch {
    return []
  }
}

export async function connectToWifi(ssid: string, password: string): Promise<boolean> {
  if (!SystemInfo) return false
  try {
    return await SystemInfo.connectToWifi(ssid, password)
  } catch {
    return false
  }
}

export async function setWifiEnabled(enabled: boolean): Promise<boolean> {
  if (!SystemInfo) return false
  try {
    return await SystemInfo.setWifiEnabled(enabled)
  } catch {
    return false
  }
}

export async function getWifiInfo() {
  if (!SystemInfo) return { enabled: false, ssid: '', signalLevel: 0, ip: '', isConnected: false }
  try {
    const ssid = await SystemInfo.getCurrentWifi()
    return {
      enabled: true,
      ssid: ssid || '',
      signalLevel: ssid ? 3 : 0,
      ip: '',
      isConnected: !!ssid,
    }
  } catch {
    return { enabled: false, ssid: '', signalLevel: 0, ip: '', isConnected: false }
  }
}
