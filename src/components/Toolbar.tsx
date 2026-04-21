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
  { kind: "permanent", label: "Permanent", desc: "Roofline / eaves architectural lighting", color: "#a855f7", icon: "⌇" },
  { kind: "downlight", label: "Downlight", desc: "Eave/ceiling downlight fixture", color: "#cbd5e1", iconSrc: "/stickers/downlight.png" },
  { kind: "uplight", label: "Uplight", desc: "Ground uplight on tree/pillar", color: "#cbd5e1", iconSrc: "/stickers/uplight.png" },
  { kind: "pathlight", label: "Pathlight", desc: "Walkway path fixture", color: "#cbd5e1", iconSrc: "/stickers/pathlight.png" },
  { kind: "eraser", label: "Eraser", desc: "Remove strokes", color: "#9ca3af", iconSrc: "/icons/eraser.png" },
];

function getSizeRange(kind: ToolKind): { min: number; max: number } {
  switch (kind) {
    case "permanent":
      return { min: 3, max: 8 };
    case "downlight":
    case "uplight":
    case "pathlight":
      return { min: 1, max: 10 };
    default:
      return { min: 1, max: 10 };
  }
}

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
  const { min: sizeMin, max: sizeMax } = getSizeRange(activeTool);

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <Tooltip label="Show toolbar">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/90 text-cream/70 shadow-2xl backdrop-blur-md transition hover:text-cream"
            aria-label="Show toolbar"
          >
            ↑
          </button>
        </Tooltip>
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
        <Tooltip label="New photo">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition hover:text-cream/80"
            aria-label="New photo"
          >
            ←
          </button>
        </Tooltip>

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        {TOOLS.map((t) => {
          const isSticker = isStickerKind(t.kind);
          const isEraser = t.kind === "eraser";
          return (
            <Tooltip key={t.kind} label={t.label}>
              <button
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
                aria-label={t.label}
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
            </Tooltip>
          );
        })}

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        <ActionButton onClick={onUndo} disabled={!canUndo} label="Undo">↩</ActionButton>
        <ActionButton onClick={onRedo} disabled={!canRedo} label="Redo">↪</ActionButton>
        <ActionButton onClick={onClear} disabled={!hasStrokes} label="Clear all">⌫</ActionButton>

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        <Tooltip label="Notes">
          <button
            type="button"
            onClick={onToggleNotes}
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg transition ${
              notesOpen ? "bg-accent/20 text-accent" : "text-cream/50 hover:text-cream/80"
            }`}
            aria-label="Notes"
          >
            ✎
          </button>
        </Tooltip>

        <Tooltip label="Tool guide">
          <button
            type="button"
            onClick={onToggleLegend}
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg transition ${
              legendOpen ? "bg-accent/20 text-accent" : "text-cream/50 hover:text-cream/80"
            }`}
            aria-label="Tool guide"
          >
            ?
          </button>
        </Tooltip>

        <Tooltip label="Collapse toolbar">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition hover:text-cream/80"
            aria-label="Collapse toolbar"
          >
            ↓
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition enabled:hover:text-cream/80 disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-charcoal/95 px-2 py-1 text-xs text-cream opacity-0 shadow-lg ring-1 ring-cream/10 transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}
