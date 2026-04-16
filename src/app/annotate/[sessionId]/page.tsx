import { getSupabaseServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import AnnotationCanvas from "@/components/AnnotationCanvas";

export default async function AnnotatePage(
  props: PageProps<"/annotate/[sessionId]">,
) {
  const { sessionId } = await props.params;

  const supabase = getSupabaseServer();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, original_url, strokes_json")
    .eq("id", sessionId)
    .single();

  if (error || !session) notFound();

  return (
    <AnnotationCanvas
      sessionId={session.id}
      originalUrl={session.original_url}
      initialStrokes={session.strokes_json ?? undefined}
    />
  );
}
