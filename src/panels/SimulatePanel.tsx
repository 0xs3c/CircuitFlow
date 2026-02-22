import { Play, RotateCcw, AlertTriangle } from "lucide-react";

export default function SimulatePanel() {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-2 px-4">
        <button className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded transition-colors">
          <Play size={14} />
          Run Simulation
        </button>
        <button className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors">
          <RotateCcw size={14} />
          Reset
        </button>
        <div className="ml-4 flex items-center gap-1 text-xs text-yellow-400">
          <AlertTriangle size={12} />
          No circuit loaded
        </div>
      </div>

      {/* Main simulation area */}
      <div className="flex-1 flex">
        {/* Viewport */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Play size={48} />
            <p className="text-sm">Build your circuit and logic first, then simulate</p>
          </div>
        </div>

        {/* Telemetry Panel */}
        <aside className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Telemetry
            </h2>
          </div>
          <div className="flex-1 p-3 flex flex-col gap-3">
            {[
              { label: "Altitude", value: "0.00 m" },
              { label: "Pitch", value: "0.00°" },
              { label: "Roll", value: "0.00°" },
              { label: "Yaw", value: "0.00°" },
              { label: "Motor 1", value: "0 RPM" },
              { label: "Motor 2", value: "0 RPM" },
              { label: "Motor 3", value: "0 RPM" },
              { label: "Motor 4", value: "0 RPM" },
              { label: "Battery", value: "0.00 V" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className="text-xs font-mono text-emerald-400">{item.value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}