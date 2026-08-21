"use client";

import { ContentInput } from "@/components/ContentInput";
import { ImageInput } from "@/components/ImageInput";
import { ModeTabs } from "@/components/ModeTabs";
import { isQrScanSupported, QrCameraScanner } from "@/components/QrCameraScanner";
import { QrStopScreen } from "@/components/QrStopScreen";
import { RiskVerdictPanel } from "@/components/RiskVerdictPanel";
import { analyze, analyzeImage, analyzeQr } from "@/lib/api";
import { ATTACK_SCENARIOS, type AttackScenario } from "@/lib/scenarios";
import type { AnalysisMode, AnalysisResult } from "@/lib/types";
import { AlertCircle, Loader2, QrCode, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageContent />
    </Suspense>
  );
}

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const autoRanRef = useRef(false);
  const [mode, setMode] = useState<AnalysisMode>("message");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [senderId, setSenderId] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedContent, setAnalyzedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrStopAcknowledged, setQrStopAcknowledged] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [qrScanSupported, setQrScanSupported] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Feature-detected client-side only -- checking at render time would read
  // `window` during SSR and mismatch on hydration.
  useEffect(() => {
    setQrScanSupported(isQrScanSupported());
  }, []);

  // Clear result when the user switches modes — a result from a different mode
  // would be misleading.
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [mode]);

  // A dangerous payment/link QR gets the Truecaller-style full-screen stop --
  // not a card sitting quietly among the others. Reset the acknowledgment
  // every time a new result comes in so a fresh scan is never pre-dismissed.
  const isDangerousQr =
    !!result &&
    result.risk_level !== "Safe" &&
    result.risk_level !== "Low Risk" &&
    result.signals.some((s) => s.id === "qr_code_detected");

  useEffect(() => {
    setQrStopAcknowledged(false);
  }, [result]);

  const runScenario = useCallback(async (scenario: AttackScenario) => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyze(scenario.mode, scenario.content.trim(), scenario.senderId);
      setResult(res);
      setAnalyzedContent(scenario.content.trim());
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // "Simulate Attack" deep-links here as /analyze?scenario=<id> -- load that
  // scenario's content into the form so it's visible, then run it through
  // the real pipeline exactly as if it had been pasted by hand.
  useEffect(() => {
    if (autoRanRef.current) return;
    const scenarioId = searchParams.get("scenario");
    if (!scenarioId) return;
    const scenario = ATTACK_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    autoRanRef.current = true;
    setMode(scenario.mode);
    setContent(scenario.content);
    if (scenario.senderId) setSenderId(scenario.senderId);
    // No cleanup here on purpose: React Strict Mode's dev-only
    // mount->cleanup->remount cycle would cancel this scheduled call before
    // it fires. The `autoRanRef` guard above already makes this a true
    // one-shot regardless, so there's nothing for a cleanup to protect.
    setTimeout(() => runScenario(scenario), 500);
  }, [searchParams, runScenario]);

  const isImageMode = mode === "image";
  const canSubmit = isImageMode ? imageFile !== null : content.trim().length > 0;

  // Live camera path: the browser already decoded the QR before this fires,
  // so this skips straight to scoring -- no upload, no OCR, no waiting.
  const handleQrDetected = useCallback(
    async (qrContent: string) => {
      setShowScanner(false);
      setLoading(true);
      setError(null);
      try {
        const res = await analyzeQr(qrContent, senderId);
        setResult(res.result);
        setAnalyzedContent(res.extracted_text);
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [senderId],
  );

  const handleAnalyze = useCallback(async () => {
    if (isImageMode) {
      if (!imageFile) {
        setError("Please upload a screenshot first.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await analyzeImage(imageFile, senderId);
        setResult(res.result);
        setAnalyzedContent(
          res.extracted_text || "(no readable text found in this image)",
        );
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError("Please paste some content first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyze(mode, trimmed, senderId);
      setResult(res);
      setAnalyzedContent(trimmed);
      // Scroll to result on the next frame
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, content, imageFile, senderId, isImageMode]);

  return (
    <>
      {isDangerousQr && result && !qrStopAcknowledged && (
        <QrStopScreen
          result={result}
          onAcknowledge={() => setQrStopAcknowledged(true)}
        />
      )}

      {showScanner && (
        <QrCameraScanner
          onDetected={handleQrDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <section className="border-b border-ink-200 bg-white">
        <div className="container-wide py-12 sm:py-16">
          <span className="eyebrow">Analyze</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            Check a suspicious message, link, job offer, or screenshot
          </h1>
          <p className="mt-3 max-w-2xl text-ink-600">
            Pick the mode that matches what you received, paste the content or
            upload a screenshot, and SuSagi will return a clear verdict with
            the specific red flags and next steps.
          </p>
        </div>
      </section>

      {/* ── Input ───────────────────────────────────────────────── */}
      <section className="bg-ink-50 py-10">
        <div className="container-wide space-y-6">
          <ModeTabs value={mode} onChange={setMode} />

          <div className="card p-6 sm:p-8">
            {isImageMode ? (
              <div className="space-y-3">
                {qrScanSupported && (
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" />
                    Scan a QR code with your camera
                  </button>
                )}
                <ImageInput
                  file={imageFile}
                  onChange={setImageFile}
                  disabled={loading}
                />
              </div>
            ) : (
              <ContentInput
                mode={mode}
                value={content}
                onChange={setContent}
                disabled={loading}
              />
            )}

            <div className="mt-5 space-y-1.5">
              <label className="text-sm font-medium text-ink-800">
                Sender tag <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input
                type="text"
                spellCheck={false}
                autoComplete="off"
                className="input"
                placeholder="e.g. a phone number or handle, so SuSagi can learn what's normal for this sender"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                disabled={loading}
                maxLength={120}
              />
              <p className="text-xs text-ink-500">
                Leave blank for a one-off, anonymous check. Tagging a sender lets
                SuSagi flag messages that are unusual compared to that sender's
                own history — nothing is required to fill this in.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                Content is analyzed on the server and a minimal, anonymised
                record is kept to power Safety Insights — no raw content beyond
                a short preview is stored.
              </p>
              <div className="flex items-center gap-2">
                {(isImageMode ? imageFile : content) && (
                  <button
                    type="button"
                    onClick={() => {
                      setContent("");
                      setImageFile(null);
                      setResult(null);
                      setError(null);
                    }}
                    className="btn-ghost"
                    disabled={loading}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading || !canSubmit}
                  className="btn-brand px-5 py-2.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Analyze content
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Result ──────────────────────────────────────────────── */}
      <section ref={resultRef} className="bg-ink-50 pb-20">
        <div className="container-wide">
          {result ? (
            <RiskVerdictPanel result={result} content={analyzedContent} />
          ) : (
            <EmptyState mode={mode} />
          )}
        </div>
      </section>
    </>
  );
}

function EmptyState({ mode }: { mode: AnalysisMode }) {
  const label =
    mode === "message"
      ? "a suspicious message"
      : mode === "link"
      ? "a suspicious URL"
      : mode === "image"
      ? "a screenshot"
      : "a recruiter message or job offer";

  const verb = mode === "image" ? "Upload" : "Paste";

  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Search className="h-5 w-5" />
      </span>
      <h2 className="text-lg font-semibold text-ink-900">
        Your result will appear here
      </h2>
      <p className="max-w-md text-sm text-ink-600">
        {verb} {label} above and click <span className="font-medium">Analyze content</span>.
        SuSagi returns a clear risk verdict, the exact red flags it found, and
        what to do next — usually in under a second.
      </p>
    </div>
  );
}
