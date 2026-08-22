package com.susagi.app

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

data class BehavioralProfile(
    val id: Int,
    val name: String,
    val relationshipRole: String,
    val neverAsksFor: List<String>,
)

data class QrResult(
    val riskLevel: String,
    val riskScore: Int,
    val threatCategory: String,
    val reasons: List<String>,
) {
    val isSafe: Boolean get() = riskLevel == "Safe" || riskLevel == "Low Risk"
}

/**
 * Thin wrapper over the exact same REST endpoints the web app already
 * uses (backend/app/main.py) -- no new backend surface for the Android
 * app, it's just another client of /api/behavioral-profiles and
 * /api/ws/call-stream.
 */
object SusagiApi {
    private val client = OkHttpClient()

    fun fetchProfiles(baseUrl: String): List<BehavioralProfile> {
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/behavioral-profiles")
            .build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw java.io.IOException("HTTP ${resp.code}")
            val body = resp.body?.string() ?: "[]"
            val arr = JSONArray(body)
            return (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                val neverAsks = mutableListOf<String>()
                val neverAsksArr = o.getJSONArray("never_asks_for")
                for (j in 0 until neverAsksArr.length()) neverAsks.add(neverAsksArr.getString(j))
                BehavioralProfile(
                    id = o.getInt("id"),
                    name = o.getString("name"),
                    relationshipRole = o.getString("relationship_role"),
                    neverAsksFor = neverAsks,
                )
            }
        }
    }

    /**
     * The gate: the QR is decoded on-device by ML Kit (QrScanActivity) and
     * handed here as plain text -- nothing about it is opened yet. This
     * hits the exact same /api/analyze-qr endpoint the web app's live
     * camera scanner uses, and the caller only gets to act on the result
     * afterward, never before.
     */
    fun analyzeQr(baseUrl: String, content: String): QrResult {
        val body = JSONObject().put("content", content).toString()
            .toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/analyze-qr")
            .post(body)
            .build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw java.io.IOException("HTTP ${resp.code}")
            val json = JSONObject(resp.body?.string() ?: "{}")
            val result = json.getJSONObject("result")
            val reasons = mutableListOf<String>()
            val why = result.optJSONArray("why_flagged")
            if (why != null) for (i in 0 until why.length()) reasons.add(why.getString(i))
            return QrResult(
                riskLevel = result.getString("risk_level"),
                riskScore = result.getInt("risk_score"),
                threatCategory = result.getString("threat_category"),
                reasons = reasons,
            )
        }
    }

    /** http(s) base URL -> matching ws(s) URL for the call-stream socket. */
    fun wsUrl(baseUrl: String, profileId: Int?): String {
        val wsBase = baseUrl.trimEnd('/').replaceFirst(Regex("^http"), "ws")
        val qs = if (profileId != null) "?profile_id=$profileId" else ""
        return "$wsBase/api/ws/call-stream$qs"
    }
}
