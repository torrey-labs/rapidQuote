import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!cached) {
    cached = new GoogleGenAI({ apiKey: config.gemini.apiKey() });
  }
  return cached;
}

export function getImageModel(): string {
  return config.gemini.model();
}
