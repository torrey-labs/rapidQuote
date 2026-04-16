"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SessionItem = {
  id: string;
  label: string | null;
  originalUrl: string;
  resultUrl: string | null;
  genId: string | null;
  createdAt: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this session and all its images?")) return;
    setDeleting(id);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeleting(null);
  }

  return (
    <main className="min-h-dvh bg-cream px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/10 text-lg text-charcoal transition hover:bg-charcoal/20 active:scale-95"
          >
            ←
          </button>
          <h1 className="font-serif text-2xl text-charcoal">History</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-charcoal/15 border-t-accent" />
            <p className="text-sm text-charcoal-muted">Loading sessions…</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-charcoal-muted">No captures yet.</p>
            <Link
              href="/capture"
              className="inline-flex min-h-[48px] items-center rounded-full bg-charcoal px-6 text-sm font-medium text-cream active:scale-95"
            >
              New capture
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="overflow-hidden rounded-2xl border border-charcoal/8 bg-white shadow-sm"
              >
                <div className="flex h-40 gap-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.originalUrl}
                    alt="Original"
                    className="h-full w-1/2 object-cover"
                  />
                  {s.resultUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.resultUrl}
                      alt="Result"
                      className="h-full w-1/2 object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-1/2 items-center justify-center bg-charcoal/5 text-xs text-charcoal-muted">
                      No result
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      {s.label || "Untitled"}
                    </p>
                    <p className="text-xs text-charcoal-muted">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {s.resultUrl && s.genId && (
                      <button
                        type="button"
                        onClick={() => router.push(`/result/${s.id}/${s.genId}`)}
                        className="min-h-[40px] rounded-lg bg-charcoal/5 px-4 py-2 text-xs font-medium text-charcoal transition hover:bg-charcoal/10 active:scale-95"
                      >
                        View
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="min-h-[40px] rounded-lg bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 active:scale-95 disabled:opacity-40"
                    >
                      {deleting === s.id ? (
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
