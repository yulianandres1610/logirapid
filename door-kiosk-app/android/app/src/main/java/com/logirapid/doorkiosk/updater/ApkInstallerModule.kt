package com.logirapid.doorkiosk.updater

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class ApkInstallerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ApkInstaller"
        private const val EVENT_PROGRESS = "ApkDownloadProgress"
        private const val EVENT_STATUS = "ApkDownloadStatus"
    }

    private var downloadId: Long = -1
    private var progressHandler: Handler? = null
    private var progressRunnable: Runnable? = null

    override fun getName(): String = "ApkInstaller"

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
    fun downloadAndInstall(url: String, fileName: String, promise: Promise) {
        try {
            val context = reactApplicationContext

            val downloadDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            downloadDir?.listFiles()?.forEach { file ->
                if (file.name.endsWith(".apk") && file.name != fileName) {
                    file.delete()
                }
            }

            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Actualizando app...")
                .setDescription("Descargando nueva versión")
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setAllowedOverRoaming(true)
                .setAllowedOverMetered(true)

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

            val destFile = File(downloadDir, fileName)
            if (destFile.exists()) destFile.delete()

            downloadId = downloadManager.enqueue(request)

            val startParams = Arguments.createMap().apply {
                putString("status", "downloading")
                putDouble("downloadId", downloadId.toDouble())
            }
            sendEvent(EVENT_STATUS, startParams)

            startProgressTracking(downloadManager)

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) ?: -1
                    if (id != downloadId) return

                    stopProgressTracking()

                    try {
                        context.unregisterReceiver(this)
                    } catch (_: Exception) {}

                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor = downloadManager.query(query)

                    if (cursor != null && cursor.moveToFirst()) {
                        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))

                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            val completedParams = Arguments.createMap().apply {
                                putString("status", "completed")
                                putDouble("progress", 100.0)
                            }
                            sendEvent(EVENT_STATUS, completedParams)
                            installApk(destFile, promise)
                        } else {
                            val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                            val errorParams = Arguments.createMap().apply {
                                putString("status", "failed")
                                putString("error", "Download failed with reason: $reason")
                            }
                            sendEvent(EVENT_STATUS, errorParams)
                            promise.reject("DOWNLOAD_FAILED", "Download failed with reason: $reason")
                        }
                        cursor.close()
                    } else {
                        promise.reject("DOWNLOAD_FAILED", "Could not query download status")
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(
                    receiver,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED
                )
            } else {
                context.registerReceiver(
                    receiver,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
                )
            }

            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Error starting download", e)
            promise.reject("DOWNLOAD_ERROR", e.message)
        }
    }

    private fun startProgressTracking(downloadManager: DownloadManager) {
        progressHandler = Handler(Looper.getMainLooper())
        progressRunnable = object : Runnable {
            override fun run() {
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor: Cursor? = downloadManager.query(query)

                if (cursor != null && cursor.moveToFirst()) {
                    val bytesDownloaded = cursor.getLong(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                    )
                    val bytesTotal = cursor.getLong(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                    )
                    val status = cursor.getInt(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                    )

                    if (bytesTotal > 0) {
                        val progress = (bytesDownloaded * 100.0) / bytesTotal
                        val params = Arguments.createMap().apply {
                            putDouble("progress", progress)
                            putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                            putDouble("bytesTotal", bytesTotal.toDouble())
                        }
                        sendEvent(EVENT_PROGRESS, params)
                    }

                    cursor.close()

                    if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING) {
                        progressHandler?.postDelayed(this, 500)
                    }
                }
            }
        }
        progressHandler?.post(progressRunnable!!)
    }

    private fun stopProgressTracking() {
        progressRunnable?.let { progressHandler?.removeCallbacks(it) }
        progressHandler = null
        progressRunnable = null
    }

    private fun installApk(file: File, promise: Promise) {
        try {
            val context = reactApplicationContext
            val authority = "${context.packageName}.fileprovider"
            val apkUri = FileProvider.getUriForFile(context, authority, file)

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error installing APK", e)
            val errorParams = Arguments.createMap().apply {
                putString("status", "install_failed")
                putString("error", e.message)
            }
            sendEvent(EVENT_STATUS, errorParams)
        }
    }

    @ReactMethod
    fun cancelDownload(promise: Promise) {
        try {
            if (downloadId != -1L) {
                val dm = reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.remove(downloadId)
                stopProgressTracking()
                downloadId = -1
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
