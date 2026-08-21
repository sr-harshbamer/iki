"""
SuSagi — FastAPI entry point.

Exposes:
    POST /api/analyze          run an analysis
    POST /api/analyze-image    run an analysis on an uploaded screenshot
    GET  /api/sender-lookup    check a sender's history before engaging
    WS   /ws/live               live conversation monitor -- reacts to each
                                new message as it arrives, escalates on its
                                own the instant risk crosses a threshold
    GET  /api/insights         aggregated insights for the dashboard
    GET  /api/history          recent analysis history
    GET  /api/escalations      recent high-risk escalation events
    GET  /api/health           liveness check
"""
from __future__ import annotations

import asyncio
import json
import random
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from vosk import Model, KaldiRecognizer

from .modules.data_access import (
    get_sender_profile,
    init_db,
    insights_summary,
    recent_escalations,
    recent_history,
    save_analysis,
    update_sender_profile,
)
from .modules.decision_risk import assess_decision_risk
from .modules.escalation_engine import ESCALATION_LEVELS, handle_escalation, should_escalate
from .modules.link_analysis import analyze_link
from .modules.llm_analysis import analyze_with_llm
from .modules.message_analysis import analyze_message
from .modules.pipeline import _build_result, run_analysis, run_image_analysis
from .modules.risk_scoring import score_signals, score_to_level
from .modules.schemas import (
    AnalysisMode,
    AnalysisRequest,
    AnalysisResult,
    ImageAnalysisResponse,
    QrScanRequest,
    SenderLookupResult,
    Signal,
    Severity,
    ThreatCategory,
)
from .modules.scam_scorer import ConvState
from .modules.upi_analysis import analyze_upi_payload

# Load Vosk model globally
try:
    vosk_model = Model("model")
    print("[OK] Vosk model loaded successfully!")
except Exception as e:
    print(f"[ERROR] Error loading Vosk model: {e}")
    vosk_model = None

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
    result, extracted_text, payee_vpa = run_image_analysis(
        image_bytes, file.content_type, sender_profile
    )

    preview = extracted_text or "(image with no extracted text)"
    save_analysis(preview, result)
    if sender_id:
        update_sender_profile(sender_id, result)
    if payee_vpa:
        # Accumulates this payee's reputation for future scans -- checkable
        # right now via GET /api/sender-lookup?sender_id=upi:<vpa>, the same
        # "check before you answer" feature already built for message senders.
        update_sender_profile(f"upi:{payee_vpa}", result)
    if should_escalate(result):
        background_tasks.add_task(handle_escalation, preview, result)

    return ImageAnalysisResponse(result=result, extracted_text=extracted_text)


@app.post("/api/analyze-qr", response_model=ImageAnalysisResponse)
def analyze_qr(req: QrScanRequest, background_tasks: BackgroundTasks) -> ImageAnalysisResponse:
    """
    Live camera QR scan. The browser's BarcodeDetector already decoded the
    code to plain text before this call, so there's no image upload or OCR
    step here -- just classify the payload (UPI payment vs URL vs unknown)
    and run it through the same scorer/reputation path as every other mode.
    """
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Empty QR content.")

    signals: List[Signal] = [Signal(
        id="qr_code_detected",
        label="QR code scanned",
        severity=Severity.MEDIUM,
        evidence=[content],
        category_hint=None,
    )]
    category = ThreatCategory.NONE
    payee_vpa: Optional[str] = None

    lowered = content.lower()
    if lowered.startswith("upi://pay"):
        upi_signals, upi_category, payee_vpa = analyze_upi_payload(content)
        signals.extend(upi_signals)
        category = upi_category
    elif lowered.startswith(("http://", "https://")):
        link_signals, link_category = analyze_link(content)
        signals.extend(link_signals)
        category = link_category

    sender_profile = get_sender_profile(req.sender_id) if req.sender_id else None
    result = _build_result(AnalysisMode.IMAGE, category, signals, sender_profile)

    save_analysis(content, result)
    if req.sender_id:
        update_sender_profile(req.sender_id, result)
    if payee_vpa:
        update_sender_profile(f"upi:{payee_vpa}", result)
    if should_escalate(result):
        background_tasks.add_task(handle_escalation, content, result)

    return ImageAnalysisResponse(result=result, extracted_text=content)


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


