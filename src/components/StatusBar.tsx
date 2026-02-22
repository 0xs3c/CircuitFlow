import { Panel } from "@/App";
import { Circle } from "lucide-react";

interface StatusBarProps {
  activePanel: Panel;
}

const panelDescriptions: Record<Panel, string> = {
  circuit: "Circuit Designer",
  logic: "Logic Flowchart Editor",
  simulate: "Flight Simulator",
  code: "Generated Code Preview",
};

export default function StatusBar({ activePanel }: StatusBarProps) {
  return (
    <footer className="h-7 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Circle size={8} className="fill-emerald-400 text-emerald-400" />
          Ready
        </span>
        <span>Project: Untitled</span>
        <span>Chip: Not selected</span>
      </div>
      <div className="text-xs text-slate-500">
        {panelDescriptions[activePanel]}
      </div>
    </footer>
  );
}