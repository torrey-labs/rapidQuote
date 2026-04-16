import Link from "next/link";
import { connection } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export default async function Home() {
  await connection();

  let recentSessions: {
    id: string;
    label: string | null;
    original_url: string;
    created_at: string;
    generations: { id: string; status: string; result_url: string | null; created_at: string }[];
  }[] = [];

  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("sessions")
      .select("id, label, original_url, created_at, generations(id, status, result_url, created_at)")
      .order("created_at", { ascending: false })
      .limit(6);
    recentSessions = data ?? [];
  } catch {
    // Supabase not configured yet — show empty state
  }

  const sessionsWithResults = recentSessions
    .map((s) => {
      const completedGens = (s.generations ?? [])
        .filter((g: { status: string }) => g.status === "complete")
        .sort((a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at));
      const latest = completedGens[0];
      return latest ? { ...s, genId: latest.id, resultUrl: latest.result_url } : null;
    })
    .filter(Boolean) as (typeof recentSessions[0] & { genId: string; resultUrl: string | null })[];

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl flex flex-col items-center gap-14 text-center">
        <header className="flex flex-col items-center gap-4">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-accent-strong">
            Lighting Distinctions x Torrey Labs
          </p>
          <h1 className="font-serif text-5xl leading-tight text-charcoal md:text-6xl">
            See it lit,
            <br />
            before it&rsquo;s installed.
          </h1>
          <p className="mt-2 max-w-md text-base leading-relaxed text-charcoal-muted">
            Capture the yard, mark where the lights go, and get a photorealistic
            render of the finished install in under twenty seconds.
          </p>
        </header>

        <Link
          href="/capture"
          className="inline-flex h-16 min-w-[280px] items-center justify-center rounded-full bg-charcoal px-10 text-lg font-medium text-cream transition hover:bg-charcoal-muted active:scale-[0.97]"
        >
          New capture
        </Link>

        <section className="w-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-left text-sm font-medium uppercase tracking-wider text-charcoal-muted">
              Recent captures
            </h2>
            {sessionsWithResults.length > 0 && (
              <Link
                href="/history"
                className="text-sm text-accent-strong hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          {sessionsWithResults.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-charcoal/8 bg-cream-muted/40 px-6 py-12 text-center">
              <p className="text-sm text-charcoal-muted">
                No captures yet. Take a photo to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sessionsWithResults.map((s) => (
                <Link
                  key={s.id}
                  href={`/result/${s.id}/${s.genId}`}
                  className="group overflow-hidden rounded-xl border border-charcoal/8 bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.resultUrl ?? s.original_url}
                    alt={s.label ?? "Session"}
                    className="h-28 w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium text-charcoal">
                      {s.label || "Untitled"}
                    </p>
                    <p className="text-[10px] text-charcoal-muted">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
