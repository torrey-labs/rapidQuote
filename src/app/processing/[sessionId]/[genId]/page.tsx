"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string; genId: string }>;
}) {
  const { sessionId, genId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/job/${genId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        setStatus(data.status);

        if (data.status === "complete") {
          router.push(`/result/${sessionId}/${genId}`);
          return;
        }

        if (data.status === "failed") {
          setError(data.error ?? "Generation failed");
          return;
        }

        setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [genId, sessionId, router]);

  const stages: Record<string, string> = {
    pending: "Preparing your image…",
    processing: "Adding lights to your yard…",
    complete: "Done! Redirecting…",
    failed: "Something went wrong",
  };

  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-canvas-bg px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {status !== "failed" ? (
          <>
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
            <h1 className="font-serif text-2xl text-cream">
              {stages[status] ?? "Working…"}
            </h1>
            <p className="text-sm text-cream/50">
              Usually takes 15–20 seconds
            </p>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 text-3xl text-red-400">
              !
            </div>
            <h1 className="font-serif text-2xl text-cream">
              Generation failed
            </h1>
            <p className="max-w-sm text-sm text-cream/50">{error}</p>
            <button
              type="button"
              onClick={() => router.push(`/annotate/${sessionId}`)}
              className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-accent px-6 text-sm font-medium text-charcoal transition hover:bg-accent-strong active:scale-95"
            >
              Edit annotations
            </button>
          </>
        )}
      </div>
    </main>
  );
}
