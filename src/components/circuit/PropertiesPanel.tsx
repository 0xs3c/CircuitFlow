import { useCircuitStore } from "@/store/circuitStore";
import { useReactFlow } from "@xyflow/react";
import { PlacedComponent, Pin } from "@/types/circuit";
import { X, Trash2 } from "lucide-react";
import { clsx } from "clsx";

const pinTypeLabel: Record<Pin["type"], string> = {
  power_in:      "PWR IN",
  power_out:     "PWR OUT",
  input:         "IN",
  output:        "OUT",
  bidirectional: "I/O",
  passive:       "PASS",
};

const pinTypeColor: Record<Pin["type"], string> = {
  power_in:      "text-red-400 bg-red-400/10",
  power_out:     "text-orange-400 bg-orange-400/10",
  input:         "text-blue-400 bg-blue-400/10",
  output:        "text-green-400 bg-green-400/10",
  bidirectional: "text-purple-400 bg-purple-400/10",
  passive:       "text-slate-400 bg-slate-400/10",
};

export default function PropertiesPanel() {
  const { selectedInstanceId, selectComponent } = useCircuitStore();
  const { getNode, setNodes, setEdges } = useReactFlow();

  // Read selected component directly from ReactFlow nodes
  const selectedNode = selectedInstanceId ? getNode(selectedInstanceId) : null;
  const selected = selectedNode?.data?.component as PlacedComponent | undefined;

  const handleRemove = () => {
    if (!selectedInstanceId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedInstanceId));
    setEdges((eds) => eds.filter(
      (e) => e.source !== selectedInstanceId && e.target !== selectedInstanceId
    ));
    selectComponent(null);
  };

  if (!selected) {
    return (
      <aside className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Properties
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-600 text-center px-4">
            Select a component to view its properties
          </p>
        </div>
      </aside>
    );
  }

  const { definition } = selected;

  return (
    <aside className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">

      {/* Header */}
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Properties
        </h2>
        <button
          onClick={() => selectComponent(null)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Component info */}
        <div className="p-3 border-b border-slate-700">
          <div className="font-semibold text-sm text-slate-200 leading-tight">
            {definition.name}
          </div>
          {definition.manufacturer && (
            <div className="text-xs text-slate-500 mt-0.5">
              {definition.manufacturer}
            </div>
          )}
          <div className="inline-flex items-center mt-2 px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
            {definition.category}
          </div>
          {definition.description && (
            <div className="text-xs text-slate-400 mt-2 leading-relaxed">
              {definition.description}
            </div>
          )}
          {definition.tags && definition.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {definition.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-slate-800 text-slate-500 text-[10px] rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pins */}
        <div className="p-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pins ({definition.pins.length})
          </div>
          <div className="flex flex-col gap-1">
            {definition.pins.map((pin) => (
              <div key={pin.id} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-300 truncate">
                  {pin.name}
                </span>
                <span className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                  pinTypeColor[pin.type]
                )}>
                  {pinTypeLabel[pin.type]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleRemove}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-900/50 transition-colors"
        >
          <Trash2 size={12} />
          Remove Component
        </button>
      </div>
    </aside>
  );
}