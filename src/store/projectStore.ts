import { create } from "zustand";
import { Node, Edge } from "@xyflow/react";
import { Project } from "@/lib/projectService";
import { LogicFlow } from "@/types/logic";

interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  updateProjectCanvas: (nodes: Node[], edges: Edge[]) => void;
  updateLogicFlows: (flows: LogicFlow[]) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setCurrentProject: (p) => set({ currentProject: p }),
  updateProjectCanvas: (nodes, edges) =>
    set((s) =>
      s.currentProject
        ? { currentProject: { ...s.currentProject, canvas_nodes: nodes, canvas_edges: edges } }
        : {}
    ),
  updateLogicFlows: (flows) =>
    set((s) =>
      s.currentProject
        ? { currentProject: { ...s.currentProject, logic_flows: flows } }
        : {}
    ),
}));