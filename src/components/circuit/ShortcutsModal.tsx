import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  {
    group: "General",
    items: [
      { keys: ["⌘", "S"],       label: "Save project" },
      { keys: ["⌘", "Z"],       label: "Undo" },
      { keys: ["⌘", "⇧", "Z"], label: "Redo" },
      { keys: ["?"],             label: "Show shortcuts" },
    ],
  },
  {
    group: "Tools",
    items: [
      { keys: ["V"],   label: "Select tool" },
      { keys: ["H"],   label: "Pan tool" },
      { keys: ["G"],   label: "Toggle grid" },
      { keys: ["S"],   label: "Toggle snap" },
      { keys: ["F"],   label: "Fit view" },
      { keys: ["="],   label: "Zoom in" },
      { keys: ["-"],   label: "Zoom out" },
    ],
  },
  {
    group: "Canvas",
    items: [
      { keys: ["⌘", "A"],       label: "Select all" },
      { keys: ["⌘", "D"],       label: "Duplicate selected" },
      { keys: ["⌘", "C"],       label: "Copy selected" },
      { keys: ["⌘", "V"],       label: "Paste" },
      { keys: ["Delete"],        label: "Delete selected" },
      { keys: ["Backspace"],     label: "Delete selected" },
      { keys: ["Escape"],        label: "Deselect / Close" },
    ],
  },
  {
    group: "Comments",
    items: [
      { keys: ["C"],   label: "Add yellow comment" },
      { keys: ["Dbl click"], label: "Edit comment text" },
    ],
  },
];

interface ShortcutsModalProps {
  onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600/20 p-1.5 rounded-lg">
              <Keyboard size={16} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 grid grid-cols-2 gap-6">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {group.group}
              </p>
              <div className="flex flex-col gap-2">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] text-slate-300 font-mono"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700">
          <p className="text-[10px] text-slate-600 text-center">
            Press <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">?</kbd> or <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}