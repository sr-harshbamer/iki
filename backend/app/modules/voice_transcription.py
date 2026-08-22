"""
Batch voice-clip transcription.

The live call monitor (main.py's /api/ws/call-stream) streams audio and
transcribes it incrementally, one chunk at a time, for an instant "as it
happens" reaction. This module is for the other shape of the same
underlying problem: a single finished clip (recorded in the browser or
uploaded), transcribed once, then handed to the same full analysis pipeline
Analyze uses -- see pipeline.run_voice_analysis.

Both paths share one loaded Vosk model (loaded once, here, at import time)
rather than each loading their own copy.
"""
from __future__ import annotations

import json
import wave
from io import BytesIO
from typing import Optional

from vosk import KaldiRecognizer, Model

try:
    vosk_model: Optional[Model] = Model("model")
    print("[OK] Vosk model loaded successfully!")
except Exception as e:
    print(f"[ERROR] Error loading Vosk model: {e}")
    vosk_model = None

EXPECTED_SAMPLE_RATE = 16000
EXPECTED_SAMPLE_WIDTH = 2  # bytes (16-bit)
EXPECTED_CHANNELS = 1  # mono

_CHUNK_FRAMES = 4000  # ~0.25s per AcceptWaveform call


def transcribe_wav_bytes(wav_bytes: bytes) -> Optional[str]:
    """Transcribe a WAV file's full contents. Returns the transcript, or
    None if the model isn't loaded, the file isn't readable as WAV, the
    format doesn't match what the recorder/uploader is expected to produce
    (16kHz mono 16-bit PCM), or transcription produced no text at all --
    callers must treat None as "couldn't transcribe," never as "silence"."""
    if vosk_model is None:
        return None

    try:
        with wave.open(BytesIO(wav_bytes), "rb") as wf:
            if (
                wf.getframerate() != EXPECTED_SAMPLE_RATE
                or wf.getsampwidth() != EXPECTED_SAMPLE_WIDTH
                or wf.getnchannels() != EXPECTED_CHANNELS
            ):
                return None

            recognizer = KaldiRecognizer(vosk_model, EXPECTED_SAMPLE_RATE)
            recognizer.SetWords(False)

            parts: list[str] = []
            while True:
                data = wf.readframes(_CHUNK_FRAMES)
                if not data:
                    break
                if recognizer.AcceptWaveform(data):
                    text = json.loads(recognizer.Result()).get("text", "")
                    if text:
                        parts.append(text)

            final_text = json.loads(recognizer.FinalResult()).get("text", "")
            if final_text:
                parts.append(final_text)
    except (wave.Error, EOFError, OSError):
        return None

    transcript = " ".join(p for p in parts if p).strip()
    return transcript or None
