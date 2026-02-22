import { Panel } from "@/App";
import { useProjectStore } from "@/store/projectStore";
import { Circle } from "lucide-react";

interface StatusBarProps {
  activePanel: Panel;
}

const panelDescriptions: Record<Panel, string> = {
  circuit:  "Circuit Designer",
  logic:    "Logic Flowchart Editor",
  simulate: "Flight Simulator",
  code:     "Generated Code Preview",
};

export default function StatusBar({ activePanel }: StatusBarProps) {
  const { currentProject } = useProjectStore();

  const projectName = currentProject?.name ?? "No project open";
  const nodeCount   = (currentProject?.canvas_nodes ?? []).length;

  return (
    <footer className="h-7 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Circle size={8} className="fill-emerald-400 text-emerald-400" />
          Ready
        </span>
        <span>Project: {projectName}</span>
        <span>{nodeCount} component{nodeCount !== 1 ? "s" : ""}</span>
      </div>
      <div className="text-xs text-slate-500">
        {panelDescriptions[activePanel]}
      </div>
    </footer>
  );
}