import { useState, useRef, useEffect } from "react";
import { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { clsx } from "clsx";

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; header: string }> = {
  yellow: { bg: "bg-yellow-950/80",  border: "border-yellow-500/40", text: "text-yellow-100", header: "bg-yellow-500/20" },
  blue:   { bg: "bg-blue-950/80",    border: "border-blue-500/40",   text: "text-blue-100",   header: "bg-blue-500/20"   },
  green:  { bg: "bg-green-950/80",   border: "border-green-500/40",  text: "text-green-100",  header: "bg-green-500/20"  },
  red:    { bg: "bg-red-950/80",     border: "border-red-500/40",    text: "text-red-100",    header: "bg-red-500/20"    },
  purple: { bg: "bg-purple-950/80",  border: "border-purple-500/40", text: "text-purple-100", header: "bg-purple-500/20" },
};

export default function CommentNode({ data, selected, id }: NodeProps) {
  const color = (data.color as string) || "yellow";
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES.yellow;
  const [text, setText] = useState((data.text as string) || "");
  const [editing, setEditing] = useState(!(data.text as string));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) (data.onDelete as (id: string) => void)(id);
  };

  return (
    <div
      className={clsx(
        "rounded-lg border-2 shadow-xl min-w-40 max-w-64 transition-all",
        styles.bg, styles.border,
        selected ? "ring-2 ring-white/20" : ""
      )}
      onDoubleClick={() => setEditing(true)}
    >
      {/* Header */}
      <div className={clsx(
        "flex items-center justify-between px-2 py-1 rounded-t-md",
        styles.header
      )}>
        <span className={clsx("text-[10px] font-semibold uppercase tracking-wider opacity-60", styles.text)}>
          Comment
        </span>
        <button
          onClick={onDelete}
          className={clsx("opacity-40 hover:opacity-100 transition-opacity", styles.text)}
        >
          <X size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="p-2">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (data.onTextChange) {
                (data.onTextChange as (id: string, text: string) => void)(id, text);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Type your comment..."
            rows={3}
            className={clsx(
              "w-full bg-transparent resize-none text-xs leading-relaxed focus:outline-none placeholder-current opacity-50",
              styles.text
            )}
          />
        ) : (
          <p
            className={clsx(
              "text-xs leading-relaxed whitespace-pre-wrap min-h-8 cursor-text",
              styles.text,
              !text && "opacity-40 italic"
            )}
            onClick={() => setEditing(true)}
          >
            {text || "Double-click to edit..."}
          </p>
        )}
      </div>

      {/* Resize hint */}
      <div className={clsx("text-[9px] text-right px-2 pb-1 opacity-20", styles.text)}>
        double-click to edit
      </div>
    </div>
  );
}