import { create } from "zustand";
import { Node, Edge } from "@xyflow/react";
import { Project } from "@/lib/projectService";

interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  updateProjectCanvas: (nodes: Node[], edges: Edge[]) => void;
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
}));