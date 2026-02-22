export interface Pin {
  id: string;
  name: string;
  type: "power_in" | "power_out" | "input" | "output" | "bidirectional" | "passive";
  side: "left" | "right" | "top" | "bottom";
  position: number; // order on that side
}

export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  description?: string;
  tags: string[];
  pins: Pin[];
  width?: number;
  height?: number;
}

export interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  definition: ComponentDefinition;
  position: { x: number; y: number };
  label?: string;
}

export interface Wire {
  id: string;
  fromInstanceId: string;
  fromPinId: string;
  toInstanceId: string;
  toPinId: string;
  netName?: string;
}

export interface Schematic {
  version: string;
  components: PlacedComponent[];
  wires: Wire[];
}