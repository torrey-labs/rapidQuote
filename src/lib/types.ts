export type ToolKind = "pathway" | "roofline" | "accent" | "eraser";

export type LineStroke = {
  id: string;
  tool: "pathway" | "roofline";
  color: string;
  width: number;
  points: [number, number][];
};

export type AccentMark = {
  id: string;
  tool: "accent";
  color: string;
  position: [number, number];
  size: number;
};

export type Stroke = LineStroke | AccentMark;

export type StrokeCounts = {
  pathway: number;
  roofline: number;
  accent: number;
};

export const emptyStrokeCounts = (): StrokeCounts => ({
  pathway: 0,
  roofline: 0,
  accent: 0,
});

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
