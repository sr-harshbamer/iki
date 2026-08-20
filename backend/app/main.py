"""
Veridra — FastAPI entry point.

Exposes:
    POST /api/analyze          run an analysis
    GET  /api/insights         aggregated insights for the dashboard
    GET  /api/history          recent analysis history
    GET  /api/health           liveness check
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .modules.data_access import (
    init_db,
    insights_summary,
    recent_history,
    save_analysis,
)
from .modules.pipeline import run_analysis
from .modules.schemas import AnalysisRequest, AnalysisResult


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
def analyze(req: AnalysisRequest) -> AnalysisResult:
    try:
        result = run_analysis(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # Persist a privacy-minimal record for aggregates
    save_analysis(req.content, result)
    return result


@app.get("/api/insights")
def insights() -> dict:
    return insights_summary()


@app.get("/api/history")
def history(limit: int = 20) -> list:
    limit = max(1, min(limit, 100))
    return recent_history(limit)
