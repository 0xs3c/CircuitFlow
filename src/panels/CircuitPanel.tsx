import { CircuitBoard } from "lucide-react";

export default function CircuitPanel() {
  return (
    <div className="h-full flex">
      {/* Left Sidebar - Component Library */}
      <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Components
          </h2>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-2">
          {["MCU", "ESC", "IMU / Gyroscope", "GPS Module", "Power Module", "RC Receiver", "Barometer", "Battery", "LED", "Buzzer"].map((comp) => (
            <div
              key={comp}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 cursor-grab transition-colors border border-slate-700 hover:border-blue-500"
            >
              {comp}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 bg-slate-950 relative flex items-center justify-center">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #475569 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
        {/* Empty state */}
        <div className="relative flex flex-col items-center gap-3 text-slate-600">
          <CircuitBoard size={48} />
          <p className="text-sm">Drag components from the left panel to start designing</p>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <aside className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Properties
          </h2>
        </div>
        <div className="flex-1 p-3 flex items-center justify-center">
          <p className="text-xs text-slate-600 text-center">
            Select a component to view its properties
          </p>
        </div>
      </aside>
    </div>
  );
}