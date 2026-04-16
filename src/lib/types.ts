export type StickerKind = "downlight" | "uplight" | "pathlight";

export type ToolKind =
  | "deck"
  | "permanent"
  | StickerKind
  | "eraser";

export type LineStroke = {
  id: string;
  tool: "deck" | "permanent";
  color: string;
  width: number;
  points: [number, number][];
};

export type StickerMark = {
  id: string;
  tool: StickerKind;
  position: [number, number];
  size: number;
};

export type Stroke = LineStroke | StickerMark;

export type StrokeCounts = {
  deck: number;
  permanent: number;
  downlight: number;
  uplight: number;
  pathlight: number;
};

export const emptyStrokeCounts = (): StrokeCounts => ({
  deck: 0,
  permanent: 0,
  downlight: 0,
  uplight: 0,
  pathlight: 0,
});

export const STICKER_KINDS: readonly StickerKind[] = [
  "downlight",
  "uplight",
  "pathlight",
];

export function isStickerKind(tool: ToolKind): tool is StickerKind {
  return tool === "downlight" || tool === "uplight" || tool === "pathlight";
}

export type GenerationStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export type SessionRow = {
  id: string;
  label: string | null;
  original_url: string;
  strokes_json: Stroke[] | null;
  created_at: string;
  updated_at: string;
};

export type GenerationRow = {
  id: string;
  session_id: string;
  status: GenerationStatus;
  annotated_url: string | null;
  result_url: string | null;
  fusion_log: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};
