package com.susagi.webapp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.EditText
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat

/**
 * The real product is the website (frontend/) -- this wraps it verbatim in
 * a WebView shell so it installs and launches like a native app, without
 * re-implementing Analyze / Live Guard / Voice Guard / Safety Insights a
 * second time in Kotlin. Every function that works on the site works here,
 * because it IS the site: same JS, same WebSocket connections to
 * /ws/live and /api/ws/call-stream, same fetch calls to /api/analyze*.
 *
 * Two things a plain WebView doesn't do out of the box that the site
 * actually needs:
 *  - getUserMedia (mic for Voice Guard, camera for the live QR scanner)
 *    requires handling WebChromeClient#onPermissionRequest and holding the
 *    matching Android runtime permission first.
 *  - <input type="file"> (screenshot upload on Analyze, WAV upload on
 *    Voice Guard) requires handling WebChromeClient#onShowFileChooser --
 *    a bare WebView silently does nothing when that input is tapped.
 */
class MainActivity : ComponentActivity() {

    private lateinit var prefs: SharedPreferences
    private lateinit var webView: WebView

    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null

    private val runtimePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Whatever the OS dialog result was, re-resolve against the page's
        // pending request -- grant() only ever hands back resources we
        // actually hold the permission for for; anything still missing is denied.
        resolvePendingPermissionRequest()
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pendingFileCallback
        pendingFileCallback = null
        if (callback == null) return@registerForActivityResult
        val data = result.data
        val uris: Array<Uri> = when {
            result.resultCode != Activity.RESULT_OK || data == null -> emptyArray()
            data.clipData != null -> {
                val clip = data.clipData!!
                Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
            }
            data.data != null -> arrayOf(data.data!!)
            else -> emptyArray()
        }
        callback.onReceiveValue(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("susagi_webapp", MODE_PRIVATE)

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                cacheMode = WebSettings.LOAD_DEFAULT
                userAgentString = "$userAgentString SuSagiApp/1.0"
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        pendingPermissionRequest = request
                        val needed = request.resources.mapNotNull { res ->
                            when (res) {
                                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                                else -> null
                            }
                        }.distinct()
                        val missing = needed.filter {
                            ContextCompat.checkSelfPermission(this@MainActivity, it) !=
                                PackageManager.PERMISSION_GRANTED
                        }
                        if (missing.isEmpty()) {
                            resolvePendingPermissionRequest()
                        } else {
                            runtimePermissionLauncher.launch(missing.toTypedArray())
                        }
                    }
                }

                override fun onShowFileChooser(
                    view: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams?,
                ): Boolean {
                    pendingFileCallback?.onReceiveValue(null)
                    pendingFileCallback = filePathCallback
                    val acceptTypes = fileChooserParams?.acceptTypes?.filter { it.isNotBlank() }
                    val mimeType = acceptTypes?.firstOrNull() ?: "*/*"
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = mimeType
                        addCategory(Intent.CATEGORY_OPENABLE)
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    }
                    return try {
                        fileChooserLauncher.launch(Intent.createChooser(intent, "Choose a file"))
                        true
                    } catch (e: Exception) {
                        pendingFileCallback = null
                        false
                    }
                }
            }
        }
        setContentView(webView)

        val savedUrl = prefs.getString("site_url", null)
        if (savedUrl.isNullOrBlank()) {
            promptForUrl(DEFAULT_URL)
        } else {
            webView.loadUrl(savedUrl)
        }
    }

    private fun resolvePendingPermissionRequest() {
        val request = pendingPermissionRequest ?: return
        pendingPermissionRequest = null
        val grantable = request.resources.filter { res ->
            val perm = when (res) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                else -> null
            }
            perm != null && ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED
        }
        if (grantable.isNotEmpty()) {
            request.grant(grantable.toTypedArray())
        } else {
            request.deny()
        }
    }

    /** Lets the site's own URL be pointed at a fresh tunnel once the
     * original one expires -- these are ephemeral quick tunnels, not a
     * permanent address, so the app can't just hardcode one forever. */
    private fun promptForUrl(prefill: String) {
        val input = EditText(this).apply { setText(prefill) }
        AlertDialog.Builder(this)
            .setTitle("SuSagi site URL")
            .setMessage("Enter the backend/site URL (e.g. a Cloudflare tunnel link).")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Go") { _, _ ->
                val url = input.text.toString().trim()
                if (url.isNotBlank()) {
                    prefs.edit().putString("site_url", url).apply()
                    webView.loadUrl(url)
                }
            }
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        // Current live tunnel at build time -- change via the in-app prompt
        // (long-press-free: it only reappears if site_url is cleared) if
        // this one has since expired.
        const val DEFAULT_URL = "https://download-staying-defined-spyware.trycloudflare.com"
    }
}
