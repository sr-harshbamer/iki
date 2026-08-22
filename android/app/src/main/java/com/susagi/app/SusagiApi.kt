package com.susagi.app

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

data class BehavioralProfile(
    val id: Int,
    val name: String,
    val relationshipRole: String,
    val neverAsksFor: List<String>,
)

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

    /** http(s) base URL -> matching ws(s) URL for the call-stream socket. */
    fun wsUrl(baseUrl: String, profileId: Int?): String {
        val wsBase = baseUrl.trimEnd('/').replaceFirst(Regex("^http"), "ws")
        val qs = if (profileId != null) "?profile_id=$profileId" else ""
        return "$wsBase/api/ws/call-stream$qs"
    }
}
