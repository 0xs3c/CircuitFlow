import { X, AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronRight } from "lucide-react";
import { ValidationResult, ValidationIssue, IssueSeverity } from "@/lib/validateCircuit";
import { clsx } from "clsx";

interface ValidationPanelProps {
  result: ValidationResult;
  onClose: () => void;
  onHighlightNode: (nodeId: string) => void;
}

const severityConfig: Record<IssueSeverity, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  badge: string;
}> = {
  error: {
    icon: <AlertCircle size={13} />,
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-800/50",
    badge: "bg-red-900/40 text-red-300",
  },
  warning: {
    icon: <AlertTriangle size={13} />,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-800/50",
    badge: "bg-yellow-900/40 text-yellow-300",
  },
  info: {
    icon: <Info size={13} />,
    color: "text-blue-400",
    bg: "bg-blue-900/10",
    border: "border-blue-800/30",
    badge: "bg-blue-900/40 text-blue-300",
  },
};

function IssueRow({
  issue,
  onHighlight,
}: {
  issue: ValidationIssue;
  onHighlight: () => void;
}) {
  const cfg = severityConfig[issue.severity];
  const clickable = !!issue.nodeId || !!issue.edgeId;

  return (
    <div
      onClick={clickable ? onHighlight : undefined}
      className={clsx(
        "flex items-start gap-2.5 px-4 py-2.5 border-b border-slate-800/50 transition-colors",
        clickable ? "cursor-pointer hover:bg-slate-800/50" : "",
        "last:border-b-0"
      )}
    >
      <span className={clsx("mt-0.5 shrink-0", cfg.color)}>
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={clsx("text-xs font-medium", cfg.color)}>
          {issue.title}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          {issue.detail}
        </p>
      </div>
      {clickable && (
        <ChevronRight size={12} className="text-slate-600 mt-0.5 shrink-0" />
      )}
    </div>
  );
}

export default function ValidationPanel({
  result,
  onClose,
  onHighlightNode,
}: ValidationPanelProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col max-h-72">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          {result.passed ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={14} />
              <span className="text-xs font-semibold">All checks passed</span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-300">
              Validation Results
            </span>
          )}

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {result.errorCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-300">
                {result.errorCount} error{result.errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {result.warningCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/40 text-yellow-300">
                {result.warningCount} warning{result.warningCount !== 1 ? "s" : ""}
              </span>
            )}
            {result.infoCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300">
                {result.infoCount} info
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800"
        >
          <X size={14} />
        </button>
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {/* Errors first */}
        {result.issues
          .sort((a, b) => {
            const order = { error: 0, warning: 1, info: 2 };
            return order[a.severity] - order[b.severity];
          })
          .map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onHighlight={() => {
                if (issue.nodeId) onHighlightNode(issue.nodeId);
              }}
            />
          ))}
      </div>
    </div>
  );
}