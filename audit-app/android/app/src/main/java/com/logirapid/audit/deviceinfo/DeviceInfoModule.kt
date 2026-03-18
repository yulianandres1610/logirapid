package com.logirapid.audit.deviceinfo

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.net.wifi.ScanResult
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*

class DeviceInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DeviceInfoModule"
    }

    override fun getName(): String = "SystemInfo"

    @ReactMethod
    fun getBatteryLevel(promise: Promise) {
        try {
            val batteryStatus = reactApplicationContext.registerReceiver(
                null,
                IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            )
            if (batteryStatus != null) {
                val level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                val isCharging = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1) == BatteryManager.BATTERY_STATUS_CHARGING
                val pct = if (scale > 0) (level * 100 / scale) else -1

                val result = Arguments.createMap()
                result.putInt("level", pct)
                result.putBoolean("charging", isCharging)
                promise.resolve(result)
            } else {
                promise.resolve(Arguments.createMap().apply {
                    putInt("level", -1)
                    putBoolean("charging", false)
                })
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error getting battery", e)
            promise.reject("BATTERY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentWifi(promise: Promise) {
        try {
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager
            val info = wifiManager.connectionInfo
            @Suppress("DEPRECATION")
            val ssid = info?.ssid?.removeSurrounding("\"") ?: ""

            if (ssid == "<unknown ssid>") {
                // Try fallback
                val fallback = getConnectedSsidFallback(wifiManager)
                if (fallback != null) {
                    promise.resolve(fallback)
                    return
                }
                // Check if we're actually connected via WiFi
                val connManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = connManager.activeNetwork
                val capabilities = if (network != null) connManager.getNetworkCapabilities(network) else null
                if (capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true) {
                    promise.resolve("WiFi")
                } else {
                    promise.resolve("")
                }
            } else {
                promise.resolve(ssid)
            }
        } catch (e: Exception) {
            promise.resolve("")
        }
    }

    @Suppress("DEPRECATION")
    private fun getConnectedSsidFallback(wifiManager: WifiManager): String? {
        try {
            val configuredNetworks = wifiManager.configuredNetworks ?: return null
            val connInfo = wifiManager.connectionInfo ?: return null
            val networkId = connInfo.networkId
            if (networkId == -1) return null
            val config = configuredNetworks.find { it.networkId == networkId }
            var ssid = config?.SSID ?: return null
            if (ssid.startsWith("\"") && ssid.endsWith("\"")) {
                ssid = ssid.substring(1, ssid.length - 1)
            }
            return ssid
        } catch (e: Exception) {
            return null
        }
    }

    @ReactMethod
    fun getWifiList(promise: Promise) {
        try {
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager

            if (!wifiManager.isWifiEnabled) {
                @Suppress("DEPRECATION")
                wifiManager.isWifiEnabled = true
            }

            @Suppress("DEPRECATION")
            wifiManager.startScan()

            val results = wifiManager.scanResults
            val networks = Arguments.createArray()
            val seen = mutableSetOf<String>()

            for (result: ScanResult in results) {
                val ssid = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    result.wifiSsid?.toString()?.removeSurrounding("\"") ?: ""
                } else {
                    @Suppress("DEPRECATION")
                    result.SSID ?: ""
                }

                if (ssid.isNotEmpty() && ssid !in seen) {
                    seen.add(ssid)
                    val network = Arguments.createMap()
                    network.putString("ssid", ssid)
                    network.putInt("level", WifiManager.calculateSignalLevel(result.level, 5))
                    network.putBoolean("secure", result.capabilities.contains("WPA") || result.capabilities.contains("WEP"))
                    networks.pushMap(network)
                }
            }

            promise.resolve(networks)
        } catch (e: Exception) {
            Log.w(TAG, "Error scanning wifi", e)
            promise.reject("WIFI_ERROR", e.message)
        }
    }

    @ReactMethod
    fun connectToWifi(ssid: String, password: String, promise: Promise) {
        try {
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager

            if (!wifiManager.isWifiEnabled) {
                @Suppress("DEPRECATION")
                wifiManager.isWifiEnabled = true
            }

            @Suppress("DEPRECATION")
            val existingConfigs = wifiManager.configuredNetworks
            if (existingConfigs != null) {
                for (config in existingConfigs) {
                    if (config.SSID == "\"$ssid\"") {
                        @Suppress("DEPRECATION")
                        wifiManager.removeNetwork(config.networkId)
                    }
                }
            }

            @Suppress("DEPRECATION")
            val wifiConfig = android.net.wifi.WifiConfiguration()
            wifiConfig.SSID = "\"$ssid\""

            if (password.isNotEmpty()) {
                wifiConfig.preSharedKey = "\"$password\""
            } else {
                wifiConfig.allowedKeyManagement.set(android.net.wifi.WifiConfiguration.KeyMgmt.NONE)
            }

            @Suppress("DEPRECATION")
            val netId = wifiManager.addNetwork(wifiConfig)
            if (netId == -1) {
                promise.resolve(false)
                return
            }

            @Suppress("DEPRECATION")
            wifiManager.disconnect()
            @Suppress("DEPRECATION")
            val success = wifiManager.enableNetwork(netId, true)
            @Suppress("DEPRECATION")
            wifiManager.reconnect()
            promise.resolve(success)
        } catch (e: Exception) {
            Log.w(TAG, "Error connecting wifi", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setWifiEnabled(enabled: Boolean, promise: Promise) {
        try {
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            val result = wifiManager.setWifiEnabled(enabled)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
