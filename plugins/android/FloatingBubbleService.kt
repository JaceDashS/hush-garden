package com.jaces.hushgarden

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import kotlin.math.abs
import kotlin.math.hypot

class FloatingBubbleService : Service() {
    companion object {
        const val ACTION_SHOW = "com.jaces.hushgarden.BUBBLE_SHOW"
        const val ACTION_HIDE = "com.jaces.hushgarden.BUBBLE_HIDE"
        const val ACTION_SET_PLAYING = "com.jaces.hushgarden.BUBBLE_SET_PLAYING"
        const val EXTRA_PLAYING = "playing"
        private const val CHANNEL_ID = "hush_garden_bubble"
        private const val NOTIFICATION_ID = 4102

        @Volatile var isRunning: Boolean = false
        @Volatile var currentPlaying: Boolean = false
        @Volatile var onToggle: (() -> Unit)? = null
        @Volatile var onClosed: (() -> Unit)? = null
    }

    private lateinit var windowManager: WindowManager
    private var bubbleView: BubbleCanvasView? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var dismissView: DismissTargetView? = null
    private var dismissParams: WindowManager.LayoutParams? = null

    private var lastTapAt = 0L
    private var dragStartX = 0
    private var dragStartY = 0
    private var touchStartX = 0f
    private var touchStartY = 0f
    private var moved = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_HIDE -> {
                stopBubble()
                return START_NOT_STICKY
            }
            ACTION_SET_PLAYING -> {
                currentPlaying = intent.getBooleanExtra(EXTRA_PLAYING, currentPlaying)
                bubbleView?.updatePlaying(currentPlaying)
                if (isRunning) updateNotification()
                return START_STICKY
            }
            else -> {
                if (!Settings.canDrawOverlays(this)) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                currentPlaying = intent?.getBooleanExtra(EXTRA_PLAYING, currentPlaying) ?: currentPlaying
                startForegroundBubble()
                ensureOverlayViews()
                bubbleView?.updatePlaying(currentPlaying)
                isRunning = true
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        isRunning = false
        removeOverlayViews()
        super.onDestroy()
    }

    private fun stopBubble() {
        isRunning = false
        removeOverlayViews()
        onClosed?.invoke()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    private fun startForegroundBubble() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Hush Garden Floating Control",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent ?: Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Hush Garden")
            .setContentText(if (currentPlaying) "Playing in background" else "Paused")
            .setSmallIcon(applicationInfo.icon)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .build()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun ensureOverlayViews() {
        if (bubbleView != null) return
        val metrics = resources.displayMetrics
        val bubbleSize = dp(52)
        val margin = dp(12)

        val dSize = dp(56)
        val dParams = WindowManager.LayoutParams(
            dSize,
            dSize,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dp(28)
        }
        val dView = DismissTargetView(this).apply { visibility = View.GONE }
        windowManager.addView(dView, dParams)
        dismissView = dView
        dismissParams = dParams

        val bParams = WindowManager.LayoutParams(
            bubbleSize,
            bubbleSize,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = metrics.widthPixels - bubbleSize - margin
            y = metrics.heightPixels / 3
        }
        val bView = BubbleCanvasView(this)
        bView.setOnTouchListener { _, event -> handleTouch(event) }
        windowManager.addView(bView, bParams)
        bubbleView = bView
        bubbleParams = bParams
    }

    private fun removeOverlayViews() {
        bubbleView?.let { runCatching { windowManager.removeView(it) } }
        dismissView?.let { runCatching { windowManager.removeView(it) } }
        bubbleView = null
        dismissView = null
        bubbleParams = null
        dismissParams = null
    }