@app.websocket("/ws/live")
async def live_guard(websocket: WebSocket, sender_id: Optional[str] = None) -> None:
    """
    Live conversation monitor. The client pushes one new message at a time
    as it "arrives"; this reacts to each one immediately, on its own --
    there is no "Analyze" button on this path. Two-speed by design:

    - Fast lane (every message, instant): the rule-based analyzer re-scores
      the whole conversation so far. This is what makes it feel live.
    - Slow lane (every message, ~1-3s behind): the semantic LLM pass runs
      in the background and pushes a follow-up update when it resolves,
      without blocking the fast lane's instant feedback.

    The moment the score crosses a High Risk / Likely Scam threshold, this
    escalates automatically -- logs the incident and fires the trusted-
    contact webhook if configured -- with no user action, exactly once per
    connection. That automatic reaction is the actual difference between a
    checker and a monitor.
    """
    await websocket.accept()
    sender_profile = get_sender_profile(sender_id) if sender_id else None
    lines: list[str] = []
    escalated = False

    async def run_semantic_update(full_text: str, generation: int) -> None:
        """Slow lane: runs off the main loop so it never blocks fast-lane
        updates for the next incoming message."""
        llm_signals, forecast = await asyncio.to_thread(
            analyze_with_llm, full_text, AnalysisMode.MESSAGE
        )
        if not llm_signals and not forecast:
            return
        if generation != len(lines):
            return  # a newer message has already superseded this pass
        rule_signals, category = analyze_message(full_text)
        all_signals = rule_signals + llm_signals
        result = _build_result(
            AnalysisMode.MESSAGE, category, all_signals, sender_profile, forecast=forecast
        )
        await websocket.send_json({
            "type": "semantic_update",
            "score": result.risk_score,
            "level": result.risk_level.value,
            "signals": [s.model_dump(mode="json") for s in result.signals],
            "decision_risk": result.decision_risk.model_dump(mode="json"),
            "attack_forecast": result.attack_forecast.model_dump(mode="json") if result.attack_forecast else None,
        })
        await maybe_escalate(full_text, result)

    async def maybe_escalate(full_text: str, result: AnalysisResult) -> None:
        nonlocal escalated
        if escalated or not should_escalate(result):
            return
        escalated = True
        await asyncio.to_thread(handle_escalation, full_text, result)
        if sender_id:
            await asyncio.to_thread(update_sender_profile, sender_id, result)
        await websocket.send_json({
            "type": "escalation",
            "message": f"Protection activated automatically -- {result.risk_level.value} detected live.",
        })

    try:
        while True:
            raw = await websocket.receive_json()
            line = str(raw.get("text", "")).strip()
            if not line:
                continue
            lines.append(line)
            full_text = " ".join(lines)

            rule_signals, category = analyze_message(full_text)
            score, level, (conf_low, conf_high) = score_signals(rule_signals)
            decision_risk = assess_decision_risk(rule_signals, score)

            await websocket.send_json({
                "type": "update",
                "new_line": line,
                "message_count": len(lines),
                "score": score,
                "level": level.value,
                "category": category.value,
                "signals": [s.model_dump(mode="json") for s in rule_signals],
                "decision_risk": decision_risk.model_dump(mode="json"),
            })

            if level in ESCALATION_LEVELS:
                result = _build_result(
                    AnalysisMode.MESSAGE, category, rule_signals, sender_profile
                )
                await maybe_escalate(full_text, result)

            asyncio.create_task(run_semantic_update(full_text, len(lines)))
    except WebSocketDisconnect:
        pass


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

