package com.logirapid.doorkiosk.system

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSuggestion
import android.net.wifi.ScanResult
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SystemModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "SystemModule"
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
    fun getWifiList(promise: Promise) {
        try {
            val wifiManager = reactApplicationContext.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager

            if (!wifiManager.isWifiEnabled) {
                wifiManager.isWifiEnabled = true
            }

            wifiManager.startScan()

            // Use cached results (startScan is async but scanResults returns last known)
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
                wifiManager.isWifiEnabled = true
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ — use WifiNetworkSuggestion
                val suggestion = WifiNetworkSuggestion.Builder()
                    .setSsid(ssid)
                    .setWpa2Passphrase(password)
                    .build()

                wifiManager.removeNetworkSuggestions(listOf(suggestion))
                val status = wifiManager.addNetworkSuggestions(listOf(suggestion))

                if (status == WifiManager.STATUS_NETWORK_SUGGESTIONS_SUCCESS) {
                    promise.resolve("Conectando a $ssid...")
                } else {
                    promise.reject("WIFI_ERROR", "Error al sugerir red: $status")
                }
            } else {
                // Android 9 and below — use WifiConfiguration
                @Suppress("DEPRECATION")
                val conf = android.net.wifi.WifiConfiguration()
                @Suppress("DEPRECATION")
                conf.SSID = "\"$ssid\""
                @Suppress("DEPRECATION")
                conf.preSharedKey = "\"$password\""

                @Suppress("DEPRECATION")
                val netId = wifiManager.addNetwork(conf)
                if (netId != -1) {
                    @Suppress("DEPRECATION")
                    wifiManager.disconnect()
                    @Suppress("DEPRECATION")
                    wifiManager.enableNetwork(netId, true)
                    @Suppress("DEPRECATION")
                    wifiManager.reconnect()
                    promise.resolve("Conectado a $ssid")
                } else {
                    promise.reject("WIFI_ERROR", "Error al conectar")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error connecting wifi", e)
            promise.reject("WIFI_ERROR", e.message)
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
            promise.resolve(if (ssid == "<unknown ssid>") "" else ssid)
        } catch (e: Exception) {
            promise.resolve("")
        }
    }
}
