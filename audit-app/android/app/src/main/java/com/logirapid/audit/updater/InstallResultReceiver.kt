package com.logirapid.audit.updater

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log

/**
 * Manifest-registered BroadcastReceiver for PackageInstaller results.
 * Required on Android 14+ (API 34) because PendingIntent with FLAG_MUTABLE
 * needs an explicit Intent (with component), not an implicit one.
 */
class InstallResultReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "InstallResultReceiver"

        /**
         * Callback set by ApkInstallerModule to handle install results.
         * Uses a static reference so the manifest-registered receiver
         * can communicate back to the module.
         */
        var onInstallResult: ((status: Int, message: String) -> Unit)? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(
            PackageInstaller.EXTRA_STATUS,
            PackageInstaller.STATUS_FAILURE
        )
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""

        Log.d(TAG, "Install result received: status=$status, message=$message")

        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                Log.d(TAG, "Install requires user confirmation")
                val confirmIntent = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(confirmIntent)
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                Log.d(TAG, "Install SUCCESS — app will restart automatically")
                onInstallResult?.invoke(status, message)
            }
            else -> {
                Log.e(TAG, "Install FAILED: status=$status, msg=$message")
                onInstallResult?.invoke(status, message)
            }
        }
    }
}
