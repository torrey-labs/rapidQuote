import { getAnthropic, PROMPT_FUSION_MODEL } from "./anthropic";
import { MASTER_PROMPT, buildUserMessage } from "./prompts/master-prompt";
import type { StrokeCounts } from "./types";

type FusionResult = {
  finalPrompt: string;
  reasoning: string;
};

export async function fusePrompt(
  counts: StrokeCounts,
  notes: string,
): Promise<FusionResult> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: PROMPT_FUSION_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: MASTER_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildUserMessage(counts, notes),
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as FusionResult;
    if (!parsed.finalPrompt) {
      throw new Error("Missing finalPrompt in fusion response");
    }
    return parsed;
  } catch {
    return {
      finalPrompt: text,
      reasoning: "Failed to parse JSON — using raw response as prompt",
    };
  }
}
