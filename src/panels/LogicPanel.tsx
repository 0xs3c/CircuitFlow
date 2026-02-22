import { GitBranch } from "lucide-react";

export default function LogicPanel() {
  return (
    <div className="h-full flex">
      {/* Left Sidebar - Logic Blocks */}
      <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Logic Blocks
          </h2>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-2">
          {[
            { label: "Start", color: "border-emerald-500 text-emerald-400" },
            { label: "Read Sensor", color: "border-blue-500 text-blue-400" },
            { label: "Condition (If)", color: "border-yellow-500 text-yellow-400" },
            { label: "Set Variable", color: "border-purple-500 text-purple-400" },
            { label: "Control Motor", color: "border-orange-500 text-orange-400" },
            { label: "Wait / Delay", color: "border-slate-500 text-slate-400" },
            { label: "Loop", color: "border-pink-500 text-pink-400" },
            { label: "Send Signal", color: "border-cyan-500 text-cyan-400" },
            { label: "End", color: "border-red-500 text-red-400" },
          ].map((block) => (
            <div
              key={block.label}
              className={`px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm cursor-grab transition-colors border ${block.color}`}
            >
              {block.label}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 bg-slate-950 relative flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #475569 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex flex-col items-center gap-3 text-slate-600">
          <GitBranch size={48} />
          <p className="text-sm">Drag logic blocks to build your firmware flow</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Block Settings
          </h2>
        </div>
        <div className="flex-1 p-3 flex items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Select a block to configure it
          </p>
        </div>
      </aside>
    </div>
  );
}