import { config } from "@/lib/config";
import { getSupabaseServer } from "@/lib/supabase";

type ServiceStatus = "ok" | "not_configured" | "error";

export async function GET() {
  const env = config.check();

  let supabase: ServiceStatus = env.supabase ? "ok" : "not_configured";
  let supabaseError: string | undefined;

  if (env.supabase) {
    try {
      const client = getSupabaseServer();
      const { error } = await client
        .from("sessions")
        .select("id", { head: true, count: "exact" })
        .limit(1);
      if (error) {
        supabase = "error";
        supabaseError = error.message;
      }
    } catch (err) {
      supabase = "error";
      supabaseError = err instanceof Error ? err.message : String(err);
    }
  }

  const ok =
    supabase === "ok" && env.anthropic && env.gemini;

  return Response.json(
    {
      ok,
      services: {
        supabase,
        supabaseError,
        anthropic: env.anthropic ? "configured" : "not_configured",
        gemini: env.gemini ? "configured" : "not_configured",
        geminiModel: env.geminiModel,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
