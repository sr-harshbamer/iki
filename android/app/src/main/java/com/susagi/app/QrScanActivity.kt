package com.susagi.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private sealed interface ScanState {
    data object Scanning : ScanState
    data class Checking(val content: String) : ScanState
    data class Result(val content: String, val result: QrResult) : ScanState
    data class Failed(val message: String) : ScanState
}

class QrScanActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val baseUrl = intent.getStringExtra("base_url") ?: ""

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                QrScanScreen(baseUrl = baseUrl, onClose = { finish() })
            }
        }
    }
}

@Composable
private fun QrScanScreen(baseUrl: String, onClose: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var state by remember { mutableStateOf<ScanState>(ScanState.Scanning) }

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> hasCameraPermission = granted }
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    if (!hasCameraPermission) {
        Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Camera access is needed to scan a QR code.", color = Color.White)
                Spacer(Modifier.height(12.dp))
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Grant camera access")
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onClose) { Text("Cancel", color = Color.White.copy(alpha = 0.7f)) }
            }
        }
        return
    }

    Box(Modifier.fillMaxSize()) {
        if (state is ScanState.Scanning) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }
                        val scanner = BarcodeScanning.getClient(
                            BarcodeScannerOptions.Builder()
                                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                                .build(),
                        )
                        val analysis = ImageAnalysis.Builder().build().also {
                            it.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                                processFrame(imageProxy, scanner) { raw ->
                                    if (state is ScanState.Scanning) {
                                        state = ScanState.Checking(raw)
                                        scope.launch(Dispatchers.IO) {
                                            state = try {
                                                ScanState.Result(raw, SusagiApi.analyzeQr(baseUrl, raw))
                                            } catch (e: Exception) {
                                                ScanState.Failed("Couldn't check this code: ${e.message}")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis,
                            )
                        } catch (_: Exception) {
                        }
                    }, ContextCompat.getMainExecutor(ctx))
                    previewView
                },
            )
            Box(
                Modifier
                    .align(Alignment.Center)
                    .size(240.dp)
                    .background(Color.Transparent),
            )
            Text(
                "Point at a QR code. It will be checked before anything opens.",
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(32.dp),
            )
        }

        when (val s = state) {
            is ScanState.Checking -> CheckingOverlay()
            is ScanState.Result -> ResultOverlay(
                content = s.content,
                result = s.result,
                onClose = onClose,
                onOpenAnyway = {
                    openDestination(context, s.content)
                    onClose()
                },
                onScanAgain = { state = ScanState.Scanning },
            )
            is ScanState.Failed -> FailedOverlay(s.message, onRetry = { state = ScanState.Scanning }, onClose = onClose)
            ScanState.Scanning -> {}
        }

        TextButton(onClick = onClose, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
            Text("Close", color = Color.White)
        }
    }
}

/** Never called automatically -- only reachable from a button the user
 * tapped after seeing the verdict, whether safe or acknowledged-risky. */
private fun openDestination(context: android.content.Context, content: String) {
    if (content.startsWith("http://") || content.startsWith("https://") || content.startsWith("upi://")) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(content)))
        } catch (_: Exception) {
        }
    }
}

private fun processFrame(imageProxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner, onFound: (String) -> Unit) {
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }
    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    scanner.process(image)
        .addOnSuccessListener { barcodes ->
            barcodes.firstOrNull()?.rawValue?.let(onFound)
        }
        .addOnCompleteListener { imageProxy.close() }
}

@Composable
private fun CheckingOverlay() {
    Column(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.75f)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = Color.White)
        Spacer(Modifier.height(16.dp))
        Text("Checking before this opens...", color = Color.White)
    }
}

@Composable
private fun ResultOverlay(
    content: String,
    result: QrResult,
    onClose: () -> Unit,
    onOpenAnyway: () -> Unit,
    onScanAgain: () -> Unit,
) {
    val danger = !result.isSafe
    Column(
        Modifier
            .fillMaxSize()
            .background(if (danger) Color(0xFFB91C1C) else Color(0xFF14172A))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(if (danger) "⛔" else "✅", fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(
            if (danger) "Don't scan this QR" else "This looks safe",
            color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(6.dp))
        Text("${result.riskLevel} · ${result.riskScore}/100", color = Color.White.copy(alpha = 0.85f))

        Spacer(Modifier.height(16.dp))
        Text(
            content, color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp,
            modifier = Modifier.background(Color.Black.copy(alpha = 0.25f)).padding(10.dp),
        )

        if (result.reasons.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Column {
                result.reasons.take(3).forEach {
                    Text("• $it", color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp, modifier = Modifier.padding(vertical = 2.dp))
                }
            }
        }

        Spacer(Modifier.height(28.dp))

        if (danger) {
            Button(
                onClick = onClose,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Leave -- don't open this", color = Color(0xFFB91C1C), fontWeight = FontWeight.Bold) }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onOpenAnyway) {
                Text("I understand the risk -- open anyway", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
            }
        } else {
            Button(
                onClick = onOpenAnyway,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2F9595)),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Open", color = Color.White, fontWeight = FontWeight.Bold) }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onScanAgain) {
                Text("Scan another", color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun FailedOverlay(message: String, onRetry: () -> Unit, onClose: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.9f)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) { Text("Try again") }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onClose) { Text("Close", color = Color.White.copy(alpha = 0.7f)) }
    }
}
