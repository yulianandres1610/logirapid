package com.logirapid.audit.feedback

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FeedbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FeedbackModule"
    }

    override fun getName(): String = "Feedback"

    private fun getVibrator(): Vibrator {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = reactApplicationContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    private fun setMaxMediaVolume() {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVol, 0)
        } catch (e: Exception) {
            Log.w(TAG, "Could not set max volume", e)
        }
    }

    @ReactMethod
    fun playSuccessBeep() {
        try {
            setMaxMediaVolume()
            // Double ascending tone — short high beep + higher beep = satisfying confirmation
            val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 80)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 120)
            }, 100)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                toneGen.release()
            }, 300)
        } catch (e: Exception) {
            Log.w(TAG, "Error playing success beep", e)
        }
    }

    @ReactMethod
    fun playErrorBeep() {
        try {
            setMaxMediaVolume()
            val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGen.startTone(ToneGenerator.TONE_SUP_ERROR, 400)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                toneGen.release()
            }, 450)
        } catch (e: Exception) {
            Log.w(TAG, "Error playing error beep", e)
        }
    }

    @ReactMethod
    fun vibrateSuccess() {
        try {
            val vibrator = getVibrator()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 80, 40, 80), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 80, 40, 80), -1)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error vibrating success", e)
        }
    }

    @ReactMethod
    fun vibrateError() {
        try {
            val vibrator = getVibrator()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 150, 80, 150), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 150, 80, 150), -1)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error vibrating error", e)
        }
    }
}
