import { Node, Edge } from "@xyflow/react";
import { PlacedComponent } from "@/types/circuit";
import { HardwareMap, McuHardware, WiredComponent, PinConnection } from "@/types/logic";

const PROTOCOL_PATTERNS: Record<string, RegExp[]> = {
  SPI:  [/sck|sclk|mosi|miso|nss|cs/i],
  I2C:  [/sda|scl/i],
  UART: [/tx|rx|uart/i],
  PWM:  [/tim|pwm|ch\d/i],
};

function inferProtocols(pinNames: string[]): string[] {
  const found = new Set<string>();
  for (const [protocol, patterns] of Object.entries(PROTOCOL_PATTERNS)) {
    for (const name of pinNames) {
      if (patterns.some((re) => re.test(name))) {
        found.add(protocol);
        break;
      }
    }
  }
  return found.size > 0 ? [...found] : ["GPIO"];
}

function getComponent(node: Node): PlacedComponent | null {
  return (node.data?.component as PlacedComponent) ?? null;
}

function isMcu(node: Node): boolean {
  const comp = getComponent(node);
  if (!comp) return false;
  const cat  = comp.definition.category?.toLowerCase() ?? "";
  const tags = comp.definition.tags?.map((t) => t.toLowerCase()) ?? [];
  return (
    cat === "mcu" ||
    cat.includes("microcontroller") ||
    tags.includes("mcu") ||
    tags.includes("microcontroller") ||
    tags.includes("esp32") ||
    tags.includes("stm32") ||
    tags.includes("arduino")
  );
}

export function extractHardwareMap(nodes: Node[], edges: Edge[]): HardwareMap {
  const mcuNodes = nodes.filter((n) => n.type === "componentNode" && isMcu(n));

  const mcus: McuHardware[] = mcuNodes.map((mcuNode) => {
    const mcuComp = getComponent(mcuNode)!;

    const connectedEdges = edges.filter(
      (e) => e.source === mcuNode.id || e.target === mcuNode.id
    );

    const componentMap = new Map<string, { node: Node; connections: PinConnection[] }>();

    for (const edge of connectedEdges) {
      const isMcuSource = edge.source === mcuNode.id;
      const peerNodeId  = isMcuSource ? edge.target : edge.source;
      const mcuPinId    = isMcuSource ? edge.sourceHandle : edge.targetHandle;
      const peerPinId   = isMcuSource ? edge.targetHandle : edge.sourceHandle;

      if (!mcuPinId || !peerPinId) continue;

      const peerNode = nodes.find((n) => n.id === peerNodeId);
      if (!peerNode || peerNode.type !== "componentNode") continue;

      const mcuPin   = mcuComp.definition.pins.find((p) => p.id === mcuPinId);
      const peerComp = getComponent(peerNode);
      if (!mcuPin || !peerComp) continue;

      const peerPin = peerComp.definition.pins.find((p) => p.id === peerPinId);
      if (!peerPin) continue;

      const connection: PinConnection = {
        mcuPinId,
        mcuPinName:       mcuPin.name,
        componentPinId:   peerPinId,
        componentPinName: peerPin.name,
      };

      if (!componentMap.has(peerNodeId)) {
        componentMap.set(peerNodeId, { node: peerNode, connections: [] });
      }
      componentMap.get(peerNodeId)!.connections.push(connection);
    }

    const wiredComponents: WiredComponent[] = [];
    const connectedMcuIds: string[]         = [];

    for (const [peerNodeId, { node: peerNode, connections }] of componentMap) {
      const peerComp = getComponent(peerNode)!;

      if (isMcu(peerNode)) {
        connectedMcuIds.push(peerNodeId);
        continue;
      }

      const mcuPinNames = connections.map((c) => c.mcuPinName);
      const protocols   = inferProtocols(mcuPinNames);

      wiredComponents.push({
        circuitNodeId: peerNodeId,
        definitionId:  peerComp.definitionId,
        name:          peerComp.definition.name,
        category:      peerComp.definition.category,
        instanceLabel: peerComp.label ?? peerComp.definition.name,
        connections,
        protocols,
      });
    }

    return {
      circuitNodeId: mcuNode.id,
      definitionId:  mcuComp.definitionId,
      name:          mcuComp.definition.name,
      instanceLabel: mcuComp.label ?? mcuComp.definition.name,
      wiredComponents,
      connectedMcuIds,
    };
  });

  return { mcus };
}