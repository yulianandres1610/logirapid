package com.logirapid.audit

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.logirapid.audit.kiosk.KioskDeviceAdminReceiver

class MainActivity : ReactActivity() {

    companion object {
        private const val TAG = "AuditMainActivity"
    }

    override fun getMainComponentName(): String = "AuditApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen always on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Hide system UI (immersive mode)
        hideSystemUI()

        // Auto-grant permissions if device owner
        autoGrantPermissions()

        // Start lock task mode if we are device owner
        startKioskMode()
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
    }

    private fun hideSystemUI() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
    }

    private fun autoGrantPermissions() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = KioskDeviceAdminReceiver.getComponentName(this)

            Log.e(TAG, "autoGrantPermissions called, isDeviceOwner=${dpm.isDeviceOwnerApp(packageName)}")

            if (dpm.isDeviceOwnerApp(packageName)) {
                val permissions = arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_WIFI_STATE,
                    Manifest.permission.CHANGE_WIFI_STATE,
                    Manifest.permission.ACCESS_NETWORK_STATE,
                )

                for (perm in permissions) {
                    try {
                        val granted = dpm.setPermissionGrantState(
                            adminComponent,
                            packageName,
                            perm,
                            DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
                        )
                        Log.e(TAG, "Auto-granted $perm => $granted")
                    } catch (e: Exception) {
                        Log.e(TAG, "Could not auto-grant $perm: ${e.message}")
                    }
                }

                // Enable Location Services — required on Android 11+ to read WiFi SSID
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        dpm.setLocationEnabled(adminComponent, true)
                        Log.e(TAG, "Location services enabled via DPM")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Could not enable location services: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error auto-granting permissions", e)
        }
    }

    private fun startKioskMode() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = KioskDeviceAdminReceiver.getComponentName(this)

            if (dpm.isDeviceOwnerApp(packageName)) {
                // Whitelist this app for lock task mode
                dpm.setLockTaskPackages(adminComponent, arrayOf(
                    packageName,
                    "com.google.android.packageinstaller",
                    "com.android.packageinstaller"
                ))

                // Start lock task — locks device to this app
                startLockTask()
                Log.d(TAG, "Kiosk mode ACTIVE — device locked to this app")
            } else {
                Log.w(TAG, "Not device owner — kiosk lock not active. Run: adb shell dpm set-device-owner com.logirapid.audit/.kiosk.KioskDeviceAdminReceiver")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting kiosk mode", e)
        }
    }
}