    private fun handleTouch(event: MotionEvent): Boolean {
        val params = bubbleParams ?: return false
        val bView = bubbleView ?: return false
        val metrics = resources.displayMetrics
        val bubbleSize = dp(52)
        val margin = dp(12)
        val slop = dp(6)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                dragStartX = params.x
                dragStartY = params.y
                touchStartX = event.rawX
                touchStartY = event.rawY
                moved = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = (event.rawX - touchStartX).toInt()
                val dy = (event.rawY - touchStartY).toInt()
                if (!moved && hypot(dx.toDouble(), dy.toDouble()) > slop) {
                    moved = true
                    dismissView?.visibility = View.VISIBLE
                }
                if (moved) {
                    params.x = (dragStartX + dx).coerceIn(0, metrics.widthPixels - bubbleSize)
                    params.y = (dragStartY + dy).coerceIn(dp(24), metrics.heightPixels - bubbleSize - dp(24))
                    windowManager.updateViewLayout(bView, params)
                    dismissView?.setActive(isOverDismiss(params, metrics.widthPixels, metrics.heightPixels, bubbleSize))
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                val overDismiss = moved && isOverDismiss(params, metrics.widthPixels, metrics.heightPixels, bubbleSize)
                dismissView?.setActive(false)
                dismissView?.visibility = View.GONE
                if (overDismiss) {
                    stopBubble()
                    return true
                }
                if (moved) {
                    params.x = if (params.x + bubbleSize / 2 < metrics.widthPixels / 2) margin else metrics.widthPixels - bubbleSize - margin
                    windowManager.updateViewLayout(bView, params)
                } else {
                    val now = SystemClock.uptimeMillis()
                    if (now - lastTapAt < 280L) {
                        lastTapAt = 0L
                        openApp()
                    } else {
                        lastTapAt = now
                        currentPlaying = !currentPlaying
                        bView.updatePlaying(currentPlaying)
                        updateNotification()
                        onToggle?.invoke()
                    }
                }
                return true
            }
        }
        return false
    }

    private fun isOverDismiss(params: WindowManager.LayoutParams, screenW: Int, screenH: Int, bubbleSize: Int): Boolean {
        val bx = params.x + bubbleSize / 2f
        val by = params.y + bubbleSize / 2f
        val dx = screenW / 2f
        val dy = screenH - dp(56).toFloat()
        return abs(bx - dx) < dp(56) && abs(by - dy) < dp(56)
    }

    private fun openApp() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        } ?: return
        startActivity(launchIntent)
    }

    private class BubbleCanvasView(context: Context) : FrameLayout(context) {
        private var playing = false
        private val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
        }
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4A4038")
            style = Paint.Style.FILL
        }

        init {
            background = bg
            elevation = 10f
            setWillNotDraw(false)
            updatePlaying(false)
        }

        fun updatePlaying(isPlaying: Boolean) {
            playing = isPlaying
            bg.setColor(Color.parseColor(if (playing) "#8FD6B4" else "#FFFAF2"))
            bg.setStroke((2 * resources.displayMetrics.density).toInt(), Color.parseColor(if (playing) "#5FB893" else "#ECDCC4"))
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val cx = width / 2f
            val cy = height / 2f
            val r = width * 0.19f
            if (playing) {
                val barW = r * 0.42f
                val gap = r * 0.34f
                canvas.drawRoundRect(cx - gap / 2f - barW, cy - r, cx - gap / 2f, cy + r, 3f, 3f, paint)
                canvas.drawRoundRect(cx + gap / 2f, cy - r, cx + gap / 2f + barW, cy + r, 3f, 3f, paint)
            } else {
                val path = Path().apply {
                    moveTo(cx - r * 0.55f, cy - r)
                    lineTo(cx + r * 0.95f, cy)
                    lineTo(cx - r * 0.55f, cy + r)
                    close()
                }
                canvas.drawPath(path, paint)
            }
        }
    }

    private class DismissTargetView(context: Context) : View(context) {
        private var active = false
        private val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#FFFAF2"))
            setStroke((2 * resources.displayMetrics.density).toInt(), Color.parseColor("#E2645C"))
        }
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E2645C")
            strokeWidth = 2.5f * resources.displayMetrics.density
            strokeCap = Paint.Cap.ROUND
        }

        init {
            background = bg
            elevation = 8f
        }

        fun setActive(isActive: Boolean) {
            if (active == isActive) return
            active = isActive
            bg.setColor(Color.parseColor(if (active) "#E2645C" else "#FFFAF2"))
            paint.color = Color.parseColor(if (active) "#FFFFFF" else "#E2645C")
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val cx = width / 2f
            val cy = height / 2f
            val d = width * 0.18f
            canvas.drawLine(cx - d, cy - d, cx + d, cy + d, paint)
            canvas.drawLine(cx + d, cy - d, cx - d, cy + d, paint)
        }
    }
}
