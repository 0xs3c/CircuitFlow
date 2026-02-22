import { createContext, useContext, useState, ReactNode } from "react";
import { ComponentDefinition } from "@/types/circuit";

interface DnDContextType {
  draggedDefinition: ComponentDefinition | null;
  setDraggedDefinition: (definition: ComponentDefinition | null) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  mousePos: { x: number; y: number };
  setMousePos: (pos: { x: number; y: number }) => void;
}

const DnDContext = createContext<DnDContextType>({
  draggedDefinition: null,
  setDraggedDefinition: () => {},
  isDragging: false,
  setIsDragging: () => {},
  mousePos: { x: 0, y: 0 },
  setMousePos: () => {},
});

export function DnDProvider({ children }: { children: ReactNode }) {
  const [draggedDefinition, setDraggedDefinition] =
    useState<ComponentDefinition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <DnDContext.Provider
      value={{
        draggedDefinition,
        setDraggedDefinition,
        isDragging,
        setIsDragging,
        mousePos,
        setMousePos,
      }}
    >
      {children}
    </DnDContext.Provider>
  );
}

export function useDnD() {
  return useContext(DnDContext);
}