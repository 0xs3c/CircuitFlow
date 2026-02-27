import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Node,
  Edge,
  Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "@/store/projectStore";
import { saveLogicFlows } from "@/lib/projectService";
import { extractHardwareMap } from "@/lib/hardwareMap";
import { HardwareMap, McuHardware, LogicFlow, LogicNodeType, LogicNodeData } from "@/types/logic";
import { Cpu, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import LogicNode from "@/components/logic/LogicNode";
import LogicPalette from "@/components/logic/LogicPalette";
import { LogicDnDProvider, useLogicDnD } from "@/context/LogicDnDContext";

const nodeTypes = { logicNode: LogicNode };

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
  style: { stroke: "#475569", strokeWidth: 2 },
};

const DEFAULT_NODE_DATA: Record<LogicNodeType, Partial<LogicNodeData>> = {
  on_start:        { nodeType: "on_start" },
  on_loop:         { nodeType: "on_loop" },
  on_timer:        { nodeType: "on_timer",        intervalMs: 1000 },
  on_interrupt:    { nodeType: "on_interrupt",     mcuPinId: "", mcuPinName: "", trigger: "rising" },
  read_sensor:     { nodeType: "read_sensor",      componentNodeId: "", componentName: "", readProperty: "", outputVariable: "value" },
  read_pin:        { nodeType: "read_pin",         mcuPinId: "", mcuPinName: "", outputVariable: "pin_state" },
  condition:       { nodeType: "condition",        variableName: "", operator: ">", compareValue: "0" },
  wait:            { nodeType: "wait",             durationMs: 1000 },
  loop_count:      { nodeType: "loop_count",       count: 10 },
  loop_while:      { nodeType: "loop_while",       variableName: "", operator: ">", compareValue: "0" },
  set_variable:    { nodeType: "set_variable",     variableName: "my_var", valueSource: "literal", rawValue: "0" },
  set_pin:         { nodeType: "set_pin",          mcuPinId: "", mcuPinName: "", state: "HIGH" },
  write_component: { nodeType: "write_component",  componentNodeId: "", componentName: "", action: "", valueSource: "literal", rawValue: "0" },
  send_uart:       { nodeType: "send_uart",        txPinId: "", txPinName: "", targetMcuNodeId: null, dataTemplate: "" },
  receive_uart:    { nodeType: "receive_uart",     rxPinId: "", rxPinName: "", outputVariable: "received" },
};

interface McuFlowCanvasProps {
  mcu:          McuHardware;
  flow:         LogicFlow;
  onFlowChange: (mcuNodeId: string, nodes: Node[], edges: Edge[]) => void;
}

function McuFlowCanvas({ mcu, flow, onFlowChange }: McuFlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const { screenToFlowPosition }         = useReactFlow();
  const canvasRef                        = useRef<HTMLDivElement>(null);
  const { isDragging, draggedNodeType, setIsDragging, setDraggedNodeType } = useLogicDnD();

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [mcu.circuitNodeId]);

  const notify = useCallback(
    (n: Node[], e: Edge[]) => onFlowChange(mcu.circuitNodeId, n, e),
    [mcu.circuitNodeId, onFlowChange]
  );

  // Same pattern as CircuitPanel — mouseup on window, check bounds
  useEffect(() => {
    if (!isDragging) return;

    const onMouseUp = (e: MouseEvent) => {
      if (!draggedNodeType || !canvasRef.current) {
        setIsDragging(false);
        setDraggedNodeType(null);
        return;
      }

      const bounds = canvasRef.current.getBoundingClientRect();
      const over =
        e.clientX >= bounds.left && e.clientX <= bounds.right &&
        e.clientY >= bounds.top  && e.clientY <= bounds.bottom;

      if (over) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const newNode: Node = {
          id:       `${draggedNodeType}-${Date.now()}`,
          type:     "logicNode",
          position,
          data:     { ...DEFAULT_NODE_DATA[draggedNodeType] } as unknown as LogicNodeData,
        };
        setNodes((nds) => {
          const next = [...nds, newNode];
          notify(next, edges);
          return next;
        });
      }

      setIsDragging(false);
      setDraggedNodeType(null);
    };

    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [isDragging, draggedNodeType, edges, screenToFlowPosition, notify, setIsDragging, setDraggedNodeType]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const isYes = connection.sourceHandle === "yes";
      const isNo  = connection.sourceHandle === "no";
      const edgeStyle = isYes
        ? { stroke: "#10b981", strokeWidth: 2 }
        : isNo
        ? { stroke: "#ef4444", strokeWidth: 2 }
        : { stroke: "#475569", strokeWidth: 2 };

      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
            style: edgeStyle,
          },
          eds
        );
        notify(nodes, next);
        return next;
      });
    },
    [nodes, notify]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      notify(nodes, edges);
    },
    [nodes, edges, notify]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      notify(nodes, edges);
    },
    [nodes, edges, notify]
  );

  return (
    <div ref={canvasRef} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        defaultEdgeOptions={defaultEdgeOptions}
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
        mcuNodeId: mcu.circuitNodeId,
        mcuName:   mcu.name,
        nodes:     [],
        edges:     [],
        variables: [],
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
      setFlows((prev) => {
        const updated = prev.map((f) =>
          f.mcuNodeId === mcuNodeId ? { ...f, nodes, edges } : f
        );
        updateLogicFlows(updated);
        if (currentProject) {
          setSaving(true);
          saveLogicFlows(currentProject.id, updated).finally(() => setSaving(false));
        }
        return updated;
      });
    },
    [currentProject, updateLogicFlows]
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
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-1 px-3 shrink-0">
        <span className="text-xs text-slate-500 mr-2">MCU:</span>
        {hardwareMap.mcus.map((mcu) => (
          <button
            key={mcu.circuitNodeId}
            onClick={() => setActiveMcuId(mcu.circuitNodeId)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all",
              activeMcuId === mcu.circuitNodeId
                ? "bg-blue-600 text-white border-blue-600"
                : "border-blue-500 text-blue-400 hover:bg-blue-950"
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

      <div className="flex-1 flex overflow-hidden">
        <LogicPalette />

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

        <aside className="w-60 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
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
                <p className="text-xs text-slate-600 text-center">
                  Select a node to configure it
                </p>
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
    <LogicDnDProvider>
      <ReactFlowProvider>
        <LogicPanelInner />
      </ReactFlowProvider>
    </LogicDnDProvider>
  );
}