package com.susagi.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.Response
import okio.ByteString
import org.json.JSONObject

/**
 * The actual "real call, not a demo" piece. Two hard platform facts shape
 * everything here:
 *
 * 1. No app can read the other party's audio off a normal cellular call --
 *    Android never exposes that stream to third-party apps. What IS
 *    readable is the phone's own microphone, which only picks up the other
 *    party's voice when the call is on speakerphone. So this only ever
 *    captures audio while `AudioManager.isSpeakerphoneOn()` is true, and
 *    stops the instant it isn't -- never silently listens otherwise.
 *
 * 2. AudioSource.MIC is used deliberately instead of VOICE_COMMUNICATION.
 *    VOICE_COMMUNICATION applies echo cancellation, which exists
 *    specifically to *remove* the speaker's own output from the mic
 *    signal -- exactly the audio this needs to keep.
 *
 * Streams raw 16kHz mono PCM16 to the same /api/ws/call-stream endpoint
 * the browser demo already uses (backend/app/main.py) -- zero backend
 * changes needed, this is just another client of the same real pipeline
 * (Vosk transcription, lexicon scoring, and the Behavioral Impersonation
 * Engine's Gemini cross-reference).
 */
class CallMonitorService : Service() {

    companion object {
        const val EXTRA_BASE_URL = "base_url"
        const val EXTRA_PROFILE_ID = "profile_id"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_ID_PERSISTENT = "voice_guard_status"
        private const val CHANNEL_ID_ALERT = "voice_guard_alert"
        private const val NOTIF_ID_PERSISTENT = 1
        private const val NOTIF_ID_ALERT = 2

        data class MonitorState(
            val listening: Boolean = false,
            val onCall: Boolean = false,
            val capturing: Boolean = false,
            val score: Int = 0,
            val behavioralScore: Int? = null,
            val behavioralReason: String? = null,
            val lastTranscript: String = "",
            val statusText: String = "Idle",
        )

        val state = MutableStateFlow(MonitorState())
    }

    private lateinit var scope: CoroutineScope
    private var monitorJob: Job? = null
    private var captureJob: Job? = null
    private var webSocket: WebSocket? = null
    private var audioRecord: AudioRecord? = null
    private lateinit var audioManager: AudioManager
    private lateinit var telephonyManager: TelephonyManager
    private val client = OkHttpClient()

    private var baseUrl: String = ""
    private var profileId: Int? = null
    private var isCallActive = false

    private val phoneStateListener = object : PhoneStateListener() {
        @Deprecated("Used for API < 31 only")
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            isCallActive = state == TelephonyManager.CALL_STATE_OFFHOOK
        }
    }

    override fun onCreate() {
        super.onCreate()
        scope = CoroutineScope(Dispatchers.Default)
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        baseUrl = intent?.getStringExtra(EXTRA_BASE_URL) ?: baseUrl
        profileId = intent?.getIntExtra(EXTRA_PROFILE_ID, -1)?.takeIf { it >= 0 }

        startForeground(
            NOTIF_ID_PERSISTENT,
            buildPersistentNotification("Watching for calls..."),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0,
        )

        registerCallStateListener()
        state.value = state.value.copy(listening = true, statusText = "Watching for calls...")

        monitorJob?.cancel()
        monitorJob = scope.launch { monitorLoop() }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterCallStateListener()
        stopCapture()
        monitorJob?.cancel()
        state.value = MonitorState()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun registerCallStateListener() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            telephonyManager.registerTelephonyCallback(
                mainExecutor,
                object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        isCallActive = state == TelephonyManager.CALL_STATE_OFFHOOK
                    }
                },
            )
        } else {
            @Suppress("DEPRECATION")
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
        }
    }

    private fun unregisterCallStateListener() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            @Suppress("DEPRECATION")
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
        }
    }

    /** Polls call + speakerphone state every ~700ms and starts/stops
     * capture on transitions -- there's no reliable cross-version
     * "speakerphone changed" broadcast, so this is the honest option. */
    private suspend fun monitorLoop() {
        while (true) {
            val onSpeaker = audioManager.isSpeakerphoneOn
            val shouldCapture = isCallActive && onSpeaker

            if (shouldCapture && captureJob == null) {
                startCapture()
            } else if (!shouldCapture && captureJob != null) {
                stopCapture()
            }

            state.value = state.value.copy(
                onCall = isCallActive,
                capturing = captureJob != null,
                statusText = when {
                    !isCallActive -> "Watching for calls..."
                    !onSpeaker -> "Call active -- switch to speaker to monitor"
                    else -> "Monitoring this call"
                },
            )
            updatePersistentNotification()
            delay(700)
        }
    }

    private fun startCapture() {
        if (androidx.core.content.ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.RECORD_AUDIO
            ) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
        )
        if (minBuf <= 0) return

        val record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBuf * 4,
        )
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            return
        }
        audioRecord = record

        openWebSocket()

        record.startRecording()
        captureJob = scope.launch {
            val buffer = ByteArray(minBuf)
            while (true) {
                val read = record.read(buffer, 0, buffer.size)
                if (read > 0) {
                    webSocket?.send(ByteString.of(*buffer.copyOfRange(0, read)))
                }
            }
        }
    }

    private fun stopCapture() {
        captureJob?.cancel()
        captureJob = null
        audioRecord?.let {
            try { it.stop() } catch (_: Exception) {}
            it.release()
        }
        audioRecord = null
        webSocket?.close(1000, "call ended or speaker off")
        webSocket = null
    }

    private fun openWebSocket() {
        val url = SusagiApi.wsUrl(baseUrl, profileId)
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                state.value = state.value.copy(statusText = "Connection lost -- retrying next call")
            }
        })
    }

    private fun handleMessage(text: String) {
        val json = try { JSONObject(text) } catch (_: Exception) { return }
        when (json.optString("type")) {
            "behavioral_update" -> {
                val bScore = json.optInt("behavioral_score", 0)
                val reason = json.optString("reason", "")
                state.value = state.value.copy(behavioralScore = bScore, behavioralReason = reason)
                if (bScore >= 85) showCriticalAlert("This doesn't sound like the person it claims to be", reason)
            }
            "escalation" -> {
                showCriticalAlert("Protection activated", json.optString("message", ""))
            }
            else -> {
                val score = json.optInt("score", state.value.score)
                val transcript = json.optString("transcript", state.value.lastTranscript)
                state.value = state.value.copy(score = score, lastTranscript = transcript)
                if (score >= 75) showCriticalAlert("High risk call in progress", "Live risk score: $score/100")
            }
        }
    }

    private fun createNotificationChannels() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID_PERSISTENT, "Voice Guard status", NotificationManager.IMPORTANCE_LOW),
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID_ALERT, "Voice Guard alerts", NotificationManager.IMPORTANCE_HIGH),
        )
    }

    private fun buildPersistentNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID_PERSISTENT)
            .setContentTitle("SuSagi Voice Guard")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setOngoing(true)
            .build()

    private fun updatePersistentNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID_PERSISTENT, buildPersistentNotification(state.value.statusText))
    }

    /** The user is mid-call and not looking at the app -- a high-priority
     * notification (heads-up + sound) is the only reliable way to reach
     * them, so this is used instead of any in-app-only UI state. */
    private fun showCriticalAlert(title: String, body: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = NotificationCompat.Builder(this, CHANNEL_ID_ALERT)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .build()
        nm.notify(NOTIF_ID_ALERT, notification)
    }
}
