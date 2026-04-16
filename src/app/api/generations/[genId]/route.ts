import { getSupabaseServer } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/generations/[genId]">,
) {
  const { genId } = await ctx.params;
  const supabase = getSupabaseServer();

  const { data: gen, error: fetchErr } = await supabase
    .from("generations")
    .select("id, session_id")
    .eq("id", genId)
    .single();

  if (fetchErr || !gen) {
    return Response.json({ error: "Generation not found" }, { status: 404 });
  }

  const sessionId = gen.session_id;
  await supabase.storage
    .from("annotated")
    .remove([`${sessionId}/${genId}.jpg`, `${sessionId}/${genId}.png`]);
  await supabase.storage
    .from("results")
    .remove([`${sessionId}/${genId}.png`]);

  const { error } = await supabase
    .from("generations")
    .delete()
    .eq("id", genId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
