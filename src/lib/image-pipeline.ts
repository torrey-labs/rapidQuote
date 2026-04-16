import { getGemini, getImageModel } from "./gemini";

export class GeminiRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRefusalError";
  }
}

export async function runImagePipeline(
  annotatedPngBytes: Buffer,
  fusedPrompt: string,
): Promise<Buffer> {
  const ai = getGemini();
  const model = getImageModel();

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: fusedPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: annotatedPngBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiRefusalError(
        `Gemini blocked this image (reason: ${blockReason}). Try adjusting your annotations.`,
      );
    }
    throw new Error("Gemini returned no candidates");
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    throw new Error("Gemini candidate has no content parts");
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  const finishReason = candidates[0].finishReason;
  if (finishReason === "SAFETY") {
    throw new GeminiRefusalError(
      "Gemini's safety filter rejected this image. Try a different photo or simpler annotations.",
    );
  }

  throw new Error(
    `Gemini returned no image data (finishReason: ${finishReason ?? "unknown"})`,
  );
}
