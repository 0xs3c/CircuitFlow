import { Panel } from "@/App";
import {
  CircuitBoard,
  GitBranch,
  Play,
  Code2,
  Settings,
  Zap,
  LogOut,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";

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
  const { user, signOut } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-12 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 relative">
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

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
              <User size={12} className="text-white" />
            </div>
            <span className="text-xs text-slate-300 max-w-24 truncate">
              {user?.email}
            </span>
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 top-10 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-48 py-1">
                <div className="px-3 py-2 border-b border-slate-700">
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { signOut(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}