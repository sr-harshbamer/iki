package com.susagi.app

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.TelecomManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The screen from the flow diagram: fires the instant risk crosses a
 * threshold, mid-call, over whatever else is on screen -- the same
 * mechanism Android uses for incoming calls and alarms
 * (Notification.Builder#setFullScreenIntent), which is the only reliable
 * way to interrupt a live call with something the user can't miss.
 *
 * "END CALL" is honestly labeled, not oversold: Android revoked
 * TelecomManager#endCall() for regular apps in API 28+ specifically so
 * apps can't hang up your calls without you asking them to. What this
 * button CAN do is bring your own call screen back to the front so
 * hanging up is one tap away -- that's the real ceiling for a
 * non-privileged, non-default-dialer app.
 */
class CallAlertActivity : ComponentActivity() {

    private var alarmPlayer: MediaPlayer? = null
    private val stopHandler = Handler(Looper.getMainLooper())
    private val autoStopRunnable = Runnable { stopAlarm() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over the lock screen and wake the display -- this alert
        // matters more than whatever the phone was doing when it fired.
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        keyguardManager.requestDismissKeyguard(this, null)

        val title = intent.getStringExtra(EXTRA_TITLE) ?: "High-risk call in progress"
        val reason = intent.getStringExtra(EXTRA_REASON) ?: ""
        val category = intent.getStringExtra(EXTRA_CATEGORY) ?: "Suspicious Call"
        val sender = intent.getStringExtra(EXTRA_SENDER) ?: "Unknown"
        val transcript = intent.getStringExtra(EXTRA_TRANSCRIPT) ?: ""
        val alarmEnabled = intent.getBooleanExtra(EXTRA_ALARM_ENABLED, false)
        val detectedAt = SimpleDateFormat("dd MMM yyyy, HH:mm:ss", Locale.getDefault()).format(Date())

        if (alarmEnabled) startAlarm() else playAlertSoundOnce()

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                AlertScreen(
                    title = title,
                    reason = reason,
                    alarmPlaying = alarmEnabled,
                    onEndCall = {
                        stopAlarm()
                        returnToCallScreen()
                        finish()
                    },
                    onContinue = {
                        stopAlarm()
                        finish()
                    },
                    onStopAlarm = { stopAlarm() },
                    onReport = {
                        stopAlarm()
                        reportToCybercrime(category, sender, detectedAt, reason, transcript)
                    },
                )
            }
        }
    }

    /** One-shot fallback when the alarm toggle is off -- still audible, but
     * not a looping siren the user didn't opt into. */
    private fun playAlertSoundOnce() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            RingtoneManager.getRingtone(this, uri)?.play()
        } catch (_: Exception) {
            // A missing/silenced alarm tone isn't worth crashing over --
            // the full-screen visual alert still gets through.
        }
    }

    /** Opt-in (Settings toggle) loud, looping alert -- STREAM_ALARM is the
     * same channel the system's own alarm clock uses, so it follows normal
     * Android alarm behavior (audible through Do Not Disturb, silenced only
     * by the phone's "Total Silence" mode) rather than us custom-overriding
     * anything. Auto-stops after 8s if the user hasn't already dismissed it. */
    private fun startAlarm() {
        try {
            val uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            alarmPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(this@CallAlertActivity, uri)
                isLooping = true
                prepare()
                start()
            }
            stopHandler.postDelayed(autoStopRunnable, ALARM_DURATION_MS)
        } catch (_: Exception) {
            // Fall back to a single non-looping tone rather than silence.
            playAlertSoundOnce()
        }
    }

    private fun stopAlarm() {
        stopHandler.removeCallbacks(autoStopRunnable)
        alarmPlayer?.let {
            try { if (it.isPlaying) it.stop() } catch (_: Exception) {}
            it.release()
        }
        alarmPlayer = null
    }

    /** Opens the device's default mail app with a pre-filled report --
     * mailto rather than sending in-app, so the user reviews and picks the
     * recipient themselves before anything goes out. There is no single
     * official reporting email in India (the real channels are the National
     * Cyber Crime Reporting Portal at cybercrime.gov.in and the 1930
     * helpline) -- verified before implementing this, since a wrong/fake
     * "To" address would be worse than none. The body points the user (or
     * whoever they forward it to) at those actual channels instead of
     * guessing at an address. */
    private fun reportToCybercrime(category: String, sender: String, detectedAt: String, reason: String, transcript: String) {
        val subject = "Scam Report - Call Detected via SuSagi Voice Guard"
        val body = buildString {
            append("A suspected scam call was detected by SuSagi Voice Guard.\n\n")
            append("Detected at: $detectedAt\n")
            append("Caller number: $sender\n")
            append("Scam type: $category\n")
            append("Detection reason: $reason\n")
            if (transcript.isNotBlank()) append("Flagged content (transcript excerpt): \"$transcript\"\n")
            append("\nTo file an official report in India, use the National Cyber Crime Reporting Portal ")
            append("(https://cybercrime.gov.in) or call the 24x7 helpline at 1930.\n")
        }
        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("mailto:")
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, body)
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            // No mail app configured -- nothing sensible to fall back to
            // here beyond not crashing; the alert screen itself stays up.
        }
    }

    /** Brings the phone's own in-call UI back to front. Cannot end the
     * call itself -- see the class doc above for why. */
    private fun returnToCallScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val telecomManager = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                telecomManager.showInCallScreen(false)
                return
            } catch (_: SecurityException) {
                // Falls through to the dialer-launch fallback below.
            }
        }
        try {
            startActivity(Intent(Intent.ACTION_DIAL))
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_REASON = "reason"
        const val EXTRA_CATEGORY = "category"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_TRANSCRIPT = "transcript"
        const val EXTRA_ALARM_ENABLED = "alarm_enabled"
        private const val ALARM_DURATION_MS = 8000L
    }
}

@Composable
private fun AlertScreen(
    title: String,
    reason: String,
    alarmPlaying: Boolean,
    onEndCall: () -> Unit,
    onContinue: () -> Unit,
    onStopAlarm: () -> Unit,
    onReport: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFB91C1C))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("⚠", fontSize = 56.sp)
        Spacer(Modifier.height(16.dp))
        Text(
            title.uppercase(),
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        if (reason.isNotBlank()) {
            Spacer(Modifier.height(16.dp))
            Text(
                reason,
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
            )
        }

        if (alarmPlaying) {
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = onStopAlarm,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Black.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text("STOP ALARM", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onEndCall,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Text("GO TO CALL SCREEN TO HANG UP", color = Color(0xFFB91C1C), fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(12.dp))

        Button(
            onClick = onReport,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Text("Report to Cybercrime", color = Color.White, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(12.dp))

        Button(
            onClick = onContinue,
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            Text("Continue anyway", color = Color.White.copy(alpha = 0.8f))
        }

        Spacer(Modifier.height(8.dp))
        Text(
            "SuSagi can't hang up the call for you -- Android doesn't allow that " +
                "for apps that aren't your default phone app. Tapping above brings " +
                "your call screen back so you can end it yourself.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}
