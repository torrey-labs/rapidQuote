const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. See .env.example and AGENTS.md "Run locally" section.`,
    );
  }
  return value;
};

export const config = {
  supabase: {
    url: () => required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: () => required("SUPABASE_SERVICE_KEY"),
  },
  anthropic: {
    apiKey: () => required("ANTHROPIC_API_KEY"),
  },
  gemini: {
    apiKey: () => required("GEMINI_API_KEY"),
    model: () => required("GEMINI_IMAGE_MODEL"),
  },
  fal: {
    apiKey: () => required("FAL_KEY"),
    model: () => process.env.FAL_IMAGE_MODEL ?? "fal-ai/flux-pro/kontext",
    configured: () => Boolean(process.env.FAL_KEY),
  },
  check: () => ({
    supabase:
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.SUPABASE_SERVICE_KEY),
    supabasePublic:
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini:
      Boolean(process.env.GEMINI_API_KEY) &&
      Boolean(process.env.GEMINI_IMAGE_MODEL),
    geminiModel: process.env.GEMINI_IMAGE_MODEL ?? null,
    fal: Boolean(process.env.FAL_KEY),
    falModel: process.env.FAL_IMAGE_MODEL ?? "fal-ai/flux-pro/kontext",
  }),
};
