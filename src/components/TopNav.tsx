import { Panel } from "@/App";
import {
  CircuitBoard,
  GitBranch,
  Play,
  Code2,
  Settings,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

interface TopNavProps {
  activePanel: Panel;
  setActivePanel: (panel: Panel) => void;
}

const navItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: "circuit", label: "Circuit", icon: <CircuitBoard size={16} /> },
  { id: "logic", label: "Logic", icon: <GitBranch size={16} /> },
  { id: "simulate", label: "Simulate", icon: <Play size={16} /> },
  { id: "code", label: "Code", icon: <Code2 size={16} /> },
];

export default function TopNav({ activePanel, setActivePanel }: TopNavProps) {
  return (
    <header className="h-12 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 rounded p-1">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-white text-sm tracking-wide">
          CircuitFlow
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all duration-150",
              activePanel === item.id
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded transition-all">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}