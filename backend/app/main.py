"""
SuSagi — FastAPI entry point.

Exposes:
    POST /api/analyze          run an analysis
    POST /api/analyze-image    run an analysis on an uploaded screenshot
    GET  /api/sender-lookup    check a sender's history before engaging
    GET  /api/insights         aggregated insights for the dashboard
    GET  /api/history          recent analysis history
    GET  /api/escalations      recent high-risk escalation events
    GET  /api/health           liveness check
"""
from __future__ import annotations

import json
from typing import Optional
import asyncio
import random

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from vosk import Model, KaldiRecognizer
from .modules.scam_scorer import ConvState

# Load Vosk model globally
try:
    vosk_model = Model("model")
    print("[OK] Vosk model loaded successfully!")
except Exception as e:
    print(f"[ERROR] Error loading Vosk model: {e}")
    vosk_model = None


load_dotenv()

from .modules.data_access import (
    get_sender_profile,
    init_db,
    insights_summary,
    recent_escalations,
    recent_history,
    save_analysis,
    update_sender_profile,
)
from .modules.escalation_engine import handle_escalation, should_escalate
from .modules.pipeline import run_analysis, run_image_analysis
from .modules.risk_scoring import score_to_level
from .modules.schemas import (
    AnalysisRequest,
    AnalysisResult,
    ImageAnalysisResponse,
    SenderLookupResult,
)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}


app = FastAPI(
    title="SuSagi API",
    description="Public cyber safety analysis for suspicious messages, links, and job offers.",
    version="1.0.0",
)

# Initialize SQLite schema at import time. This is idempotent (CREATE IF NOT
# EXISTS) and avoids relying on startup events, which don't fire under
# FastAPI's TestClient or some ASGI servers.
init_db()

# Frontend runs on 3000 in local dev. In production, tighten this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "susagi"}


@app.post("/api/analyze", response_model=AnalysisResult)
def analyze(req: AnalysisRequest, background_tasks: BackgroundTasks) -> AnalysisResult:
    sender_profile = get_sender_profile(req.sender_id) if req.sender_id else None
    try:
        result = run_analysis(req, sender_profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # Persist a privacy-minimal record for aggregates
    save_analysis(req.content, result)
    if req.sender_id:
        update_sender_profile(req.sender_id, result)
    if should_escalate(result):
        # Runs after the response is sent -- a slow/failing webhook never
        # delays the verdict the user is waiting on.
        background_tasks.add_task(handle_escalation, req.content, result)
    return result


@app.post("/api/analyze-image", response_model=ImageAnalysisResponse)
def analyze_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    sender_id: Optional[str] = Form(None),
) -> ImageAnalysisResponse:
    # Sync def (not async) so FastAPI runs this in its threadpool -- the
    # vision LLM call below is a blocking httpx request that can take up to
    # 60s, which would otherwise freeze the whole event loop for every other
    # request, same as why /api/analyze is a sync def too.
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Use PNG, JPEG, or WebP.",
        )

    image_bytes = file.file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (5MB max).")

    sender_profile = get_sender_profile(sender_id) if sender_id else None
    result, extracted_text = run_image_analysis(image_bytes, file.content_type, sender_profile)

    preview = extracted_text or "(image with no extracted text)"
    save_analysis(preview, result)
    if sender_id:
        update_sender_profile(sender_id, result)
    if should_escalate(result):
        background_tasks.add_task(handle_escalation, preview, result)

    return ImageAnalysisResponse(result=result, extracted_text=extracted_text)


@app.get("/api/sender-lookup", response_model=SenderLookupResult)
def sender_lookup(sender_id: str) -> SenderLookupResult:
    """
    Check a number or handle's history BEFORE opening whatever it just
    sent you -- the one thing a paste-and-check tool structurally can't
    do on its own. Built entirely from SuSagi's own accumulated
    sender_profiles (real prior checks against this tag), never a
    purchased or scraped reputation database.
    """
    sender_id = sender_id.strip()
    if not sender_id:
        raise HTTPException(status_code=400, detail="sender_id is required")

    profile = get_sender_profile(sender_id)
    if not profile:
        return SenderLookupResult(found=False, sender_id=sender_id)

    avg_score = round(profile["avg_risk_score"])
    return SenderLookupResult(
        found=True,
        sender_id=sender_id,
        message_count=profile["message_count"],
        avg_risk_score=avg_score,
        risk_level=score_to_level(avg_score),
        signal_ids=json.loads(profile["signal_ids"]),
        last_seen=profile["last_seen"],
    )


@app.get("/api/insights")
def insights() -> dict:
    return insights_summary()


@app.get("/api/history")
def history(limit: int = 20) -> list:
    limit = max(1, min(limit, 100))
    return recent_history(limit)


@app.get("/api/escalations")
def escalations(limit: int = 20) -> list:
    limit = max(1, min(limit, 100))
    return recent_escalations(limit)


@app.websocket("/api/ws/call-stream-test")
async def websocket_test_endpoint(websocket: WebSocket):
    await websocket.accept()
    conv_state = ConvState()
    
    dialogue = [
        "Hello, this is Inspector Rahul Sharma calling from the CBI Cyber Crime Investigation Department.",
        "We have detected suspicious activity associated with your card and bank account.",
        "This is an ongoing federal investigation. You must keep this secret and do not discuss it with anyone, including your family.",
        "To prevent immediate arrest, you must cooperate with us right now.",
        "Open your UPI banking app immediately to verify your identity.",
        "We are sending you a verification code. Share the OTP pin number with me within 2 minutes."
    ]
    
    current_index = 0
    full_transcript = []
    
    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=2.5)
                if msg == "reset":
                    conv_state = ConvState()
                    current_index = 0
                    full_transcript = []
            except asyncio.TimeoutError:
                pass
            
            if current_index < len(dialogue):
                current_sentence = dialogue[current_index]
                full_transcript.append(current_sentence)
                score, evidence = conv_state.update(current_sentence)
                current_index += 1
            else:
                score = conv_state.score
                evidence = conv_state.evidence
                
            await websocket.send_json({
                "score": score,
                "transcript": " ".join(full_transcript),
                "evidence": evidence,
                "action": "freeze" if score >= 75 else "none"
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")


@app.websocket("/api/ws/call-stream")
async def websocket_call_stream(websocket: WebSocket):
    await websocket.accept()
    if vosk_model is None:
        await websocket.send_json({"error": "Vosk model not loaded on server."})
        await websocket.close()
        return
        
    rec = KaldiRecognizer(vosk_model, 16000)
    conv_state = ConvState()
    
    try:
        while True:
            # Receive binary Int16 PCM chunks
            data = await websocket.receive_bytes()
            if rec.AcceptWaveform(data):
                res = json.loads(rec.Result())
                text = res.get("text", "")
                if text:
                    score, evidence = conv_state.update(text)
                    await websocket.send_json({
                        "score": score,
                        "transcript": text,
                        "evidence": evidence,
                        "is_final": True
                    })
            else:
                res = json.loads(rec.PartialResult())
                partial_text = res.get("partial", "")
                if partial_text:
                    temp_state = ConvState()
                    temp_state.score = conv_state.score
                    temp_state.hits = conv_state.hits.copy()
                    temp_state.evidence = list(conv_state.evidence)
                    
                    score, evidence = temp_state.update(partial_text)
                    await websocket.send_json({
                        "score": score,
                        "transcript": partial_text,
                        "evidence": evidence,
                        "is_final": False
                    })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Call stream error: {e}")

