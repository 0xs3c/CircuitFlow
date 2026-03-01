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
import {
  HardwareMap,
  McuHardware,
  LogicFlow,
  LogicNodeType,
  LogicNodeData,
  ReadSensorNodeData,
  ReadPinNodeData,
  ConditionNodeData,
  WaitNodeData,
  LoopCountNodeData,
  LoopWhileNodeData,
  SetVariableNodeData,
  SetPinNodeData,
  WriteComponentNodeData,
  SendUartNodeData,
  ReceiveUartNodeData,
  OnTimerNodeData,
  OnInterruptNodeData,
} from "@/types/logic";
import { PlacedComponent, Pin } from "@/types/circuit";
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

const NODE_TYPE_LABELS: Record<LogicNodeType, string> = {
  on_start:        "On Start",
  on_loop:         "On Loop",
  on_timer:        "On Timer",
  on_interrupt:    "On Interrupt",
  read_sensor:     "Read Sensor",
  read_pin:        "Read Pin",
  condition:       "If Condition",
  wait:            "Wait",
  loop_count:      "Loop N Times",
  loop_while:      "Loop While",
  set_variable:    "Set Variable",
  set_pin:         "Set Pin",
  write_component: "Write Component",
  send_uart:       "Send UART",
  receive_uart:    "Receive UART",
};

const SENSOR_PROPERTIES: Record<string, string[]> = {
  Sensors:       ["temperature", "humidity", "pressure", "distance", "light_level", "raw_value"],
  GPS:           ["latitude", "longitude", "altitude", "speed", "heading", "satellites"],
  Communication: ["received_data", "bytes_available"],
  ESC:           ["rpm_feedback", "current", "voltage"],
  Power:         ["voltage", "current", "power"],
};

const COMPONENT_ACTIONS: Record<string, string[]> = {
  ESC:           ["set_throttle", "arm", "disarm"],
  Communication: ["send", "flush", "write"],
  Power:         ["enable", "disable", "set_voltage"],
  Sensors:       ["reset", "calibrate", "start"],
};

function getSensorProperties(category: string): string[] {
  return SENSOR_PROPERTIES[category] ?? ["value", "raw_value"];
}

function getComponentActions(category: string): string[] {
  return COMPONENT_ACTIONS[category] ?? ["write", "set_value", "enable", "disable"];
}

function getMcuGpioPins(mcu: McuHardware, canvasNodes: Node[]): Pin[] {
  const mcuNode = canvasNodes.find((n) => n.id === mcu.circuitNodeId);
  const comp    = mcuNode?.data?.component as PlacedComponent | undefined;
  return (
    comp?.definition.pins.filter(
      (p) => p.type === "bidirectional" || p.type === "input" || p.type === "output"
    ) ?? []
  );
}

function getFlowVariables(flow: LogicFlow): string[] {
  const vars = new Set<string>();
  for (const node of flow.nodes) {
    const d = node.data as unknown as LogicNodeData;
    if (!d?.nodeType) continue;
    if (
      (d.nodeType === "read_sensor" || d.nodeType === "read_pin" || d.nodeType === "receive_uart") &&
      (d as any).outputVariable
    ) {
      vars.add((d as any).outputVariable);
    }
    if (d.nodeType === "set_variable" && d.variableName) {
      vars.add(d.variableName);
    }
  }
  return [...vars].filter(Boolean);
}

const inputCls =
  "w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40";
const labelCls =
  "block text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

function ConfigNoSettings() {
  return (
    <div className="flex items-center justify-center py-6 text-xs text-slate-600">
      No settings for this node
    </div>
  );
}

function ConfigOnTimer({ data, onUpdate }: { data: OnTimerNodeData; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <Field label="Interval (ms)">
      <input
        type="number"
        className={inputCls}
        value={data.intervalMs}
        min={1}
        onChange={(e) => onUpdate({ ...data, intervalMs: Number(e.target.value) })}
      />
    </Field>
  );
}

