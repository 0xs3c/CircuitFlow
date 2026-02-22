import { useEffect, useRef } from "react";
import {
  Trash2, Copy, MessageSquarePlus, Tag,
  Maximize2, ClipboardPaste, MousePointer2
} from "lucide-react";
import { clsx } from "clsx";

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerAbove?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 min-w-44"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.dividerAbove && (
            <div className="h-px bg-slate-700 my-1 mx-2" />
          )}
          <button
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              item.danger
                ? "text-red-400 hover:bg-red-900/30"
                : "text-slate-300 hover:bg-slate-700"
            )}
          >
            <span className="shrink-0 opacity-70">{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Context menu item factories ──────────────────────────────────────────────

export function componentContextItems({
  onDelete,
  onDuplicate,
  onAddComment,
}: {
  onDelete: () => void;
  onDuplicate: () => void;
  onAddComment: () => void;
}): ContextMenuItem[] {
  return [
    {
      label: "Duplicate",
      icon: <Copy size={13} />,
      onClick: onDuplicate,
    },
    {
      label: "Add Comment Nearby",
      icon: <MessageSquarePlus size={13} />,
      onClick: onAddComment,
    },
    {
      label: "Delete",
      icon: <Trash2 size={13} />,
      onClick: onDelete,
      danger: true,
      dividerAbove: true,
    },
  ];
}

export function canvasContextItems({
  onAddComment,
  onFitView,
  onSelectAll,
  onPaste,
  hasPaste,
}: {
  onAddComment: () => void;
  onFitView: () => void;
  onSelectAll: () => void;
  onPaste: () => void;
  hasPaste: boolean;
}): ContextMenuItem[] {
  return [
    {
      label: "Add Comment Here",
      icon: <MessageSquarePlus size={13} />,
      onClick: onAddComment,
    },
    {
      label: "Select All",
      icon: <MousePointer2 size={13} />,
      onClick: onSelectAll,
    },
    {
      label: "Paste",
      icon: <ClipboardPaste size={13} />,
      onClick: onPaste,
      disabled: !hasPaste,
    },
    {
      label: "Fit View",
      icon: <Maximize2 size={13} />,
      onClick: onFitView,
      dividerAbove: true,
    },
  ];
}

export function wireContextItems({
  onDelete,
  onLabel,
}: {
  onDelete: () => void;
  onLabel: () => void;
}): ContextMenuItem[] {
  return [
    {
      label: "Label Net",
      icon: <Tag size={13} />,
      onClick: onLabel,
    },
    {
      label: "Delete Wire",
      icon: <Trash2 size={13} />,
      onClick: onDelete,
      danger: true,
      dividerAbove: true,
    },
  ];
}