import { Copy, Download, Code2 } from "lucide-react";

export default function CodePanel() {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Target:</span>
          <select className="bg-slate-800 text-slate-300 text-xs border border-slate-600 rounded px-2 py-1">
            <option>STM32F4</option>
            <option>ESP32</option>
            <option>Arduino</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors">
            <Copy size={12} />
            Copy
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
            <Download size={12} />
            Export .c
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Code2 size={48} />
          <p className="text-sm">Generated firmware code will appear here</p>
          <p className="text-xs text-slate-700">Complete your circuit and logic design first</p>
        </div>
      </div>
    </div>
  );
}