function ConfigOnInterrupt({ data, pins, onUpdate }: { data: OnInterruptNodeData; pins: Pin[]; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Pin">
        <select
          className={inputCls}
          value={data.mcuPinId}
          onChange={(e) => {
            const pin = pins.find((p) => p.id === e.target.value);
            onUpdate({ ...data, mcuPinId: e.target.value, mcuPinName: pin?.name ?? "" });
          }}
        >
          <option value="">Select pin…</option>
          {pins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Trigger">
        <select
          className={inputCls}
          value={data.trigger}
          onChange={(e) => onUpdate({ ...data, trigger: e.target.value as any })}
        >
          <option value="rising">Rising edge</option>
          <option value="falling">Falling edge</option>
          <option value="change">Any change</option>
        </select>
      </Field>
    </>
  );
}

function ConfigReadSensor({ data, mcu, onUpdate }: { data: ReadSensorNodeData; mcu: McuHardware; onUpdate: (d: LogicNodeData) => void }) {
  const selectedComp = mcu.wiredComponents.find((c) => c.circuitNodeId === data.componentNodeId);
  const properties   = selectedComp ? getSensorProperties(selectedComp.category) : [];

  return (
    <>
      <Field label="Component">
        <select
          className={inputCls}
          value={data.componentNodeId}
          onChange={(e) => {
            const comp = mcu.wiredComponents.find((c) => c.circuitNodeId === e.target.value);
            onUpdate({ ...data, componentNodeId: e.target.value, componentName: comp?.name ?? "", readProperty: "" });
          }}
        >
          <option value="">Select component…</option>
          {mcu.wiredComponents.map((c) => (
            <option key={c.circuitNodeId} value={c.circuitNodeId}>{c.instanceLabel}</option>
          ))}
        </select>
      </Field>
      <Field label="Property">
        <select
          className={inputCls}
          value={data.readProperty}
          disabled={!data.componentNodeId}
          onChange={(e) => onUpdate({ ...data, readProperty: e.target.value })}
        >
          <option value="">Select property…</option>
          {properties.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>
      <Field label="Store as Variable">
        <input
          className={inputCls}
          value={data.outputVariable}
          placeholder="e.g. temperature"
          onChange={(e) => onUpdate({ ...data, outputVariable: e.target.value })}
        />
      </Field>
      {selectedComp && (
        <div className="mt-1 px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700 text-[10px] text-slate-500">
          Protocol: {selectedComp.protocols.join(", ")}
        </div>
      )}
    </>
  );
}

function ConfigReadPin({ data, pins, onUpdate }: { data: ReadPinNodeData; pins: Pin[]; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Pin">
        <select
          className={inputCls}
          value={data.mcuPinId}
          onChange={(e) => {
            const pin = pins.find((p) => p.id === e.target.value);
            onUpdate({ ...data, mcuPinId: e.target.value, mcuPinName: pin?.name ?? "" });
          }}
        >
          <option value="">Select pin…</option>
          {pins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Store as Variable">
        <input
          className={inputCls}
          value={data.outputVariable}
          placeholder="e.g. button_state"
          onChange={(e) => onUpdate({ ...data, outputVariable: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigCondition({ data, variables, onUpdate }: { data: ConditionNodeData; variables: string[]; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Variable">
        <select
          className={inputCls}
          value={data.variableName}
          onChange={(e) => onUpdate({ ...data, variableName: e.target.value })}
        >
          <option value="">Select variable…</option>
          {variables.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Operator">
        <select
          className={inputCls}
          value={data.operator}
          onChange={(e) => onUpdate({ ...data, operator: e.target.value as any })}
        >
          {([">", "<", ">=", "<=", "==", "!="] as const).map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </Field>
      <Field label="Value">
        <input
          className={inputCls}
          value={data.compareValue}
          placeholder="e.g. 30"
          onChange={(e) => onUpdate({ ...data, compareValue: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigWait({ data, onUpdate }: { data: WaitNodeData; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <Field label="Duration (ms)">
      <input
        type="number"
        className={inputCls}
        value={data.durationMs}
        min={1}
        onChange={(e) => onUpdate({ ...data, durationMs: Number(e.target.value) })}
      />
    </Field>
  );
}

function ConfigLoopCount({ data, onUpdate }: { data: LoopCountNodeData; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <Field label="Repeat Count">
      <input
        type="number"
        className={inputCls}
        value={data.count}
        min={1}
        onChange={(e) => onUpdate({ ...data, count: Number(e.target.value) })}
      />
    </Field>
  );
}

function ConfigLoopWhile({ data, variables, onUpdate }: { data: LoopWhileNodeData; variables: string[]; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Variable">
        <select
          className={inputCls}
          value={data.variableName}
          onChange={(e) => onUpdate({ ...data, variableName: e.target.value })}
        >
          <option value="">Select variable…</option>
          {variables.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
      <Field label="Operator">
        <select
          className={inputCls}
          value={data.operator}
          onChange={(e) => onUpdate({ ...data, operator: e.target.value as any })}
        >
          {([">", "<", ">=", "<=", "==", "!="] as const).map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </Field>
      <Field label="Value">
        <input
          className={inputCls}
          value={data.compareValue}
          placeholder="e.g. 0"
          onChange={(e) => onUpdate({ ...data, compareValue: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigSetVariable({ data, onUpdate }: { data: SetVariableNodeData; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Variable Name">
        <input
          className={inputCls}
          value={data.variableName}
          placeholder="e.g. counter"
          onChange={(e) => onUpdate({ ...data, variableName: e.target.value })}
        />
      </Field>
      <Field label="Value Source">
        <select
          className={inputCls}
          value={data.valueSource}
          onChange={(e) => onUpdate({ ...data, valueSource: e.target.value as any })}
        >
          <option value="literal">Literal value</option>
          <option value="variable">From variable</option>
        </select>
      </Field>
      <Field label={data.valueSource === "variable" ? "Source Variable" : "Value"}>
        <input
          className={inputCls}
          value={data.rawValue}
          placeholder={data.valueSource === "variable" ? "variable name" : "0"}
          onChange={(e) => onUpdate({ ...data, rawValue: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigSetPin({ data, pins, onUpdate }: { data: SetPinNodeData; pins: Pin[]; onUpdate: (d: LogicNodeData) => void }) {
  return (
    <>
      <Field label="Pin">
        <select
          className={inputCls}
          value={data.mcuPinId}
          onChange={(e) => {
            const pin = pins.find((p) => p.id === e.target.value);
            onUpdate({ ...data, mcuPinId: e.target.value, mcuPinName: pin?.name ?? "" });
          }}
        >
          <option value="">Select pin…</option>
          {pins.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="State">
        <select
          className={inputCls}
          value={data.state}
          onChange={(e) => onUpdate({ ...data, state: e.target.value as any })}
        >
          <option value="HIGH">HIGH</option>
          <option value="LOW">LOW</option>
          <option value="TOGGLE">TOGGLE</option>
        </select>
      </Field>
    </>
  );
}

function ConfigWriteComponent({ data, mcu, onUpdate }: { data: WriteComponentNodeData; mcu: McuHardware; onUpdate: (d: LogicNodeData) => void }) {
  const selectedComp = mcu.wiredComponents.find((c) => c.circuitNodeId === data.componentNodeId);
  const actions      = selectedComp ? getComponentActions(selectedComp.category) : [];

  return (
    <>
      <Field label="Component">
        <select
          className={inputCls}
          value={data.componentNodeId}
          onChange={(e) => {
            const comp = mcu.wiredComponents.find((c) => c.circuitNodeId === e.target.value);
            onUpdate({ ...data, componentNodeId: e.target.value, componentName: comp?.name ?? "", action: "" });
          }}
        >
          <option value="">Select component…</option>
          {mcu.wiredComponents.map((c) => (
            <option key={c.circuitNodeId} value={c.circuitNodeId}>{c.instanceLabel}</option>
          ))}
        </select>
      </Field>
      <Field label="Action">
        <select
          className={inputCls}
          value={data.action}
          disabled={!data.componentNodeId}
          onChange={(e) => onUpdate({ ...data, action: e.target.value })}
        >
          <option value="">Select action…</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>
      <Field label="Value Source">
        <select
          className={inputCls}
          value={data.valueSource}
          onChange={(e) => onUpdate({ ...data, valueSource: e.target.value as any })}
        >
          <option value="literal">Literal value</option>
          <option value="variable">From variable</option>
        </select>
      </Field>
      <Field label={data.valueSource === "variable" ? "Source Variable" : "Value"}>
        <input
          className={inputCls}
          value={data.rawValue}
          placeholder={data.valueSource === "variable" ? "variable name" : "0"}
          onChange={(e) => onUpdate({ ...data, rawValue: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigSendUart({ data, pins, mcu, onUpdate }: { data: SendUartNodeData; pins: Pin[]; mcu: McuHardware; onUpdate: (d: LogicNodeData) => void }) {
  const txPins  = pins.filter((p) => /tx|uart/i.test(p.name));
  const pinList = txPins.length > 0 ? txPins : pins;

  return (
    <>
      <Field label="TX Pin">
        <select
          className={inputCls}
          value={data.txPinId}
          onChange={(e) => {
            const pin = pinList.find((p) => p.id === e.target.value);
            onUpdate({ ...data, txPinId: e.target.value, txPinName: pin?.name ?? "" });
          }}
        >
          <option value="">Select TX pin…</option>
          {pinList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      {mcu.connectedMcuIds.length > 0 && (
        <Field label="Target MCU">
          <select
            className={inputCls}
            value={data.targetMcuNodeId ?? ""}
            onChange={(e) => onUpdate({ ...data, targetMcuNodeId: e.target.value || null })}
          >
            <option value="">External / None</option>
            {mcu.connectedMcuIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Data Template">
        <input
          className={inputCls}
          value={data.dataTemplate}
          placeholder="e.g. temp={temperature}"
          onChange={(e) => onUpdate({ ...data, dataTemplate: e.target.value })}
        />
      </Field>
    </>
  );
}

function ConfigReceiveUart({ data, pins, onUpdate }: { data: ReceiveUartNodeData; pins: Pin[]; onUpdate: (d: LogicNodeData) => void }) {
  const rxPins  = pins.filter((p) => /rx|uart/i.test(p.name));
  const pinList = rxPins.length > 0 ? rxPins : pins;

  return (
    <>
      <Field label="RX Pin">
        <select
          className={inputCls}
          value={data.rxPinId}
          onChange={(e) => {
            const pin = pinList.find((p) => p.id === e.target.value);
            onUpdate({ ...data, rxPinId: e.target.value, rxPinName: pin?.name ?? "" });
          }}
        >
          <option value="">Select RX pin…</option>
          {pinList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Store as Variable">
        <input
          className={inputCls}
          value={data.outputVariable}
          placeholder="e.g. received_data"
          onChange={(e) => onUpdate({ ...data, outputVariable: e.target.value })}
        />
      </Field>
    </>
  );
}

interface NodeConfigPanelProps {
  node:      Node;
  mcu:       McuHardware;
  mcuPins:   Pin[];
  variables: string[];
  onUpdate:  (d: LogicNodeData) => void;
}

function NodeConfigPanel({ node, mcu, mcuPins, variables, onUpdate }: NodeConfigPanelProps) {
  const data = node.data as unknown as LogicNodeData;
  if (!data?.nodeType) return null;

  switch (data.nodeType) {
    case "on_start":
    case "on_loop":
      return <ConfigNoSettings />;
    case "on_timer":
      return <ConfigOnTimer data={data} onUpdate={onUpdate} />;
    case "on_interrupt":
      return <ConfigOnInterrupt data={data} pins={mcuPins} onUpdate={onUpdate} />;
    case "read_sensor":
      return <ConfigReadSensor data={data} mcu={mcu} onUpdate={onUpdate} />;
    case "read_pin":
      return <ConfigReadPin data={data} pins={mcuPins} onUpdate={onUpdate} />;
    case "condition":
      return <ConfigCondition data={data} variables={variables} onUpdate={onUpdate} />;
    case "wait":
      return <ConfigWait data={data} onUpdate={onUpdate} />;
    case "loop_count":
      return <ConfigLoopCount data={data} onUpdate={onUpdate} />;
    case "loop_while":
      return <ConfigLoopWhile data={data} variables={variables} onUpdate={onUpdate} />;
    case "set_variable":
      return <ConfigSetVariable data={data} onUpdate={onUpdate} />;
    case "set_pin":
      return <ConfigSetPin data={data} pins={mcuPins} onUpdate={onUpdate} />;
    case "write_component":
      return <ConfigWriteComponent data={data} mcu={mcu} onUpdate={onUpdate} />;
    case "send_uart":
      return <ConfigSendUart data={data} pins={mcuPins} mcu={mcu} onUpdate={onUpdate} />;
    case "receive_uart":
      return <ConfigReceiveUart data={data} pins={mcuPins} onUpdate={onUpdate} />;
    default:
      return null;
  }
}

interface McuFlowCanvasProps {
  mcu:               McuHardware;
  flow:              LogicFlow;
  onFlowChange:      (mcuNodeId: string, nodes: Node[], edges: Edge[]) => void;
  onSelectionChange: (node: Node | null) => void;
  onRegisterUpdate:  (fn: (nodeId: string, data: LogicNodeData) => void) => void;
}

function McuFlowCanvas({ mcu, flow, onFlowChange, onSelectionChange, onRegisterUpdate }: McuFlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const { screenToFlowPosition }         = useReactFlow();
  const canvasRef                        = useRef<HTMLDivElement>(null);
  const { isDragging, draggedNodeType, setIsDragging, setDraggedNodeType } = useLogicDnD();

  const notifyRef = useRef<(n: Node[], e: Edge[]) => void>(() => {});
  const edgesRef  = useRef<Edge[]>(edges);

  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const notify = useCallback(
    (n: Node[], e: Edge[]) => onFlowChange(mcu.circuitNodeId, n, e),
    [mcu.circuitNodeId, onFlowChange]
  );

  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
    onRegisterUpdate((nodeId, data) => {
      setNodes((nds) => {
        const next = nds.map((n) => n.id === nodeId ? { ...n, data: data as any } : n);
        notifyRef.current(next, edgesRef.current);
        return next;
      });
    });
  }, [onRegisterUpdate]);

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [mcu.circuitNodeId]);

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
          notifyRef.current(next, edgesRef.current);
          return next;
        });
      }
      setIsDragging(false);
      setDraggedNodeType(null);
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [isDragging, draggedNodeType, screenToFlowPosition, setIsDragging, setDraggedNodeType]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const isYes = connection.sourceHandle === "yes";
      const isNo  = connection.sourceHandle === "no";
      const style = isYes
        ? { stroke: "#10b981", strokeWidth: 2 }
        : isNo
        ? { stroke: "#ef4444", strokeWidth: 2 }
        : { stroke: "#475569", strokeWidth: 2 };

      setEdges((eds) => {
        const next = addEdge(
          { ...connection, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style },
          eds
        );
        notifyRef.current(nodes, next);
        return next;
      });
    },
    [nodes]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      const hasNonSelection = changes.some((c: any) => c.type !== "select");
      onNodesChange(changes);
      if (hasNonSelection) notifyRef.current(nodes, edgesRef.current);
    },
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      const hasNonSelection = changes.some((c: any) => c.type !== "select");
      onEdgesChange(changes);
      if (hasNonSelection) notifyRef.current(nodes, edgesRef.current);
    },
    [nodes, edges, onEdgesChange]
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
        onNodeClick={(_, node) => onSelectionChange(node)}
        onPaneClick={() => onSelectionChange(null)}
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
  const [selectedNode, setSelectedNode]       = useState<Node | null>(null);

  const updateNodeFnRef = useRef<((nodeId: string, data: LogicNodeData) => void) | null>(null);

  const registerUpdateFn = useCallback(
    (fn: (nodeId: string, data: LogicNodeData) => void) => {
      updateNodeFnRef.current = fn;
    },
    []
  );

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

  const handleSetActiveMcu = (id: string) => {
    setActiveMcuId(id);
    setSelectedNode(null);
  };

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

  const handleNodeUpdate = useCallback((data: LogicNodeData) => {
    if (!selectedNode) return;
    updateNodeFnRef.current?.(selectedNode.id, data);
    setSelectedNode((prev) => prev ? { ...prev, data: data as any } : null);
  }, [selectedNode]);

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
  const mcuPins    = activeMcu ? getMcuGpioPins(activeMcu, currentProject.canvas_nodes) : [];
  const variables  = activeFlow ? getFlowVariables(activeFlow) : [];
  const selectedNodeData = selectedNode?.data as unknown as LogicNodeData | undefined;

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-1 px-3 shrink-0">
        <span className="text-xs text-slate-500 mr-2">MCU:</span>
        {hardwareMap.mcus.map((mcu) => (
          <button
            key={mcu.circuitNodeId}
            onClick={() => handleSetActiveMcu(mcu.circuitNodeId)}
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
              onSelectionChange={setSelectedNode}
              onRegisterUpdate={registerUpdateFn}
            />
          )}
        </div>

        <aside className="w-60 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {selectedNodeData
                ? NODE_TYPE_LABELS[selectedNodeData.nodeType]
                : activeMcu
                ? `${activeMcu.wiredComponents.length} component${activeMcu.wiredComponents.length !== 1 ? "s" : ""} wired`
                : "Configuration"}
            </p>
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            {selectedNode && selectedNodeData && activeMcu ? (
              <NodeConfigPanel
                node={selectedNode}
                mcu={activeMcu}
                mcuPins={mcuPins}
                variables={variables}
                onUpdate={handleNodeUpdate}
              />
            ) : activeMcu && activeMcu.wiredComponents.length > 0 ? (
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