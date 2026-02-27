import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { LogicNodeData, LogicNodeType } from "@/types/logic";
import {
  Play, RefreshCw, Timer, Zap,
  BookOpen, Pin, GitBranch, Clock,
  Repeat, RotateCcw, Variable,
  ToggleLeft, Pencil, Radio, Antenna,
} from "lucide-react";

const NODE_META: Record<LogicNodeType, {
  label:  string;
  icon:   React.ReactNode;
  accent: string;
  group:  "trigger" | "input" | "flow" | "variable" | "output" | "comms";
}> = {
  on_start:        { label: "On Start",        icon: <Play size={13} />,       accent: "#10b981", group: "trigger"  },
  on_loop:         { label: "On Loop",          icon: <RefreshCw size={13} />,  accent: "#10b981", group: "trigger"  },
  on_timer:        { label: "On Timer",         icon: <Timer size={13} />,      accent: "#10b981", group: "trigger"  },
  on_interrupt:    { label: "On Interrupt",     icon: <Zap size={13} />,        accent: "#10b981", group: "trigger"  },
  read_sensor:     { label: "Read Sensor",      icon: <BookOpen size={13} />,   accent: "#3b82f6", group: "input"    },
  read_pin:        { label: "Read Pin",         icon: <Pin size={13} />,        accent: "#3b82f6", group: "input"    },
  condition:       { label: "If Condition",     icon: <GitBranch size={13} />,  accent: "#f59e0b", group: "flow"     },
  wait:            { label: "Wait",             icon: <Clock size={13} />,      accent: "#f59e0b", group: "flow"     },
  loop_count:      { label: "Loop N Times",     icon: <Repeat size={13} />,     accent: "#f59e0b", group: "flow"     },
  loop_while:      { label: "Loop While",       icon: <RotateCcw size={13} />,  accent: "#f59e0b", group: "flow"     },
  set_variable:    { label: "Set Variable",     icon: <Variable size={13} />,   accent: "#a855f7", group: "variable" },
  set_pin:         { label: "Set Pin",          icon: <ToggleLeft size={13} />, accent: "#f97316", group: "output"   },
  write_component: { label: "Write Component",  icon: <Pencil size={13} />,     accent: "#f97316", group: "output"   },
  send_uart:       { label: "Send UART",        icon: <Radio size={13} />,      accent: "#06b6d4", group: "comms"    },
  receive_uart:    { label: "Receive UART",     icon: <Antenna size={13} />,    accent: "#06b6d4", group: "comms"    },
};

const TRIGGER_TYPES = new Set<LogicNodeType>(["on_start", "on_loop", "on_timer", "on_interrupt"]);

function summary(data: LogicNodeData): string {
  switch (data.nodeType) {
    case "on_timer":        return `Every ${data.intervalMs}ms`;
    case "on_interrupt":    return `${data.mcuPinName || "—"} · ${data.trigger}`;
    case "read_sensor":     return data.componentName ? `${data.componentName} → ${data.outputVariable}` : "Not configured";
    case "read_pin":        return data.mcuPinName    ? `${data.mcuPinName} → ${data.outputVariable}`    : "Not configured";
    case "condition":       return data.variableName  ? `${data.variableName} ${data.operator} ${data.compareValue}` : "Not configured";
    case "wait":            return `${data.durationMs}ms`;
    case "loop_count":      return `${data.count} times`;
    case "loop_while":      return data.variableName  ? `${data.variableName} ${data.operator} ${data.compareValue}` : "Not configured";
    case "set_variable":    return `${data.variableName} = ${data.rawValue}`;
    case "set_pin":         return data.mcuPinName    ? `${data.mcuPinName} → ${data.state}` : "Not configured";
    case "write_component": return data.componentName ? `${data.componentName} · ${data.action || "—"}` : "Not configured";
    case "send_uart":       return data.txPinName     ? `TX ${data.txPinName}` : "Not configured";
    case "receive_uart":    return data.rxPinName     ? `RX ${data.rxPinName} → ${data.outputVariable}` : "Not configured";
    default:                return "";
  }
}

export default memo(function LogicNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as LogicNodeData;
  const meta     = NODE_META[nodeData.nodeType];
  const isTrigger = TRIGGER_TYPES.has(nodeData.nodeType);
  const isCondition = nodeData.nodeType === "condition";
  const sub = summary(nodeData);

  return (
    <div
      style={{ borderColor: selected ? meta.accent : "#334155" }}
      className="min-w-[180px] rounded-lg bg-slate-800 border-2 shadow-xl select-none overflow-hidden"
    >
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.accent }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span style={{ color: meta.accent }}>{meta.icon}</span>
        <span className="text-xs font-semibold text-slate-200">
          {nodeData.label || meta.label}
        </span>
      </div>

      {/* Summary */}
      {sub && (
        <div className="px-3 pb-2.5">
          <span className="text-[10px] text-slate-400 font-mono">{sub}</span>
        </div>
      )}

      {!sub && <div className="pb-2" />}

      {/* Handles */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          style={{ background: "#64748b", width: 10, height: 10, border: "2px solid #0f172a" }}
        />
      )}

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ background: "#10b981", width: 10, height: 10, border: "2px solid #0f172a", left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ background: "#ef4444", width: 10, height: 10, border: "2px solid #0f172a", left: "70%" }}
          />
          <div className="flex justify-between px-4 pb-1.5">
            <span className="text-[9px] text-emerald-400 font-semibold">YES</span>
            <span className="text-[9px] text-red-400 font-semibold">NO</span>
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          style={{ background: "#64748b", width: 10, height: 10, border: "2px solid #0f172a" }}
        />
      )}
    </div>
  );
});