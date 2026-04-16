"use client";

type NotesPanelProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
};

export default function NotesPanel({ open, value, onChange }: NotesPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[90vw] max-w-md -translate-x-1/2 rounded-2xl bg-charcoal/90 p-4 shadow-2xl backdrop-blur-md">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add notes for the generation (optional)…"
        rows={3}
        className="w-full resize-none rounded-lg bg-charcoal/60 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50"
      />
    </div>
  );
}
