"use client";

import type { ToolKind } from "@/lib/types";

const TOOLS: { kind: ToolKind; label: string; desc: string; color: string; icon?: string; iconSrc?: string }[] = [
  { kind: "pathway", label: "Pathway", desc: "Path lights along walkways", color: "#3b82f6", icon: "〰️" },
  { kind: "roofline", label: "Roofline", desc: "Lights along roof edges", color: "#f59e0b", icon: "⌇" },
  { kind: "accent", label: "Accent", desc: "Spot lights on trees/pillars", color: "#ef4444", icon: "✕" },
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
  const sizeLabel = activeTool === "accent" ? "Mark size" : "Line width";
  const sizeMin = activeTool === "accent" ? 8 : 2;
  const sizeMax = activeTool === "accent" ? 30 : 20;

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
        <div className="mb-1 w-72 rounded-xl bg-charcoal/90 px-4 py-3 text-xs text-cream/80 shadow-2xl backdrop-blur-md">
          <p className="mb-2 font-medium text-cream">Tool guide</p>
          {TOOLS.filter((t) => t.kind !== "eraser").map((t) => (
            <div key={t.kind} className="mb-1 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: t.color }} />
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
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-lg text-cream/50 transition hover:text-cream/80"
          title="New photo"
        >
          ←
        </button>

        <div className="mx-0.5 h-6 w-px bg-cream/20" />

        {/* Tool buttons */}
        {TOOLS.map((t) => (
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
                ? { backgroundColor: t.color + "33", "--tw-ring-color": t.color } as React.CSSProperties
                : undefined
            }
            title={t.label}
          >
            {t.iconSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={t.iconSrc}
                alt={t.label}
                className="h-5 w-5"
                style={{ filter: "invert(1)", opacity: activeTool === t.kind ? 1 : 0.7 }}
              />
            ) : (
              <span className="text-xl leading-none" style={{ color: t.color }}>
                {t.icon}
              </span>
            )}
          </button>
        ))}

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
