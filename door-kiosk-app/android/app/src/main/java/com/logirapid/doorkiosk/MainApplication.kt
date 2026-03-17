package com.logirapid.doorkiosk

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.logirapid.doorkiosk.datawedge.DataWedgePackage
import com.logirapid.doorkiosk.feedback.FeedbackPackage
import com.logirapid.doorkiosk.system.SystemPackage
import com.logirapid.doorkiosk.updater.ApkInstallerPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(DataWedgePackage())
          add(FeedbackPackage())
          add(SystemPackage())
          add(ApkInstallerPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
