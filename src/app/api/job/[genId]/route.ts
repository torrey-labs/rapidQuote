import { getSupabaseServer } from "@/lib/supabase";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/job/[genId]">,
) {
  const { genId } = await ctx.params;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("generations")
    .select("id, status, result_url, error")
    .eq("id", genId)
    .single();

  if (error || !data) {
    return Response.json({ error: "Generation not found" }, { status: 404 });
  }

  return Response.json({
    generationId: data.id,
    status: data.status,
    resultUrl: data.result_url,
    error: data.error,
  });
}
