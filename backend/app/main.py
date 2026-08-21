"""
Veridra — FastAPI entry point.

Exposes:
    POST /api/analyze          run an analysis
    POST /api/analyze-image    run an analysis on an uploaded screenshot
    GET  /api/insights         aggregated insights for the dashboard
    GET  /api/history          recent analysis history
    GET  /api/escalations      recent high-risk escalation events
    GET  /api/health           liveness check
"""
from __future__ import annotations

from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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
from .modules.schemas import AnalysisRequest, AnalysisResult, ImageAnalysisResponse

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}


app = FastAPI(
    title="Veridra API",
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
    return {"status": "ok", "service": "veridra"}


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
