package com.logirapid.audit

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.logirapid.audit.datawedge.DataWedgePackage
import com.logirapid.audit.feedback.FeedbackPackage
import com.logirapid.audit.deviceinfo.DeviceInfoPackage
import com.logirapid.audit.updater.ApkInstallerPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(DataWedgePackage())
          add(FeedbackPackage())
          add(DeviceInfoPackage())
          add(ApkInstallerPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
