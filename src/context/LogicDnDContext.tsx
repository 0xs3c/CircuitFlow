import { createContext, useContext, useState, ReactNode } from "react";
import { LogicNodeType } from "@/types/logic";

interface LogicDnDContextType {
  draggedNodeType: LogicNodeType | null;
  setDraggedNodeType: (t: LogicNodeType | null) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}

const LogicDnDContext = createContext<LogicDnDContextType>({
  draggedNodeType:    null,
  setDraggedNodeType: () => {},
  isDragging:         false,
  setIsDragging:      () => {},
});

export function LogicDnDProvider({ children }: { children: ReactNode }) {
  const [draggedNodeType, setDraggedNodeType] = useState<LogicNodeType | null>(null);
  const [isDragging, setIsDragging]           = useState(false);

  return (
    <LogicDnDContext.Provider value={{ draggedNodeType, setDraggedNodeType, isDragging, setIsDragging }}>
      {children}
    </LogicDnDContext.Provider>
  );
}

export function useLogicDnD() {
  return useContext(LogicDnDContext);
}