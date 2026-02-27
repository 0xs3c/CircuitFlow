import { LogicNodeType } from "@/types/logic";
import { useLogicDnD } from "@/context/LogicDnDContext";
import {
  Play, RefreshCw, Timer, Zap,
  BookOpen, Pin, GitBranch, Clock,
  Repeat, RotateCcw, Variable,
  ToggleLeft, Pencil, Radio, Antenna,
} from "lucide-react";

interface PaletteItem {
  nodeType: LogicNodeType;
  label:    string;
  icon:     React.ReactNode;
  accent:   string;
}

const PALETTE_GROUPS: { title: string; items: PaletteItem[] }[] = [
  {
    title: "Triggers",
    items: [
      { nodeType: "on_start",     label: "On Start",     icon: <Play size={12} />,       accent: "#10b981" },
      { nodeType: "on_loop",      label: "On Loop",      icon: <RefreshCw size={12} />,  accent: "#10b981" },
      { nodeType: "on_timer",     label: "On Timer",     icon: <Timer size={12} />,      accent: "#10b981" },
      { nodeType: "on_interrupt", label: "On Interrupt", icon: <Zap size={12} />,        accent: "#10b981" },
    ],
  },
  {
    title: "Inputs",
    items: [
      { nodeType: "read_sensor", label: "Read Sensor", icon: <BookOpen size={12} />, accent: "#3b82f6" },
      { nodeType: "read_pin",    label: "Read Pin",    icon: <Pin size={12} />,      accent: "#3b82f6" },
    ],
  },
  {
    title: "Control Flow",
    items: [
      { nodeType: "condition",  label: "If Condition", icon: <GitBranch size={12} />, accent: "#f59e0b" },
      { nodeType: "wait",       label: "Wait",         icon: <Clock size={12} />,     accent: "#f59e0b" },
      { nodeType: "loop_count", label: "Loop N Times", icon: <Repeat size={12} />,    accent: "#f59e0b" },
      { nodeType: "loop_while", label: "Loop While",   icon: <RotateCcw size={12} />, accent: "#f59e0b" },
    ],
  },
  {
    title: "Variables",
    items: [
      { nodeType: "set_variable", label: "Set Variable", icon: <Variable size={12} />, accent: "#a855f7" },
    ],
  },
  {
    title: "Outputs",
    items: [
      { nodeType: "set_pin",         label: "Set Pin",         icon: <ToggleLeft size={12} />, accent: "#f97316" },
      { nodeType: "write_component", label: "Write Component", icon: <Pencil size={12} />,     accent: "#f97316" },
    ],
  },
  {
    title: "Communication",
    items: [
      { nodeType: "send_uart",    label: "Send UART",    icon: <Radio size={12} />,   accent: "#06b6d4" },
      { nodeType: "receive_uart", label: "Receive UART", icon: <Antenna size={12} />, accent: "#06b6d4" },
    ],
  },
];

export default function LogicPalette() {
  const { setDraggedNodeType, setIsDragging } = useLogicDnD();

  const onMouseDown = (nodeType: LogicNodeType) => {
    setDraggedNodeType(nodeType);
    setIsDragging(true);
  };

  return (
    <aside className="w-52 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 overflow-y-auto">
      <div className="p-3 border-b border-slate-700 shrink-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nodes</p>
      </div>

      <div className="p-2 flex flex-col gap-3">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold px-1 mb-1">
              {group.title}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div
                  key={item.nodeType}
                  onMouseDown={() => onMouseDown(item.nodeType)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 cursor-grab active:cursor-grabbing transition-colors select-none"
                >
                  <span style={{ color: item.accent }}>{item.icon}</span>
                  <span className="text-xs text-slate-300">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}