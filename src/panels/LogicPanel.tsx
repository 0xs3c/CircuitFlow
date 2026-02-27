import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "@/store/projectStore";
import { saveLogicFlows } from "@/lib/projectService";
import { extractHardwareMap } from "@/lib/hardwareMap";
import { HardwareMap, McuHardware, LogicFlow } from "@/types/logic";
import { Cpu, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";

const MCU_ACCENT: Record<string, string> = {
  default:  "border-blue-500 text-blue-400",
  active:   "bg-blue-600 text-white border-blue-600",
};

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Cpu size={48} />
        <p className="text-sm">Drag nodes from the left panel to build your firmware flow</p>
      </div>
    </div>
  );
}

interface McuFlowCanvasProps {
  mcu: McuHardware;
  flow: LogicFlow;
  onFlowChange: (mcuNodeId: string, nodes: Node[], edges: Edge[]) => void;
}

function McuFlowCanvas({ mcu, flow, onFlowChange }: McuFlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [mcu.circuitNodeId]);

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      onFlowChange(mcu.circuitNodeId, nodes, edges);
    },
    [nodes, edges, mcu.circuitNodeId]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      onFlowChange(mcu.circuitNodeId, nodes, edges);
    },
    [nodes, edges, mcu.circuitNodeId]
  );

  return (
    <div className="relative w-full h-full">
      {nodes.length === 0 && <EmptyCanvas />}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={24} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function LogicPanelInner() {
  const { currentProject, updateLogicFlows } = useProjectStore();
  const [hardwareMap, setHardwareMap]         = useState<HardwareMap>({ mcus: [] });
  const [activeMcuId, setActiveMcuId]         = useState<string | null>(null);
  const [flows, setFlows]                     = useState<LogicFlow[]>([]);
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    if (!currentProject) return;

    const map = extractHardwareMap(
      currentProject.canvas_nodes,
      currentProject.canvas_edges
    );
    setHardwareMap(map);

    if (map.mcus.length === 0) return;

    const existingFlows = currentProject.logic_flows ?? [];

    const merged: LogicFlow[] = map.mcus.map((mcu) => {
      const existing = existingFlows.find((f) => f.mcuNodeId === mcu.circuitNodeId);
      return existing ?? {
        mcuNodeId:  mcu.circuitNodeId,
        mcuName:    mcu.name,
        nodes:      [],
        edges:      [],
        variables:  [],
      };
    });

    setFlows(merged);
    setActiveMcuId((prev) =>
      prev && map.mcus.find((m) => m.circuitNodeId === prev)
        ? prev
        : map.mcus[0].circuitNodeId
    );
  }, [currentProject?.canvas_nodes, currentProject?.canvas_edges]);

  const handleFlowChange = useCallback(
    async (mcuNodeId: string, nodes: Node[], edges: Edge[]) => {
      const updated = flows.map((f) =>
        f.mcuNodeId === mcuNodeId ? { ...f, nodes, edges } : f
      );
      setFlows(updated);
      updateLogicFlows(updated);

      if (!currentProject) return;
      setSaving(true);
      try {
        await saveLogicFlows(currentProject.id, updated);
      } finally {
        setSaving(false);
      }
    },
    [flows, currentProject, updateLogicFlows]
  );

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-sm">
        No project open
      </div>
    );
  }

  if (hardwareMap.mcus.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <AlertTriangle size={40} />
          <p className="text-sm">No MCUs found in the circuit</p>
          <p className="text-xs text-slate-600">Add an MCU in the Circuit tab first</p>
        </div>
      </div>
    );
  }

  const activeMcu  = hardwareMap.mcus.find((m) => m.circuitNodeId === activeMcuId);
  const activeFlow = flows.find((f) => f.mcuNodeId === activeMcuId);

  return (
    <div className="h-full flex flex-col">
      {/* MCU tab bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-1 px-3 shrink-0">
        <span className="text-xs text-slate-500 mr-2">MCU:</span>
        {hardwareMap.mcus.map((mcu) => (
          <button
            key={mcu.circuitNodeId}
            onClick={() => setActiveMcuId(mcu.circuitNodeId)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all",
              activeMcuId === mcu.circuitNodeId
                ? MCU_ACCENT.active
                : MCU_ACCENT.default
            )}
          >
            <Cpu size={11} />
            {mcu.instanceLabel}
          </button>
        ))}
        {saving && (
          <span className="ml-auto text-xs text-slate-500 animate-pulse">Saving…</span>
        )}
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left palette */}
        <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nodes</p>
          </div>
          <div className="flex-1 p-3 flex items-center justify-center">
            <p className="text-xs text-slate-600 text-center">Coming next step</p>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden">
          {activeMcu && activeFlow && (
            <McuFlowCanvas
              key={activeMcu.circuitNodeId}
              mcu={activeMcu}
              flow={activeFlow}
              onFlowChange={handleFlowChange}
            />
          )}
        </div>

        {/* Right config sidebar */}
        <aside className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {activeMcu
                ? `${activeMcu.wiredComponents.length} component${activeMcu.wiredComponents.length !== 1 ? "s" : ""} wired`
                : "Configuration"}
            </p>
          </div>
          <div className="flex-1 p-3">
            {activeMcu && activeMcu.wiredComponents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {activeMcu.wiredComponents.map((c) => (
                  <div
                    key={c.circuitNodeId}
                    className="px-2.5 py-2 bg-slate-800 rounded border border-slate-700"
                  >
                    <p className="text-xs font-medium text-slate-300">{c.instanceLabel}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {c.protocols.join(", ")} · {c.category}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-slate-600 text-center">Select a node to configure it</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LogicPanel() {
  return (
    <ReactFlowProvider>
      <LogicPanelInner />
    </ReactFlowProvider>
  );
}