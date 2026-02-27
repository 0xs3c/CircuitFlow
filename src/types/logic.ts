import { Node, Edge } from "@xyflow/react";

export interface PinConnection {
  mcuPinId: string;
  mcuPinName: string;
  componentPinId: string;
  componentPinName: string;
}

export interface WiredComponent {
  circuitNodeId: string;
  definitionId: string;
  name: string;
  category: string;
  instanceLabel: string;
  connections: PinConnection[];
  protocols: string[];
}

export interface McuHardware {
  circuitNodeId: string;
  definitionId: string;
  name: string;
  instanceLabel: string;
  wiredComponents: WiredComponent[];
  connectedMcuIds: string[];
}

export interface HardwareMap {
  mcus: McuHardware[];
}

export type LogicNodeType =
  | "on_start"
  | "on_loop"
  | "on_timer"
  | "on_interrupt"
  | "read_sensor"
  | "read_pin"
  | "condition"
  | "wait"
  | "loop_count"
  | "loop_while"
  | "set_variable"
  | "set_pin"
  | "write_component"
  | "send_uart"
  | "receive_uart";

interface BaseLogicNodeData {
  nodeType: LogicNodeType;
  label?: string;
}

export interface OnStartNodeData extends BaseLogicNodeData {
  nodeType: "on_start";
}

export interface OnLoopNodeData extends BaseLogicNodeData {
  nodeType: "on_loop";
}

export interface OnTimerNodeData extends BaseLogicNodeData {
  nodeType: "on_timer";
  intervalMs: number;
}

export interface OnInterruptNodeData extends BaseLogicNodeData {
  nodeType: "on_interrupt";
  mcuPinId: string;
  mcuPinName: string;
  trigger: "rising" | "falling" | "change";
}

export interface ReadSensorNodeData extends BaseLogicNodeData {
  nodeType: "read_sensor";
  componentNodeId: string;
  componentName: string;
  readProperty: string;
  outputVariable: string;
}

export interface ReadPinNodeData extends BaseLogicNodeData {
  nodeType: "read_pin";
  mcuPinId: string;
  mcuPinName: string;
  outputVariable: string;
}

export interface ConditionNodeData extends BaseLogicNodeData {
  nodeType: "condition";
  variableName: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  compareValue: string;
}

export interface WaitNodeData extends BaseLogicNodeData {
  nodeType: "wait";
  durationMs: number;
}

export interface LoopCountNodeData extends BaseLogicNodeData {
  nodeType: "loop_count";
  count: number;
}

export interface LoopWhileNodeData extends BaseLogicNodeData {
  nodeType: "loop_while";
  variableName: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  compareValue: string;
}

export interface SetVariableNodeData extends BaseLogicNodeData {
  nodeType: "set_variable";
  variableName: string;
  valueSource: "literal" | "variable";
  rawValue: string;
}

export interface SetPinNodeData extends BaseLogicNodeData {
  nodeType: "set_pin";
  mcuPinId: string;
  mcuPinName: string;
  state: "HIGH" | "LOW" | "TOGGLE";
}

export interface WriteComponentNodeData extends BaseLogicNodeData {
  nodeType: "write_component";
  componentNodeId: string;
  componentName: string;
  action: string;
  valueSource: "literal" | "variable";
  rawValue: string;
}

export interface SendUartNodeData extends BaseLogicNodeData {
  nodeType: "send_uart";
  txPinId: string;
  txPinName: string;
  targetMcuNodeId: string | null;
  dataTemplate: string;
}

export interface ReceiveUartNodeData extends BaseLogicNodeData {
  nodeType: "receive_uart";
  rxPinId: string;
  rxPinName: string;
  outputVariable: string;
}

export type LogicNodeData =
  | OnStartNodeData
  | OnLoopNodeData
  | OnTimerNodeData
  | OnInterruptNodeData
  | ReadSensorNodeData
  | ReadPinNodeData
  | ConditionNodeData
  | WaitNodeData
  | LoopCountNodeData
  | LoopWhileNodeData
  | SetVariableNodeData
  | SetPinNodeData
  | WriteComponentNodeData
  | SendUartNodeData
  | ReceiveUartNodeData;

export interface LogicVariable {
  name: string;
  type: "number" | "boolean" | "string";
  declaredByNodeId: string;
}

export interface LogicFlow {
  mcuNodeId: string;
  mcuName: string;
  nodes: Node[];
  edges: Edge[];
  variables: LogicVariable[];
}
