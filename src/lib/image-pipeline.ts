import { readFile } from "fs/promises";
import path from "path";
import { getGemini, getImageModel } from "./gemini";

export class GeminiRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRefusalError";
  }
}

// Neutral alias so routes can import either name.
export { GeminiRefusalError as ImageGenRefusalError };

function sniffImageMimeType(buf: Buffer): "image/jpeg" | "image/png" {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  return "image/jpeg";
}

type StickerRefs = {
  uplight: Buffer;
  downlight: Buffer;
  pathlight: Buffer;
};

let cachedStickers: StickerRefs | null = null;

async function loadStickerRefs(): Promise<StickerRefs> {
  if (cachedStickers) return cachedStickers;
  const base = path.join(process.cwd(), "public", "stickers");
  const [uplight, downlight, pathlight] = await Promise.all([
    readFile(path.join(base, "uplight.png")),
    readFile(path.join(base, "downlight.png")),
    readFile(path.join(base, "pathlight.png")),
  ]);
  cachedStickers = { uplight, downlight, pathlight };
  return cachedStickers;
}

export async function runImagePipeline(
  annotatedBytes: Buffer,
  finalPrompt: string,
): Promise<Buffer> {
  const ai = getGemini();
  const model = getImageModel();
  const annotatedMime = sniffImageMimeType(annotatedBytes);
  const refs = await loadStickerRefs();

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: finalPrompt },
          {
            inlineData: {
              mimeType: annotatedMime,
              data: annotatedBytes.toString("base64"),
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: refs.uplight.toString("base64"),
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: refs.downlight.toString("base64"),
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: refs.pathlight.toString("base64"),
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
