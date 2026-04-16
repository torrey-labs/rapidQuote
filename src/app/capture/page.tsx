"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { resizeImage } from "@/lib/image-utils";

export default function CapturePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    try {
      const resized = await resizeImage(file);
      const form = new FormData();
      form.append("image", resized, "photo.jpg");

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }

      const { sessionId } = await res.json();
      router.push(`/annotate/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center bg-canvas-bg px-6">
      <div className="absolute top-0 left-0 p-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/70 text-lg text-cream/80 backdrop-blur-md transition hover:bg-charcoal/90 hover:text-cream active:scale-95"
        >
          ←
        </button>
      </div>
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="font-serif text-3xl text-cream">Capture a photo</h1>
        <p className="max-w-sm text-sm text-cream/60">
          Take a photo of the yard or choose one from your library. It will be
          resized automatically.
        </p>

        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
            <p className="text-sm text-cream/60">Uploading photo…</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-16 min-w-[260px] items-center justify-center rounded-full bg-accent px-8 text-lg font-medium text-charcoal transition hover:bg-accent-strong active:scale-[0.97]"
            >
              Open camera
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-3 underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
