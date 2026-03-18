package com.logirapid.warehouse.datawedge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class DataWedgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DataWedgeModule"
        private const val PROFILE_NAME = "WarehouseApp"
        private const val ACTION_DATAWEDGE = "com.symbol.datawedge.api.ACTION"
        private const val SCAN_ACTION = "com.logirapid.warehouse.ACTION.SCANNER_INPUT"
        private const val EXTRA_DATA_STRING = "com.symbol.datawedge.data_string"
        private const val EXTRA_LABEL_TYPE = "com.symbol.datawedge.label_type"
    }

    private var receiver: BroadcastReceiver? = null

    override fun getName(): String = "DataWedge"

    override fun initialize() {
        super.initialize()
        registerReceiver()
    }

    override fun invalidate() {
        unregisterReceiver()
        super.invalidate()
    }

    private fun registerReceiver() {
        if (receiver != null) return

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val action = intent?.action ?: return
                Log.d(TAG, "BroadcastReceiver onReceive: action=$action")

                if (action == SCAN_ACTION) {
                    val data = intent.getStringExtra(EXTRA_DATA_STRING)
                    if (data == null) {
                        Log.w(TAG, "Scan received but data_string is null. Extras: ${intent.extras?.keySet()?.toList()}")
                        return
                    }
                    val symbology = intent.getStringExtra(EXTRA_LABEL_TYPE) ?: "UNKNOWN"

                    Log.d(TAG, "Scan received: data=$data, symbology=$symbology")

                    val params = Arguments.createMap().apply {
                        putString("data", data)
                        putString("symbology", symbology)
                    }

                    sendEvent("onBarcodeScan", params)
                }
            }
        }

        val filter = IntentFilter(SCAN_ACTION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactApplicationContext.registerReceiver(receiver, filter)
        }

        Log.d(TAG, "BroadcastReceiver registered for $SCAN_ACTION (EXPORTED)")
    }

    private fun unregisterReceiver() {
        receiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering receiver", e)
            }
            receiver = null
        }
    }

    @ReactMethod
    fun configureProfile() {
        Log.d(TAG, "Configuring DataWedge profile: $PROFILE_NAME")

        sendDataWedgeCommand("com.symbol.datawedge.api.CREATE_PROFILE", PROFILE_NAME)

        val barcodeConfig = Bundle().apply {
            putString("PROFILE_NAME", PROFILE_NAME)
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE")

            val appConfig = Bundle().apply {
                putString("PACKAGE_NAME", "com.logirapid.warehouse")
                putStringArray("ACTIVITY_LIST", arrayOf("*"))
            }
            putParcelableArray("APP_LIST", arrayOf(appConfig))

            val pluginConfig = Bundle().apply {
                putString("PLUGIN_NAME", "BARCODE")
                putString("RESET_CONFIG", "true")
                val params = Bundle().apply {
                    putString("scanner_input_enabled", "true")
                    putString("scanner_selection", "auto")
                }
                putBundle("PARAM_LIST", params)
            }
            putBundle("PLUGIN_CONFIG", pluginConfig)
        }
        sendSetConfig(barcodeConfig)

        val intentConfig = Bundle().apply {
            putString("PROFILE_NAME", PROFILE_NAME)
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE")

            val pluginConfig = Bundle().apply {
                putString("PLUGIN_NAME", "INTENT")
                putString("RESET_CONFIG", "true")
                val params = Bundle().apply {
                    putString("intent_output_enabled", "true")
                    putString("intent_action", SCAN_ACTION)
                    putString("intent_delivery", "2")
                }
                putBundle("PARAM_LIST", params)
            }
            putBundle("PLUGIN_CONFIG", pluginConfig)
        }
        sendSetConfig(intentConfig)

        val keystrokeConfig = Bundle().apply {
            putString("PROFILE_NAME", PROFILE_NAME)
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE")

            val pluginConfig = Bundle().apply {
                putString("PLUGIN_NAME", "KEYSTROKE")
                putString("RESET_CONFIG", "true")
                val params = Bundle().apply {
                    putString("keystroke_output_enabled", "false")
                }
                putBundle("PARAM_LIST", params)
            }
            putBundle("PLUGIN_CONFIG", pluginConfig)
        }
        sendSetConfig(keystrokeConfig)

        Log.d(TAG, "DataWedge profile configured: BARCODE=on, INTENT=$SCAN_ACTION, KEYSTROKE=off")
    }

    private fun sendSetConfig(config: Bundle) {
        val intent = Intent().apply {
            action = ACTION_DATAWEDGE
            putExtra("com.symbol.datawedge.api.SET_CONFIG", config)
        }
        reactApplicationContext.sendBroadcast(intent)
    }

    private fun sendDataWedgeCommand(command: String, parameter: String) {
        val intent = Intent().apply {
            action = ACTION_DATAWEDGE
            putExtra(command, parameter)
        }
        reactApplicationContext.sendBroadcast(intent)
    }

    @ReactMethod
    fun softScanTrigger() {
        val intent = Intent().apply {
            action = ACTION_DATAWEDGE
            putExtra("com.symbol.datawedge.api.SOFT_SCAN_TRIGGER", "START_SCANNING")
        }
        reactApplicationContext.sendBroadcast(intent)
        Log.d(TAG, "Soft scan trigger sent")
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event $eventName", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
