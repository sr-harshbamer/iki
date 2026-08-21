"use client";

import { cn } from "@/lib/cn";
import { ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageInput({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = usePreviewUrl(file);

  const acceptFile = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError("Unsupported file type. Use PNG, JPEG, or WebP.");
        return;
      }
      if (f.size > MAX_BYTES) {
        setError("Image is too large. Max size is 5MB.");
        return;
      }
      setError(null);
      onChange(f);
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">
          Screenshot to analyze
        </span>
        <span className="text-xs text-ink-400">PNG, JPEG, or WebP — max 5MB</span>
      </label>

      {file && previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Uploaded screenshot preview"
            className="max-h-80 w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ink-900/80 text-white transition hover:bg-ink-900"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition",
            dragOver
              ? "border-brand-400 bg-brand-50"
              : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-700">
            <ImagePlus className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-ink-800">
            Click to upload or drag a screenshot here
          </p>
          <p className="text-xs text-ink-500">
            Works for scam texts, chats, emails, or QR codes captured as an image
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
        disabled={disabled}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function usePreviewUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}
