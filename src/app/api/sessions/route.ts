import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      label,
      original_url,
      created_at,
      generations (
        id,
        status,
        result_url,
        created_at
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const sessions = (data ?? []).map((s) => {
    const completedGen = s.generations
      ?.filter((g: { status: string }) => g.status === "complete")
      ?.sort((a: { created_at: string }, b: { created_at: string }) =>
        b.created_at.localeCompare(a.created_at),
      )?.[0];

    return {
      id: s.id,
      label: s.label,
      originalUrl: s.original_url,
      resultUrl: completedGen?.result_url ?? null,
      genId: completedGen?.id ?? null,
      createdAt: s.created_at,
    };
  });

  return Response.json({ sessions });
}
