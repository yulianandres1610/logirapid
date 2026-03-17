package com.logirapid.doorkiosk

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.logirapid.doorkiosk.kiosk.KioskDeviceAdminReceiver

class MainActivity : ReactActivity() {

    companion object {
        private const val TAG = "KioskMainActivity"
    }

    override fun getMainComponentName(): String = "DoorKioskApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen always on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Hide system UI (immersive mode)
        hideSystemUI()

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

    private fun startKioskMode() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = KioskDeviceAdminReceiver.getComponentName(this)

            if (dpm.isDeviceOwnerApp(packageName)) {
                // Whitelist this app for lock task mode
                dpm.setLockTaskPackages(adminComponent, arrayOf(packageName))

                // Start lock task — locks device to this app
                startLockTask()
                Log.d(TAG, "Kiosk mode ACTIVE — device locked to this app")
            } else {
                Log.w(TAG, "Not device owner — kiosk lock not active. Run: adb shell dpm set-device-owner com.logirapid.doorkiosk/.kiosk.KioskDeviceAdminReceiver")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting kiosk mode", e)
        }
    }
}
