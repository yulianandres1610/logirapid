import { useState, useEffect } from 'react'
import { NativeModules } from 'react-native'

const { SystemInfo } = NativeModules

interface DeviceStatus {
  battery: { level: number; charging: boolean }
  wifi: string
  time: string
  date: string
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatTime(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatDate(): string {
  const now = new Date()
  return `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`
}

export function useDeviceStatus() {
  const [status, setStatus] = useState<DeviceStatus>({
    battery: { level: -1, charging: false },
    wifi: '',
    time: formatTime(),
    date: formatDate(),
  })

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setStatus((prev) => ({ ...prev, time: formatTime(), date: formatDate() }))
    }, 1000)

    const fetchInfo = async () => {
      try {
        const result = await SystemInfo.getBatteryLevel()
        setStatus((prev) => ({ ...prev, battery: { level: result.level, charging: result.charging } }))
      } catch {}
      try {
        const ssid = await SystemInfo.getCurrentWifi()
        setStatus((prev) => ({ ...prev, wifi: ssid || '' }))
      } catch {}
    }

    fetchInfo()
    const infoInterval = setInterval(fetchInfo, 30000)

    return () => {
      clearInterval(timeInterval)
      clearInterval(infoInterval)
    }
  }, [])

  return status
}
