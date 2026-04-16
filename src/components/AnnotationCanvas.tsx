"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import getStroke from "perfect-freehand";
import {
  getSvgPathFromStroke,
  flattenCanvasToBlob,
  type StickerDraw,
} from "@/lib/image-utils";
import type {
  ToolKind,
  Stroke,
  LineStroke,
  StickerMark,
  StickerKind,
} from "@/lib/types";
import { STICKER_KINDS, isStickerKind } from "@/lib/types";
import Toolbar from "./Toolbar";
import NotesPanel from "./NotesPanel";

const TOOL_COLORS: Record<"deck" | "permanent", string> = {
  deck: "#3b82f6",
  permanent: "#f59e0b",
};

const DEFAULT_STROKE_SIZE = 8;
const DEFAULT_STICKER_SIZE = 10; // percent of image width

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

  // Filter out any unknown-tool strokes from old sessions (back-compat drop)
  const sanitizedInitial = (initialStrokes ?? []).filter(
    (s) =>
      s.tool === "deck" ||
      s.tool === "permanent" ||
      s.tool === "downlight" ||
      s.tool === "uplight" ||
      s.tool === "pathlight",
  );

  const [strokes, setStrokes] = useState<Stroke[]>(sanitizedInitial);
  const [redoHistory, setRedoHistory] = useState<Stroke[][]>([]);
  const [activeTool, setActiveTool] = useState<ToolKind>("deck");
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

  // Preload sticker images so we can flatten cleanly and know their aspect ratios
  const stickerImages = useRef<Record<StickerKind, HTMLImageElement | null>>({
    downlight: null,
    uplight: null,
    pathlight: null,
  });
  const [stickersReady, setStickersReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loads = STICKER_KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            stickerImages.current[kind] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `/stickers/${kind}.png`;
        }),
    );
    Promise.all(loads).then(() => {
      if (!cancelled) setStickersReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // When switching into a sticker tool, adopt the sticker default size
  useEffect(() => {
    if (isStickerKind(activeTool)) {
      setStrokeSize((prev) => (prev < 5 || prev > 25 ? DEFAULT_STICKER_SIZE : prev));
    } else if (activeTool === "deck" || activeTool === "permanent") {
      setStrokeSize((prev) => (prev < 2 || prev > 20 ? DEFAULT_STROKE_SIZE : prev));
    }
  }, [activeTool]);

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

  const stickerAspect = useCallback((kind: StickerKind): number => {
    const img = stickerImages.current[kind];
    if (!img || img.naturalWidth === 0) return 1;
    return img.naturalHeight / img.naturalWidth;
  }, []);

  const eraseAt = useCallback(
    (pt: [number, number]) => {
      const radius = 0.035;
      setStrokes((prev) => {
        const next = prev.filter((s) => {
          if (isStickerKind(s.tool)) {
            const sm = s as StickerMark;
            const hw = sm.size / 100 / 2;
            const aspect = stickerAspect(sm.tool);
            const natAspect = imgNatural.w > 0 ? imgNatural.h / imgNatural.w : 1;
            const hh = hw * aspect / natAspect;
            const r = Math.max(hw, hh);
            return Math.hypot(sm.position[0] - pt[0], sm.position[1] - pt[1]) > r;
          }
          return !(s as LineStroke).points.some((p) =>
            Math.hypot(p[0] - pt[0], p[1] - pt[1]) < radius,
          );
        });
        if (next.length < prev.length) setRedoHistory([]);
        return next;
      });
    },
    [imgNatural, stickerAspect],
  );

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
      const tool = activeToolRef.current;

      if (isStickerKind(tool)) {
        const mark: StickerMark = {
          id: crypto.randomUUID(),
          tool,
          position: pt,
          size: strokeSizeRef.current,
        };
        setStrokes((prev) => [...prev, mark]);
        setRedoHistory([]);
        return;
      }

      if (tool === "eraser") {
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
    const tool = activeToolRef.current;
    if (tool !== "deck" && tool !== "permanent") return;

    setCurrentPoints((pts) => {
      if (pts.length < 2) return [];
      const stroke: LineStroke = {
        id: crypto.randomUUID(),
        tool,
        color: TOOL_COLORS[tool],
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

  function renderStickerMark(s: StickerMark) {
    const width = (s.size / 100) * imgNatural.w;
    const aspect = stickerAspect(s.tool);
    const height = width * aspect;
    const cx = s.position[0] * imgNatural.w;
    const cy = s.position[1] * imgNatural.h;
    return (
      <image
        key={s.id}
        href={`/stickers/${s.tool}.png`}
        x={cx - width / 2}
        y={cy - height / 2}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  function renderCurrentStroke() {
    if (currentPoints.length < 2) return null;
    if (activeTool !== "deck" && activeTool !== "permanent") return null;
    const px = currentPoints.map(([rx, ry]) => [rx * imgNatural.w, ry * imgNatural.h]);
    const outline = getStroke(px, {
      size: strokeSize,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    return (
      <path
        d={getSvgPathFromStroke(outline)}
        fill={TOOL_COLORS[activeTool]}
        opacity={0.6}
      />
    );
  }

  // --- Generate ---
  async function handleGenerate() {
    if (!imgRef.current || !svgRef.current) return;
    if (!stickersReady) {
      setGenerateError("Sticker assets still loading — try again in a moment.");
      return;
    }
    setGenerating(true);
    try {
      const stickerDraws: StickerDraw[] = [];
      for (const s of strokes) {
        if (!isStickerKind(s.tool)) continue;
        const sm = s as StickerMark;
        const img = stickerImages.current[sm.tool];
        if (!img) continue;
        const w = (sm.size / 100) * imgNatural.w;
        const h = w * (img.naturalHeight / img.naturalWidth);
        stickerDraws.push({
          image: img,
          cx: sm.position[0] * imgNatural.w,
          cy: sm.position[1] * imgNatural.h,
          w,
          h,
        });
      }

      const blob = await flattenCanvasToBlob(imgRef.current, svgRef.current, stickerDraws);
      const strokesJson = JSON.stringify(strokes);
      console.log("[generate] payload sizes", {
        annotatedBlobKB: Math.round(blob.size / 1024),
        blobType: blob.type,
        strokesJsonKB: Math.round(strokesJson.length / 1024),
        notesBytes: notes.length,
        stickerCount: stickerDraws.length,
      });

      if (blob.size > 4 * 1024 * 1024) {
        throw new Error(
          `Annotated image is ${Math.round(blob.size / 1024 / 1024)}MB — too large to upload. Try a simpler annotation.`,
        );
      }

      const form = new FormData();
      form.append("annotatedImage", blob, "annotated.jpg");
      form.append("sessionId", sessionId);
      form.append("strokes", strokesJson);
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
              isStickerKind(s.tool)
                ? renderStickerMark(s as StickerMark)
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
