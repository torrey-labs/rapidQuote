import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: config.anthropic.apiKey() });
  }
  return cached;
}

export const PROMPT_FUSION_MODEL = "claude-haiku-4-5-20251001" as const;
