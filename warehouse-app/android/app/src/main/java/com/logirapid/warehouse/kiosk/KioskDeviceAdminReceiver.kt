package com.logirapid.warehouse.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context

class KioskDeviceAdminReceiver : DeviceAdminReceiver() {
    companion object {
        fun getComponentName(context: Context): ComponentName {
            return ComponentName(context, KioskDeviceAdminReceiver::class.java)
        }
    }
}
