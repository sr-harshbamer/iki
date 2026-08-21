"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Live QR detection using the browser's native Barcode Detection API --
 * no scanning library needed, and it's well supported on Android Chrome
 * (the platform this is actually installed on as a PWA). Where it's
 * unsupported (notably desktop Safari), the caller should fall back to
 * the existing upload-a-screenshot flow rather than blocking on this.
 */
type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function isQrScanSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function QrCameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (content: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      if (!window.BarcodeDetector) {
        setError("Live scanning isn't supported in this browser. Use Image Check to upload a screenshot instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("Camera access was denied or unavailable. Use Image Check to upload a screenshot instead.");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

      const scan = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            onDetected(codes[0].rawValue);
            return; // parent unmounts this component -- cleanup handles the stream
          }
        } catch {
          // A single failed detect() (e.g. video not ready yet) isn't fatal -- keep scanning.
        }
        raf = requestAnimationFrame(scan);
      };
      raf = requestAnimationFrame(scan);
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-white">Scan a QR code</span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="mx-6 max-w-sm rounded-xl bg-white/10 p-5 text-center text-sm text-white">
            {error}
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-56 w-56 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            <p className="absolute bottom-10 px-6 text-center text-sm text-white/80">
              Point the camera at a QR code. It will be checked before anything opens.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
