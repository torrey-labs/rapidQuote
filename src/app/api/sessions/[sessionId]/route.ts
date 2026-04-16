import { getSupabaseServer } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionId]">,
) {
  const { sessionId } = await ctx.params;
  const body = await request.json();

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("sessions")
    .update({ label: body.label ?? null })
    .eq("id", sessionId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionId]">,
) {
  const { sessionId } = await ctx.params;
  const supabase = getSupabaseServer();

  // Delete storage objects
  const buckets = ["originals", "annotated", "results"] as const;
  for (const bucket of buckets) {
    const { data: files } = await supabase.storage
      .from(bucket)
      .list(sessionId);
    if (files && files.length > 0) {
      await supabase.storage
        .from(bucket)
        .remove(files.map((f) => `${sessionId}/${f.name}`));
    }
  }

  // Cascade delete handled by FK
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
