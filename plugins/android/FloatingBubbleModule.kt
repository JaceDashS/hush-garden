package com.jaces.hushgarden

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class FloatingBubbleModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FloatingBubble"

    init {
        FloatingBubbleService.onToggle = { emit("floatingBubbleToggle") }
        FloatingBubbleService.onClosed = { emit("floatingBubbleClosed") }
    }

    private fun emit(eventName: String) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, null)
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestOverlayPermission() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun show(playing: Boolean, promise: Promise) {
        if (!Settings.canDrawOverlays(reactContext)) {
            promise.resolve(false)
            return
        }
        val intent = Intent(reactContext, FloatingBubbleService::class.java).apply {
            action = FloatingBubbleService.ACTION_SHOW
            putExtra(FloatingBubbleService.EXTRA_PLAYING, playing)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun hide() {
        val intent = Intent(reactContext, FloatingBubbleService::class.java).apply {
            action = FloatingBubbleService.ACTION_HIDE
        }
        reactContext.startService(intent)
    }

    @ReactMethod
    fun setPlaying(playing: Boolean) {
        if (!FloatingBubbleService.isRunning) return
        val intent = Intent(reactContext, FloatingBubbleService::class.java).apply {
            action = FloatingBubbleService.ACTION_SET_PLAYING
            putExtra(FloatingBubbleService.EXTRA_PLAYING, playing)
        }
        reactContext.startService(intent)
    }

    @ReactMethod
    fun isShowing(promise: Promise) {
        promise.resolve(FloatingBubbleService.isRunning)
    }
}
