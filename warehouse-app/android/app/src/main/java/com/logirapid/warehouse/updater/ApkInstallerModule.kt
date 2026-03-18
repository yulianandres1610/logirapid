package com.logirapid.warehouse.updater

import android.app.DownloadManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream

class ApkInstallerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ApkInstaller"
        private const val EVENT_PROGRESS = "ApkDownloadProgress"
        private const val EVENT_STATUS = "ApkDownloadStatus"
        private const val ACTION_INSTALL_COMPLETE = "com.logirapid.warehouse.INSTALL_COMPLETE"
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

    private fun isDeviceOwner(): Boolean {
        return try {
            val context = reactApplicationContext
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            dpm.isDeviceOwnerApp(context.packageName)
        } catch (e: Exception) {
            false
        }
    }

    @ReactMethod
    fun downloadAndInstall(url: String, fileName: String, promise: Promise) {
        try {
            val context = reactApplicationContext

            // Resolve download directory (fallback to cacheDir if external is unavailable)
            val downloadDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: context.cacheDir

            // Clean up old APK files
            downloadDir.listFiles()?.forEach { file ->
                if (file.name.endsWith(".apk") && file.name != fileName) {
                    file.delete()
                }
            }

            // Delete existing file if present
            val destFile = File(downloadDir, fileName)
            if (destFile.exists()) destFile.delete()

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

            // FIX: Register completion receiver BEFORE starting the download
            // to avoid race condition where download completes before receiver is registered
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
                            // Get actual file path from DownloadManager
                            val localUri = cursor.getString(
                                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)
                            )
                            cursor.close()

                            val actualFile = if (localUri != null) {
                                try {
                                    File(Uri.parse(localUri).path!!)
                                } catch (_: Exception) {
                                    destFile
                                }
                            } else {
                                destFile
                            }

                            Log.d(TAG, "Download complete: ${actualFile.absolutePath}, size=${actualFile.length()}")

                            val completedParams = Arguments.createMap().apply {
                                putString("status", "completed")
                                putDouble("progress", 100.0)
                            }
                            sendEvent(EVENT_STATUS, completedParams)

                            // Install the APK
                            installApk(actualFile)
                        } else {
                            val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                            cursor.close()
                            Log.e(TAG, "Download failed: status=$status, reason=$reason")
                            val errorParams = Arguments.createMap().apply {
                                putString("status", "failed")
                                putString("error", "Descarga falló (código: $reason)")
                            }
                            sendEvent(EVENT_STATUS, errorParams)
                        }
                    } else {
                        cursor?.close()
                        Log.e(TAG, "Download query returned no results")
                        val errorParams = Arguments.createMap().apply {
                            putString("status", "failed")
                            putString("error", "No se pudo verificar la descarga")
                        }
                        sendEvent(EVENT_STATUS, errorParams)
                    }
                }
            }

            // Register receiver FIRST (before enqueue)
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

            // Now enqueue the download (after receiver is registered)
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Actualizando app...")
                .setDescription("Descargando nueva versión")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN)
                .setAllowedOverRoaming(true)
                .setAllowedOverMetered(true)

            // Use external files dir if available, otherwise cache dir
            if (context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) != null) {
                request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
            } else {
                request.setDestinationUri(Uri.fromFile(destFile))
            }

            downloadId = downloadManager.enqueue(request)
            Log.d(TAG, "Download enqueued: id=$downloadId, url=$url")

            // Send initial status
            val startParams = Arguments.createMap().apply {
                putString("status", "downloading")
                putDouble("downloadId", downloadId.toDouble())
            }
            sendEvent(EVENT_STATUS, startParams)

            // Start progress tracking
            startProgressTracking(downloadManager)

            promise.resolve(true)

        } catch (e: Exception) {
            Log.e(TAG, "Error starting download", e)
            val errorParams = Arguments.createMap().apply {
                putString("status", "failed")
                putString("error", "Error al iniciar descarga: ${e.message}")
            }
            sendEvent(EVENT_STATUS, errorParams)
            promise.reject("DOWNLOAD_ERROR", e.message)
        }
    }

    private fun startProgressTracking(downloadManager: DownloadManager) {
        progressHandler = Handler(Looper.getMainLooper())
        progressRunnable = object : Runnable {
            override fun run() {
                try {
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
                    } else {
                        cursor?.close()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error tracking progress", e)
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

    private fun installApk(file: File) {
        if (!file.exists() || file.length() == 0L) {
            Log.e(TAG, "APK file does not exist or is empty: ${file.absolutePath}")
            val errorParams = Arguments.createMap().apply {
                putString("status", "install_failed")
                putString("error", "El archivo APK no existe o está vacío")
            }
            sendEvent(EVENT_STATUS, errorParams)
            return
        }

        if (isDeviceOwner()) {
            silentInstallApk(file)
        } else {
            Log.w(TAG, "Not device owner — falling back to intent-based install")
            intentInstallApk(file)
        }
    }

    private fun silentInstallApk(file: File) {
        try {
            val context = reactApplicationContext

            // Stop lock task mode BEFORE installing the update.
            // Android cannot replace the current app while it's in lock task mode.
            // The new version will re-enter lock task mode in its onCreate.
            try {
                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    activity.stopLockTask()
                    Log.d(TAG, "Lock task mode stopped for self-update")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not stop lock task (may not be active): ${e.message}")
            }

            val packageInstaller = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            )
            params.setAppPackageName(context.packageName)

            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            Log.d(TAG, "Silent install: session $sessionId created, APK size=${file.length()}")

            // Write APK to session
            val inputStream = FileInputStream(file)
            val outputStream = session.openWrite("update.apk", 0, file.length())

            val buffer = ByteArray(65536)
            var bytesRead: Int
            var totalWritten = 0L

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                totalWritten += bytesRead
            }

            session.fsync(outputStream)
            outputStream.close()
            inputStream.close()

            Log.d(TAG, "Silent install: wrote $totalWritten bytes to session")

            // Set up the static callback on InstallResultReceiver to handle the result
            InstallResultReceiver.onInstallResult = { status, message ->
                Log.d(TAG, "Install result callback: status=$status, message=$message")

                when (status) {
                    PackageInstaller.STATUS_SUCCESS -> {
                        Log.d(TAG, "Silent install SUCCESS — app will restart automatically")
                        file.delete()
                    }
                    else -> {
                        Log.e(TAG, "Silent install FAILED: status=$status, msg=$message")
                        val errorParams = Arguments.createMap().apply {
                            putString("status", "install_failed")
                            putString("error", "Instalación falló: $message (status=$status)")
                        }
                        sendEvent(EVENT_STATUS, errorParams)

                        // Re-enter lock task mode since install failed
                        try {
                            val activity = reactApplicationContext.currentActivity
                            activity?.startLockTask()
                            Log.d(TAG, "Lock task mode re-entered after failed install")
                        } catch (e: Exception) {
                            Log.w(TAG, "Could not re-enter lock task: ${e.message}")
                        }
                    }
                }
            }

            // FIX for Android 14+ (API 34): Use an EXPLICIT Intent targeting the
            // manifest-registered InstallResultReceiver. Android 14+ disallows
            // PendingIntent with FLAG_MUTABLE and an implicit Intent.
            val installIntent = Intent(context, InstallResultReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                sessionId,
                installIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            session.commit(pendingIntent.intentSender)
            Log.d(TAG, "Silent install: session committed")

        } catch (e: Exception) {
            Log.e(TAG, "Silent install error", e)
            val errorParams = Arguments.createMap().apply {
                putString("status", "install_failed")
                putString("error", "Error en instalación silenciosa: ${e.message}")
            }
            sendEvent(EVENT_STATUS, errorParams)

            // Re-enter lock task mode since install failed
            try {
                val activity = reactApplicationContext.currentActivity
                activity?.startLockTask()
            } catch (_: Exception) {}
        }
    }

    /**
     * Fallback: intent-based install (only used when NOT device owner).
     */
    private fun intentInstallApk(file: File) {
        try {
            val context = reactApplicationContext
            val authority = "${context.packageName}.fileprovider"
            val apkUri = androidx.core.content.FileProvider.getUriForFile(context, authority, file)

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Intent install error", e)
            val errorParams = Arguments.createMap().apply {
                putString("status", "install_failed")
                putString("error", "Error al abrir instalador: ${e.message}")
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
