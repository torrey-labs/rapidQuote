"use client";

import type { ToolKind } from "@/lib/types";
import { isStickerKind } from "@/lib/types";

type ToolDef = {
  kind: ToolKind;
  label: string;
  desc: string;
  color: string;
  icon?: string;
  iconSrc?: string;
};

const TOOLS: ToolDef[] = [
  { kind: "deck", label: "Deck", desc: "LED strip along deck edges + railings", color: "#3b82f6", icon: "〰️" },
  { kind: "permanent", label: "Permanent", desc: "Roofline / eaves architectural lighting", color: "#f59e0b", icon: "⌇" },
  { kind: "downlight", label: "Downlight", desc: "Eave/ceiling downlight fixture", color: "#cbd5e1", iconSrc: "/stickers/downlight.png" },
  { kind: "uplight", label: "Uplight", desc: "Ground uplight on tree/pillar", color: "#cbd5e1", iconSrc: "/stickers/uplight.png" },
  { kind: "pathlight", label: "Pathlight", desc: "Walkway path fixture", color: "#cbd5e1", iconSrc: "/stickers/pathlight.png" },
  { kind: "eraser", label: "Eraser", desc: "Remove strokes", color: "#9ca3af", iconSrc: "/icons/eraser.png" },
];

type ToolbarProps = {
  activeTool: ToolKind;
  onToolChange: (tool: ToolKind) => void;
  strokeSize: number;
  onStrokeSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasStrokes: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onBack: () => void;
  legendOpen: boolean;
  onToggleLegend: () => void;
};

export default function Toolbar({
  activeTool,
  onToolChange,
  strokeSize,
  onStrokeSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  hasStrokes,
  notesOpen,
  onToggleNotes,
  collapsed,
  onToggleCollapse,
  onBack,
  legendOpen,
  onToggleLegend,
}: ToolbarProps) {
  const sticker = isStickerKind(activeTool);
  const sizeLabel = sticker ? "Sticker size" : "Line width";
  const sizeMin = sticker ? 5 : 2;
  const sizeMax = sticker ? 25 : 20;

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/90 text-cream/70 shadow-2xl backdrop-blur-md transition hover:text-cream"
          title="Show toolbar"
        >
          ↑
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {/* Legend */}
      {legendOpen && (
        <div className="mb-1 w-80 rounded-xl bg-charcoal/90 px-4 py-3 text-xs text-cream/80 shadow-2xl backdrop-blur-md">
          <p className="mb-2 font-medium text-cream">Tool guide</p>
          {TOOLS.filter((t) => t.kind !== "eraser").map((t) => (
            <div key={t.kind} className="mb-1 flex items-center gap-2">
              {t.iconSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={t.iconSrc} alt="" className="h-4 w-4 shrink-0 object-contain" />
              ) : (
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: t.color }} />
              )}
              <span className="font-medium">{t.label}</span>
              <span className="text-cream/50">— {t.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Size slider — only for drawing tools */}
      {activeTool !== "eraser" && (
        <div className="flex w-64 items-center gap-3 rounded-xl bg-charcoal/80 px-3 py-2 backdrop-blur-md">
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-cream/40">{sizeLabel}</span>
          <input
            type="range"
            min={sizeMin}
            max={sizeMax}
            step={1}
            value={strokeSize}
            onChange={(e) => onStrokeSizeChange(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-cream/20 accent-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
          />
          <span className="w-5 text-right text-xs text-cream/50">{strokeSize}</span>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center gap-1 rounded-2xl bg-charcoal/90 px-2 py-2 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition hover:text-cream/80"
          title="New photo"
        >
          ←
        </button>

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        {TOOLS.map((t) => {
          const isSticker = isStickerKind(t.kind);
          const isEraser = t.kind === "eraser";
          return (
            <button
              key={t.kind}
              type="button"
              onClick={() => onToolChange(t.kind)}
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg transition ${
                activeTool === t.kind
                  ? "ring-2 ring-offset-1 ring-offset-charcoal"
                  : "opacity-60 hover:opacity-90"
              }`}
              style={
                activeTool === t.kind
                  ? ({ backgroundColor: t.color + "33", "--tw-ring-color": t.color } as React.CSSProperties)
                  : undefined
              }
              title={t.label}
            >
              {t.iconSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={t.iconSrc}
                  alt={t.label}
                  className="h-6 w-6 object-contain"
                  style={
                    isEraser
                      ? { filter: "invert(1)", opacity: activeTool === t.kind ? 1 : 0.7 }
                      : { opacity: activeTool === t.kind ? 1 : 0.75 }
                  }
                />
              ) : (
                <span className={`${isSticker ? "text-xs" : "text-xl"} leading-none`} style={{ color: t.color }}>
                  {t.icon}
                </span>
              )}
            </button>
          );
        })}

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        <ActionButton onClick={onUndo} disabled={!canUndo} title="Undo">↩</ActionButton>
        <ActionButton onClick={onRedo} disabled={!canRedo} title="Redo">↪</ActionButton>
        <ActionButton onClick={onClear} disabled={!hasStrokes} title="Clear all">⌫</ActionButton>

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        <button
          type="button"
          onClick={onToggleNotes}
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg transition ${
            notesOpen ? "bg-accent/20 text-accent" : "text-cream/50 hover:text-cream/80"
          }`}
          title="Notes"
        >
          ✎
        </button>

        <button
          type="button"
          onClick={onToggleLegend}
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg transition ${
            legendOpen ? "bg-accent/20 text-accent" : "text-cream/50 hover:text-cream/80"
          }`}
          title="Tool guide"
        >
          ?
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition hover:text-cream/80"
          title="Collapse toolbar"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition enabled:hover:text-cream/80 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
