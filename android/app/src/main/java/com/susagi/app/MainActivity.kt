package com.susagi.app

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private val InkBg = Color(0xFF0A0C1A)
private val InkCard = Color(0xFF14172A)
private val InkBorder = Color(0xFF252A3A)
private val InkMuted = Color(0xFF8A91A4)
private val Brand = Color(0xFF2F9595)
private val Danger = Color(0xFFB91C1C)

class MainActivity : ComponentActivity() {

    private lateinit var prefs: SharedPreferences

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* handled by re-checking state on resume */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("susagi", MODE_PRIVATE)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme(background = InkBg, surface = InkCard)) {
                VoiceGuardScreen(
                    prefs = prefs,
                    hasPermissions = ::hasRequiredPermissions,
                    requestPermissions = ::requestRequiredPermissions,
                )
            }
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        val needed = requiredPermissions()
        return needed.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestRequiredPermissions() {
        permissionLauncher.launch(requiredPermissions())
    }

    private fun requiredPermissions(): Array<String> {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return perms.toTypedArray()
    }
}

@Composable
fun VoiceGuardScreen(
    prefs: SharedPreferences,
    hasPermissions: () -> Boolean,
    requestPermissions: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    var baseUrl by remember { mutableStateOf(prefs.getString("base_url", "") ?: "") }
    var profiles by remember { mutableStateOf<List<BehavioralProfile>>(emptyList()) }
    var selectedId by remember { mutableStateOf<Int?>(prefs.getInt("profile_id", -1).takeIf { it >= 0 }) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    val monitorState by CallMonitorService.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(InkBg)
            .padding(20.dp),
    ) {
        Text("SuSagi Voice Guard", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(
            "Real-time impersonation detection for calls on speakerphone",
            color = InkMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
        )

        DisclaimerCard()

        Spacer(Modifier.height(16.dp))

        OutlinedTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it },
            label = { Text("Backend URL (e.g. https://your-tunnel.trycloudflare.com)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(10.dp))

        Button(
            onClick = {
                loading = true
                loadError = null
                scope.launch(Dispatchers.IO) {
                    try {
                        val result = SusagiApi.fetchProfiles(baseUrl)
                        profiles = result
                        if (selectedId == null) selectedId = result.firstOrNull()?.id
                    } catch (e: Exception) {
                        loadError = "Couldn't reach that URL: ${e.message}"
                    } finally {
                        loading = false
                    }
                }
            },
            enabled = baseUrl.isNotBlank() && !loading,
            colors = ButtonDefaults.buttonColors(containerColor = Brand),
        ) {
            Text(if (loading) "Loading..." else "Load trusted contacts")
        }

        loadError?.let {
            Text(it, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        }

        if (profiles.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Text("Who is calling?", color = Color.White, fontWeight = FontWeight.SemiBold)
            LazyColumn(modifier = Modifier.heightIn(max = 200.dp)) {
                items(profiles) { p ->
                    ProfileRow(p, selectedId == p.id) { selectedId = p.id }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        val canStart = baseUrl.isNotBlank() && selectedId != null

        Button(
            onClick = {
                prefs.edit().putString("base_url", baseUrl).putInt("profile_id", selectedId ?: -1).apply()
                if (!hasPermissions()) {
                    requestPermissions()
                    return@Button
                }
                if (monitorState.listening) {
                    context.stopService(Intent(context, CallMonitorService::class.java))
                } else {
                    val intent = Intent(context, CallMonitorService::class.java).apply {
                        putExtra(CallMonitorService.EXTRA_BASE_URL, baseUrl)
                        putExtra(CallMonitorService.EXTRA_PROFILE_ID, selectedId ?: -1)
                    }
                    ContextCompat.startForegroundService(context, intent)
                }
            },
            enabled = canStart,
            colors = ButtonDefaults.buttonColors(
                containerColor = if (monitorState.listening) Danger else Brand,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (monitorState.listening) "Stop Voice Guard" else "Start Voice Guard")
        }

        Spacer(Modifier.height(20.dp))
        StatusCard(monitorState)
    }
}

@Composable
private fun DisclaimerCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(InkCard)
            .padding(14.dp),
    ) {
        Text(
            "Monitors calls only while you're on speakerphone -- that's the only " +
                "audio any app on this phone can legitimately read. Recording a call " +
                "may require the other party's consent depending on where you are; " +
                "you're responsible for complying with local law.",
            color = InkMuted, fontSize = 12.sp,
        )
    }
}

@Composable
private fun ProfileRow(profile: BehavioralProfile, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) Brand.copy(alpha = 0.25f) else InkCard)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onClick, colors = RadioButtonDefaults.colors(selectedColor = Brand))
        Column(Modifier.padding(start = 8.dp)) {
            Text(profile.name, color = Color.White, fontWeight = FontWeight.Medium)
            Text(profile.relationshipRole, color = InkMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun StatusCard(state: CallMonitorService.Companion.MonitorState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(InkCard)
            .padding(16.dp),
    ) {
        Text("STATUS", color = InkMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(state.statusText, color = Color.White, fontSize = 16.sp, modifier = Modifier.padding(top = 4.dp))

        if (state.onCall) {
            Spacer(Modifier.height(10.dp))
            Text("Live risk score: ${state.score}/100", color = if (state.score >= 60) Danger else Color.White)
        }
        state.behavioralScore?.let { bScore ->
            Spacer(Modifier.height(6.dp))
            Text("Behavioral match: $bScore/100", color = if (bScore >= 60) Danger else Color.White)
            state.behavioralReason?.let {
                Text(it, color = InkMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}
