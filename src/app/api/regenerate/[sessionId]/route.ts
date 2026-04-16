import { getSupabaseServer } from "@/lib/supabase";
import { fusePrompt } from "@/lib/prompt-fusion";
import { runImagePipeline, GeminiRefusalError } from "@/lib/image-pipeline";
import { randomUUID } from "crypto";
import { after } from "next/server";
import type { Stroke, StrokeCounts } from "@/lib/types";

function countStrokes(strokes: Stroke[]): StrokeCounts {
  const counts: StrokeCounts = {
    deck: 0,
    permanent: 0,
    downlight: 0,
    uplight: 0,
    pathlight: 0,
  };
  for (const s of strokes) {
    if (s.tool === "deck") counts.deck++;
    else if (s.tool === "permanent") counts.permanent++;
    else if (s.tool === "downlight") counts.downlight++;
    else if (s.tool === "uplight") counts.uplight++;
    else if (s.tool === "pathlight") counts.pathlight++;
  }
  return counts;
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/regenerate/[sessionId]">,
) {
  const { sessionId } = await ctx.params;
  const supabase = getSupabaseServer();

  // Get session with strokes
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, strokes_json")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Get the most recent generation's annotated image
  const { data: lastGen } = await supabase
    .from("generations")
    .select("annotated_url")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastGen?.annotated_url) {
    return Response.json(
      { error: "No annotated image found — annotate first" },
      { status: 400 },
    );
  }

  // Download the annotated image
  const imgRes = await fetch(lastGen.annotated_url);
  if (!imgRes.ok) {
    return Response.json(
      { error: "Failed to fetch annotated image" },
      { status: 500 },
    );
  }
  const annotatedBuffer = Buffer.from(await imgRes.arrayBuffer());

  const genId = randomUUID();

  const { error: insertErr } = await supabase.from("generations").insert({
    id: genId,
    session_id: sessionId,
    status: "pending",
    annotated_url: lastGen.annotated_url,
  });

  if (insertErr) {
    return Response.json(
      { error: `Insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  const strokes: Stroke[] = session.strokes_json ?? [];

  after(async () => {
    try {
      await supabase
        .from("generations")
        .update({ status: "processing" })
        .eq("id", genId);

      const counts = countStrokes(strokes);
      const { finalPrompt, reasoning } = await fusePrompt(counts, "");

      await supabase
        .from("generations")
        .update({ fusion_log: `${reasoning}\n\n---\n\n${finalPrompt}` })
        .eq("id", genId);

      const resultBuffer = await runImagePipeline(annotatedBuffer, finalPrompt);

      const resultPath = `${sessionId}/${genId}.png`;
      const { error: uploadErr } = await supabase.storage
        .from("results")
        .upload(resultPath, resultBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const {
        data: { publicUrl: resultUrl },
      } = supabase.storage.from("results").getPublicUrl(resultPath);

      await supabase
        .from("generations")
        .update({ status: "complete", result_url: resultUrl, attempts: 1 })
        .eq("id", genId);
    } catch (err) {
      const message =
        err instanceof GeminiRefusalError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";

      await supabase
        .from("generations")
        .update({ status: "failed", error: message, attempts: 1 })
        .eq("id", genId);
    }
  });

  return Response.json({ generationId: genId });
}
