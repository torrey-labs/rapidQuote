"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import getStroke from "perfect-freehand";
import { getSvgPathFromStroke, flattenCanvasToBlob } from "@/lib/image-utils";
import type { ToolKind, Stroke, LineStroke, AccentMark } from "@/lib/types";
import Toolbar from "./Toolbar";
import NotesPanel from "./NotesPanel";

const TOOL_COLORS: Record<string, string> = {
  pathway: "#3b82f6",
  roofline: "#f59e0b",
  accent: "#ef4444",
};

const DEFAULT_STROKE_SIZE = 8;

type Props = {
  sessionId: string;
  originalUrl: string;
  initialStrokes?: Stroke[];
};

export default function AnnotationCanvas({ sessionId, originalUrl, initialStrokes }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [imgRendered, setImgRendered] = useState({ w: 0, h: 0, x: 0, y: 0 });

  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes ?? []);
  const [redoHistory, setRedoHistory] = useState<Stroke[][]>([]);
  const [activeTool, setActiveTool] = useState<ToolKind>("pathway");
  const [strokeSize, setStrokeSize] = useState(DEFAULT_STROKE_SIZE);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const isDrawing = useRef(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Compute the actual rendered position/size of the image within its container
  const updateRenderedRect = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || img.naturalWidth === 0) return;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const cRect = container.getBoundingClientRect();

    const scale = Math.min(cRect.width / natW, cRect.height / natH);
    const renderedW = natW * scale;
    const renderedH = natH * scale;
    const offsetX = (cRect.width - renderedW) / 2;
    const offsetY = (cRect.height - renderedH) / 2;

    setImgNatural({ w: natW, h: natH });
    setImgRendered({ w: renderedW, h: renderedH, x: offsetX, y: offsetY });
    setImgLoaded(true);
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) updateRenderedRect();
    img.addEventListener("load", updateRenderedRect);
    return () => img.removeEventListener("load", updateRenderedRect);
  }, [updateRenderedRect]);

  useEffect(() => {
    window.addEventListener("resize", updateRenderedRect);
    return () => window.removeEventListener("resize", updateRenderedRect);
  }, [updateRenderedRect]);

  // Convert pointer coords to 0–1 ratio relative to the rendered image
  const toRatio = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const container = containerRef.current;
      if (!container || imgRendered.w === 0) return [0, 0];
      const cRect = container.getBoundingClientRect();
      const x = clientX - cRect.left - imgRendered.x;
      const y = clientY - cRect.top - imgRendered.y;
      return [x / imgRendered.w, y / imgRendered.h];
    },
    [imgRendered],
  );

  // --- Undo / Redo / Clear ---
  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      setRedoHistory((r) => [...r, [removed]]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoHistory((prev) => {
      if (prev.length === 0) return prev;
      const batch = prev[prev.length - 1];
      const restored = batch.map((s) => ({ ...s, id: crypto.randomUUID() }));
      setStrokes((curr) => [...curr, ...restored]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      setRedoHistory((r) => [...r, prev]);
      return [];
    });
  }, []);

  const eraseAt = useCallback((pt: [number, number]) => {
    const radius = 0.035;
    setStrokes((prev) => {
      const next = prev.filter((s) => {
        if (s.tool === "accent") {
          return Math.hypot(s.position[0] - pt[0], s.position[1] - pt[1]) > radius;
        }
        return !(s as LineStroke).points.some((p) =>
          Math.hypot(p[0] - pt[0], p[1] - pt[1]) < radius,
        );
      });
      if (next.length < prev.length) setRedoHistory([]);
      return next;
    });
  }, []);

  // --- Pointer handlers ---
  const strokeSizeRef = useRef(strokeSize);
  strokeSizeRef.current = strokeSize;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const pt = toRatio(e.clientX, e.clientY);

      if (activeToolRef.current === "accent") {
        const mark: AccentMark = {
          id: crypto.randomUUID(),
          tool: "accent",
          color: TOOL_COLORS.accent,
          position: pt,
          size: strokeSizeRef.current,
        };
        setStrokes((prev) => [...prev, mark]);
        setRedoHistory([]);
        return;
      }

      if (activeToolRef.current === "eraser") {
        eraseAt(pt);
        isDrawing.current = true;
        return;
      }

      isDrawing.current = true;
      setCurrentPoints([pt]);
    },
    [toRatio, eraseAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pt = toRatio(e.clientX, e.clientY);

      if (activeToolRef.current === "eraser") {
        eraseAt(pt);
        return;
      }

      setCurrentPoints((prev) => [...prev, pt]);
    },
    [toRatio, eraseAt],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (activeToolRef.current === "eraser") return;

    setCurrentPoints((pts) => {
      if (pts.length < 2) return [];
      const stroke: LineStroke = {
        id: crypto.randomUUID(),
        tool: activeToolRef.current as "pathway" | "roofline",
        color: TOOL_COLORS[activeToolRef.current],
        width: strokeSizeRef.current,
        points: pts,
      };
      setStrokes((prev) => [...prev, stroke]);
      setRedoHistory([]);
      return [];
    });
  }, []);

  // --- Render ---
  function renderLineStroke(s: LineStroke) {
    const px = s.points.map(([rx, ry]) => [rx * imgNatural.w, ry * imgNatural.h]);
    const outline = getStroke(px, {
      size: s.width,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    return <path key={s.id} d={getSvgPathFromStroke(outline)} fill={s.color} opacity={0.8} />;
  }

  function renderAccentMark(s: AccentMark) {
    const cx = s.position[0] * imgNatural.w;
    const cy = s.position[1] * imgNatural.h;
    const halfSize = imgNatural.w * 0.015;
    const sw = Math.max(2, s.size * 0.4);
    return (
      <g key={s.id}>
        <line x1={cx - halfSize} y1={cy - halfSize} x2={cx + halfSize} y2={cy + halfSize}
          stroke={s.color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={cx + halfSize} y1={cy - halfSize} x2={cx - halfSize} y2={cy + halfSize}
          stroke={s.color} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  }

  function renderCurrentStroke() {
    if (currentPoints.length < 2 || activeTool === "accent" || activeTool === "eraser")
      return null;
    const px = currentPoints.map(([rx, ry]) => [rx * imgNatural.w, ry * imgNatural.h]);
    const outline = getStroke(px, {
      size: strokeSize,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    return <path d={getSvgPathFromStroke(outline)} fill={TOOL_COLORS[activeTool]} opacity={0.6} />;
  }

  // --- Generate ---
  async function handleGenerate() {
    if (!imgRef.current || !svgRef.current) return;
    setGenerating(true);
    try {
      const blob = await flattenCanvasToBlob(imgRef.current, svgRef.current);
      const form = new FormData();
      form.append("annotatedImage", blob, "annotated.png");
      form.append("sessionId", sessionId);
      form.append("strokes", JSON.stringify(strokes));
      if (notes.trim()) form.append("notes", notes.trim());

      const res = await fetch("/api/generate", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${res.status})`);
      }
      const { generationId } = await res.json();
      window.location.href = `/processing/${sessionId}/${generationId}`;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  }

  return (
    <div className="relative flex h-dvh w-full flex-col bg-canvas-bg">
      {/* Top bar — back button + hint */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => router.push("/capture")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-charcoal/70 text-lg text-cream/80 backdrop-blur-md transition hover:bg-charcoal/90 hover:text-cream active:scale-95"
        >
          ←
        </button>

        {!hintDismissed && (
          <div className="flex items-start gap-2 rounded-xl bg-charcoal/70 px-3 py-2 backdrop-blur-md">
            <p className="text-xs leading-relaxed text-cream/80">
              Describe the scene in the notes panel <span className="inline-block text-accent">✎</span> below, e.g. <em className="text-cream/60">&quot;backyard with pool and fountain&quot;</em>
            </p>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              className="mt-0.5 shrink-0 text-sm text-cream/50 hover:text-cream/80"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Container — image + SVG sized to match exactly */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={originalUrl}
          alt="Captured yard"
          className="max-h-full max-w-full object-contain"
          crossOrigin="anonymous"
          draggable={false}
        />

        {imgLoaded && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${imgNatural.w} ${imgNatural.h}`}
            style={{
              position: "absolute",
              left: imgRendered.x,
              top: imgRendered.y,
              width: imgRendered.w,
              height: imgRendered.h,
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {strokes.map((s) =>
              s.tool === "accent"
                ? renderAccentMark(s)
                : renderLineStroke(s as LineStroke),
            )}
            {renderCurrentStroke()}
          </svg>
        )}
      </div>

      {/* Error banner */}
      {generateError && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-xl bg-red-900/80 px-4 py-2.5 text-sm text-red-200 shadow-lg backdrop-blur-md">
            <span>{generateError}</span>
            <button type="button" onClick={() => setGenerateError(null)} className="shrink-0 text-red-400 hover:text-red-200">✕</button>
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="fixed right-4 bottom-20 z-50">
        <button
          type="button"
          disabled={strokes.length === 0 || generating}
          onClick={handleGenerate}
          className="flex h-14 items-center gap-2 justify-center rounded-full bg-accent px-6 text-base font-medium text-charcoal shadow-lg transition enabled:hover:bg-accent-strong active:scale-95 disabled:opacity-40"
        >
          {generating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-charcoal/30 border-t-charcoal" />}
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>

      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        strokeSize={strokeSize}
        onStrokeSizeChange={setStrokeSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={strokes.length > 0}
        canRedo={redoHistory.length > 0}
        hasStrokes={strokes.length > 0}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen((o) => !o)}
        collapsed={toolbarCollapsed}
        onToggleCollapse={() => setToolbarCollapsed((c) => !c)}
        onBack={() => router.push("/capture")}
        legendOpen={legendOpen}
        onToggleLegend={() => setLegendOpen((o) => !o)}
      />
      <NotesPanel open={notesOpen} value={notes} onChange={setNotes} />
    </div>
  );
}
