import { create } from "zustand";
import { PlacedComponent, Wire, ComponentDefinition } from "@/types/circuit";

interface CircuitStore {
  components: PlacedComponent[];
  wires: Wire[];
  selectedInstanceId: string | null;

  addComponent: (definition: ComponentDefinition, position: { x: number; y: number }) => void;
  removeComponent: (instanceId: string) => void;
  moveComponent: (instanceId: string, position: { x: number; y: number }) => void;
  selectComponent: (instanceId: string | null) => void;
  addWire: (wire: Wire) => void;
  removeWire: (wireId: string) => void;
  clearAll: () => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  components: [],
  wires: [],
  selectedInstanceId: null,

  addComponent: (definition, position) =>
    set((state) => ({
      components: [
        ...state.components,
        {
          instanceId: `${definition.id}-${Date.now()}`,
          definitionId: definition.id,
          definition,
          position,
          label: definition.name,
        },
      ],
    })),

  removeComponent: (instanceId) =>
    set((state) => ({
      components: state.components.filter((c) => c.instanceId !== instanceId),
      wires: state.wires.filter(
        (w) => w.fromInstanceId !== instanceId && w.toInstanceId !== instanceId
      ),
      selectedInstanceId:
        state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
    })),

  moveComponent: (instanceId, position) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.instanceId === instanceId ? { ...c, position } : c
      ),
    })),

  selectComponent: (instanceId) =>
    set({ selectedInstanceId: instanceId }),

  addWire: (wire) =>
    set((state) => ({ wires: [...state.wires, wire] })),

  removeWire: (wireId) =>
    set((state) => ({
      wires: state.wires.filter((w) => w.id !== wireId),
    })),

  clearAll: () =>
    set({ components: [], wires: [], selectedInstanceId: null }),
}));