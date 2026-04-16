import { getSupabaseServer } from "@/lib/supabase";
import { fusePrompt } from "@/lib/prompt-fusion";
import { runImagePipeline, GeminiRefusalError } from "@/lib/image-pipeline";
import { getImageModel } from "@/lib/gemini";
import { randomUUID } from "crypto";
import { after } from "next/server";
import type { Stroke, StrokeCounts } from "@/lib/types";

function countStrokes(strokes: Stroke[]): StrokeCounts {
  const counts: StrokeCounts = { pathway: 0, roofline: 0, accent: 0 };
  for (const s of strokes) {
    if (s.tool === "pathway") counts.pathway++;
    else if (s.tool === "roofline") counts.roofline++;
    else if (s.tool === "accent") counts.accent++;
  }
  return counts;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const sessionId = formData.get("sessionId") as string | null;
  const annotatedImage = formData.get("annotatedImage") as Blob | null;
  const strokesRaw = formData.get("strokes") as string | null;
  const notes = (formData.get("notes") as string | null) ?? "";

  if (!sessionId || !annotatedImage) {
    return Response.json(
      { error: "Missing sessionId or annotatedImage" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const genId = randomUUID();
  const storagePath = `${sessionId}/${genId}.jpg`;

  const annotatedBuffer = Buffer.from(await annotatedImage.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("annotated")
    .upload(storagePath, annotatedBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadErr) {
    return Response.json(
      { error: `Annotated upload failed: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl: annotatedUrl },
  } = supabase.storage.from("annotated").getPublicUrl(storagePath);

  let strokes: Stroke[] = [];
  if (strokesRaw) {
    strokes = JSON.parse(strokesRaw);
    await supabase
      .from("sessions")
      .update({ strokes_json: strokes })
      .eq("id", sessionId);
  }

  const { error: insertErr } = await supabase.from("generations").insert({
    id: genId,
    session_id: sessionId,
    status: "pending",
    annotated_url: annotatedUrl,
  });

  if (insertErr) {
    return Response.json(
      { error: `Generation insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // Run pipeline asynchronously after responding
  after(async () => {
    try {
      await supabase
        .from("generations")
        .update({ status: "processing" })
        .eq("id", genId);

      // 1. Prompt fusion via Claude Haiku
      const counts = countStrokes(strokes);
      const { finalPrompt, reasoning, masterPrompt, userMessage } =
        await fusePrompt(counts, notes);

      const imageModel = getImageModel();

      await supabase
        .from("generations")
        .update({
          master_prompt: masterPrompt,
          user_message: userMessage,
          fused_prompt: finalPrompt,
          fusion_reasoning: reasoning,
          image_model: imageModel,
          fusion_log: `${reasoning}\n\n---\n\n${finalPrompt}`,
        })
        .eq("id", genId);

      // 2. Gemini image generation
      const resultBuffer = await runImagePipeline(annotatedBuffer, finalPrompt);

      // 3. Upload result to Supabase Storage
      const resultPath = `${sessionId}/${genId}.png`;
      const { error: resultUploadErr } = await supabase.storage
        .from("results")
        .upload(resultPath, resultBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (resultUploadErr) {
        throw new Error(`Result upload failed: ${resultUploadErr.message}`);
      }

      const {
        data: { publicUrl: resultUrl },
      } = supabase.storage.from("results").getPublicUrl(resultPath);

      // 4. Mark complete
      await supabase
        .from("generations")
        .update({
          status: "complete",
          result_url: resultUrl,
          attempts: 1,
        })
        .eq("id", genId);
    } catch (err) {
      const message =
        err instanceof GeminiRefusalError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown pipeline error";

      await supabase
        .from("generations")
        .update({
          status: "failed",
          error: message,
          attempts: 1,
        })
        .eq("id", genId);
    }
  });

  return Response.json({ generationId: genId });
}
