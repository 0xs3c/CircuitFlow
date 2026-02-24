import { Node, Edge } from "@xyflow/react";
import { PlacedComponent, Pin } from "@/types/circuit";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passed: boolean;
}

// Pin type conflict rules
// Returns true if the connection is invalid
function isPinConflict(typeA: Pin["type"], typeB: Pin["type"]): string | null {
  const pair = [typeA, typeB].sort().join("+");
  const conflicts: Record<string, string> = {
    "output+output":       "Two output pins connected — possible short circuit",
    "power_in+power_in":   "Two power inputs connected — check voltage levels",
    "power_out+power_out": "Two power outputs connected — possible short circuit",
    "input+input":         "Two input pins connected — neither drives the signal",
    "power_in+power_out":  "Power input connected to power output — verify intentional",
  };
  return conflicts[pair] ?? null;
}

// Power-related pin names
const POWER_NAMES = ["vcc", "vdd", "3v3", "5v", "vin", "gnd", "gnd", "vss", "agnd", "pgnd", "dgnd"];

function isPowerPin(pin: Pin): boolean {
  return pin.type === "power_in"
      || pin.type === "power_out"
      || POWER_NAMES.some((n) => pin.name.toLowerCase().includes(n));
}

export function validateCircuit(nodes: Node[], edges: Edge[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  let idCounter = 0;
  const nextId = () => `issue-${idCounter++}`;

  // Only validate component nodes (not comments)
  const componentNodes = nodes.filter((n) => n.type === "componentNode");

  if (componentNodes.length === 0) {
    return {
      issues: [{
        id: nextId(),
        severity: "info",
        title: "Empty canvas",
        detail: "Add some components to validate your circuit.",
      }],
      errorCount: 0,
      warningCount: 0,
      infoCount: 1,
      passed: true,
    };
  }

  // Build a map of connected handle IDs → edge
  // Edge sourceHandle = pin id on source node
  // Edge targetHandle = pin id on target node
  const connectedHandles = new Set<string>();
  for (const edge of edges) {
    if (edge.sourceHandle) connectedHandles.add(`${edge.source}::${edge.sourceHandle}`);
    if (edge.targetHandle) connectedHandles.add(`${edge.target}::${edge.targetHandle}`);
  }

  // ── Check 1: Completely unconnected components ──────────────────────────
  for (const node of componentNodes) {
    const comp = node.data.component as PlacedComponent;
    const { definition } = comp;

    const hasAnyConnection = definition.pins.some((pin) =>
      connectedHandles.has(`${node.id}::${pin.id}`)
    );

    if (!hasAnyConnection) {
      issues.push({
        id: nextId(),
        severity: "warning",
        title: `${definition.name} is not connected`,
        detail: "This component has no wire connections. Is it intentional?",
        nodeId: node.id,
      });
    }
  }

  // ── Check 2: Floating power pins ────────────────────────────────────────
  for (const node of componentNodes) {
    const comp = node.data.component as PlacedComponent;
    const { definition } = comp;

    const floatingPowerPins = definition.pins.filter((pin) =>
      isPowerPin(pin) && !connectedHandles.has(`${node.id}::${pin.id}`)
    );

    for (const pin of floatingPowerPins) {
      issues.push({
        id: nextId(),
        severity: "error",
        title: `Floating power pin on ${definition.name}`,
        detail: `Pin "${pin.name}" (${pin.type}) is not connected to any power net.`,
        nodeId: node.id,
      });
    }
  }

  // ── Check 3: Floating input pins ────────────────────────────────────────
  for (const node of componentNodes) {
    const comp = node.data.component as PlacedComponent;
    const { definition } = comp;

    const floatingInputPins = definition.pins.filter((pin) =>
      pin.type === "input" && !connectedHandles.has(`${node.id}::${pin.id}`)
    );

    for (const pin of floatingInputPins) {
      issues.push({
        id: nextId(),
        severity: "warning",
        title: `Floating input pin on ${definition.name}`,
        detail: `Pin "${pin.name}" is an input with no driver connected.`,
        nodeId: node.id,
      });
    }
  }

  // ── Check 4: Pin type conflicts on each edge ────────────────────────────
  // Build pin lookup: nodeId → pinId → Pin
  const pinLookup = new Map<string, Map<string, Pin>>();
  for (const node of componentNodes) {
    const comp = node.data.component as PlacedComponent;
    const pinMap = new Map<string, Pin>();
    for (const pin of comp.definition.pins) {
      pinMap.set(pin.id, pin);
    }
    pinLookup.set(node.id, pinMap);
  }

  for (const edge of edges) {
    const sourcePin = edge.sourceHandle
      ? pinLookup.get(edge.source)?.get(edge.sourceHandle)
      : undefined;
    const targetPin = edge.targetHandle
      ? pinLookup.get(edge.target)?.get(edge.targetHandle)
      : undefined;

    if (!sourcePin || !targetPin) continue;

    const conflict = isPinConflict(sourcePin.type, targetPin.type);
    if (conflict) {
      const sourceComp = (
        componentNodes.find((n) => n.id === edge.source)?.data.component as PlacedComponent
      )?.definition.name ?? edge.source;
      const targetComp = (
        componentNodes.find((n) => n.id === edge.target)?.data.component as PlacedComponent
      )?.definition.name ?? edge.target;

      issues.push({
        id: nextId(),
        severity: "error",
        title: "Invalid pin connection",
        detail: `${conflict} — ${sourceComp}.${sourcePin.name} → ${targetComp}.${targetPin.name}`,
        edgeId: edge.id,
      });
    }
  }

  // ── Summary info ────────────────────────────────────────────────────────
  issues.push({
    id: nextId(),
    severity: "info",
    title: "Circuit summary",
    detail: `${componentNodes.length} components, ${edges.length} connections, ${connectedHandles.size} connected pins.`,
  });

  const errorCount   = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount    = issues.filter((i) => i.severity === "info").length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    passed: errorCount === 0,
  };
}