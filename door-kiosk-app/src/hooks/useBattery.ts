import { useState, useEffect } from 'react'
import { NativeModules } from 'react-native'

const { SystemInfo } = NativeModules

interface BatteryState {
  level: number
  charging: boolean
}

export function useBattery() {
  const [battery, setBattery] = useState<BatteryState>({ level: -1, charging: false })

  useEffect(() => {
    const fetch = async () => {
      try {
        const result = await SystemInfo.getBatteryLevel()
        setBattery({ level: result.level, charging: result.charging })
      } catch {
        // ignore
      }
    }

    fetch()
    const interval = setInterval(fetch, 30000) // update every 30s
    return () => clearInterval(interval)
  }, [])

  return battery
}
