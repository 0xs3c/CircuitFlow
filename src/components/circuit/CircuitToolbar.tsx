import { useState } from "react";
import {
  Undo2, Redo2, MousePointer2, Hand, MessageSquarePlus,
  Tag, Grid3X3, Magnet, Maximize2, ZoomIn, ZoomOut,
  ShieldCheck, Save, Keyboard, ChevronDown, Loader2,
  CircuitBoard, ChevronRight
} from "lucide-react";
import { clsx } from "clsx";

export type ToolMode = "select" | "pan";

export interface CommentColor {
  label: string;
  bg: string;
  border: string;
  text: string;
  value: string;
}

export const COMMENT_COLORS: CommentColor[] = [
  { label: "Yellow", bg: "bg-yellow-400/20", border: "border-yellow-400/50", text: "text-yellow-200", value: "yellow" },
  { label: "Blue",   bg: "bg-blue-400/20",   border: "border-blue-400/50",   text: "text-blue-200",   value: "blue"   },
  { label: "Green",  bg: "bg-green-400/20",  border: "border-green-400/50",  text: "text-green-200",  value: "green"  },
  { label: "Red",    bg: "bg-red-400/20",    border: "border-red-400/50",    text: "text-red-200",    value: "red"    },
  { label: "Purple", bg: "bg-purple-400/20", border: "border-purple-400/50", text: "text-purple-200", value: "purple" },
];

interface CircuitToolbarProps {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAddComment: (color: string) => void;
  onValidate: () => void;
  onSave: () => void;
  onShowShortcuts: () => void;
  onOpenDashboard: () => void;
  projectName: string;
  saving: boolean;
  validating: boolean;
}

export default function CircuitToolbar({
  toolMode, setToolMode,
  canUndo, canRedo, onUndo, onRedo,
  showGrid, onToggleGrid,
  snapToGrid, onToggleSnap,
  onFitView, onZoomIn, onZoomOut,
  onAddComment,
  onValidate, onSave, onShowShortcuts,
  onOpenDashboard, projectName,
  saving, validating,
}: CircuitToolbarProps) {
  const [commentMenuOpen, setCommentMenuOpen] = useState(false);

  return (
    <div className="h-9 bg-slate-900 border-b border-slate-700/80 flex items-center px-3 gap-1 shrink-0 select-none">

      {/* Project breadcrumb */}
      <button
        onClick={onOpenDashboard}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors mr-1"
        title="Back to projects"
      >
        <CircuitBoard size={13} />
        <span className="text-[11px]">Projects</span>
      </button>
      <ChevronRight size={11} className="text-slate-600 shrink-0" />
      <span className="text-[11px] font-medium text-slate-300 max-w-32 truncate mx-1">
        {projectName}
      </span>

      <Divider />

      {/* Undo / Redo */}
      <ToolGroup>
        <ToolBtn
          icon={<Undo2 size={14} />}
          label="Undo (⌘Z)"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolBtn
          icon={<Redo2 size={14} />}
          label="Redo (⌘⇧Z)"
          onClick={onRedo}
          disabled={!canRedo}
        />
      </ToolGroup>

      <Divider />

      {/* Tool mode */}
      <ToolGroup>
        <ToolBtn
          icon={<MousePointer2 size={14} />}
          label="Select (V)"
          onClick={() => setToolMode("select")}
          active={toolMode === "select"}
        />
        <ToolBtn
          icon={<Hand size={14} />}
          label="Pan (H)"
          onClick={() => setToolMode("pan")}
          active={toolMode === "pan"}
        />
      </ToolGroup>

      <Divider />

      {/* Annotate */}
      <ToolGroup>
        {/* Comment with color picker */}
        <div className="relative">
          <button
            onClick={() => setCommentMenuOpen((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs"
            title="Add Comment"
          >
            <MessageSquarePlus size={14} />
            <span className="text-[11px]">Comment</span>
            <ChevronDown size={10} />
          </button>

          {commentMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setCommentMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 flex flex-col gap-1 min-w-36">
                <p className="text-[10px] text-slate-500 px-1 mb-1 uppercase tracking-wider">Color</p>
                {COMMENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      onAddComment(color.value);
                      setCommentMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                  >
                    <div className={clsx(
                      "w-3 h-3 rounded-sm border",
                      color.bg, color.border
                    )} />
                    <span className="text-xs text-slate-300">{color.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <ToolBtn
          icon={<Tag size={14} />}
          label="Wire Label (L)"
          onClick={() => {}}
        />
      </ToolGroup>

      <Divider />

      {/* View */}
      <ToolGroup>
        <ToolBtn
          icon={<Grid3X3 size={14} />}
          label="Toggle Grid (G)"
          onClick={onToggleGrid}
          active={showGrid}
        />
        <ToolBtn
          icon={<Magnet size={14} />}
          label="Toggle Snap (S)"
          onClick={onToggleSnap}
          active={snapToGrid}
        />
        <ToolBtn
          icon={<Maximize2 size={14} />}
          label="Fit View (F)"
          onClick={onFitView}
        />
        <ToolBtn
          icon={<ZoomIn size={14} />}
          label="Zoom In (=)"
          onClick={onZoomIn}
        />
        <ToolBtn
          icon={<ZoomOut size={14} />}
          label="Zoom Out (-)"
          onClick={onZoomOut}
        />
      </ToolGroup>

      <Divider />

      {/* Validate */}
      <ToolGroup>
        <button
          onClick={onValidate}
          disabled={validating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          title="Validate Circuit (⌘E)"
        >
          {validating
            ? <Loader2 size={13} className="animate-spin" />
            : <ShieldCheck size={13} />
          }
          <span className="text-[11px]">Validate</span>
        </button>
      </ToolGroup>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Shortcuts */}
      <ToolBtn
        icon={<Keyboard size={14} />}
        label="Keyboard Shortcuts (?)"
        onClick={onShowShortcuts}
      />

      <Divider />

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 ml-1"
        title="Save Project (⌘S)"
      >
        {saving
          ? <Loader2 size={13} className="animate-spin" />
          : <Save size={13} />
        }
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-700 mx-1.5 shrink-0" />;
}

function ToolBtn({
  icon, label, onClick, active, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        "p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-blue-600/30 text-blue-400"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      )}
    >
      {icon}
    </button>
  );
}