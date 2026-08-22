package com.susagi.app

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
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

        playAlertSound()

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                AlertScreen(
                    title = title,
                    reason = reason,
                    onEndCall = {
                        returnToCallScreen()
                        finish()
                    },
                    onContinue = { finish() },
                )
            }
        }
    }

    private fun playAlertSound() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            RingtoneManager.getRingtone(this, uri)?.play()
        } catch (_: Exception) {
            // A missing/silenced alarm tone isn't worth crashing over --
            // the full-screen visual alert still gets through.
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

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_REASON = "reason"
    }
}

@Composable
private fun AlertScreen(
    title: String,
    reason: String,
    onEndCall: () -> Unit,
    onContinue: () -> Unit,
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

        Spacer(Modifier.height(40.dp))

        Button(
            onClick = onEndCall,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Text("GO TO CALL SCREEN TO HANG UP", color = Color(0xFFB91C1C), fontWeight = FontWeight.Bold)
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
