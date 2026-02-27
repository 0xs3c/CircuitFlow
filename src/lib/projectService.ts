import { supabase } from "./supabase";
import { Node, Edge } from "@xyflow/react";
import { LogicFlow } from "@/types/logic";

export interface Project {
  id: string;
  name: string;
  description?: string;
  canvas_nodes: Node[];
  canvas_edges: Edge[];
  logic_flows: LogicFlow[];
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at, updated_at, canvas_nodes, canvas_edges, logic_flows")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...row,
    logic_flows: row.logic_flows ?? [],
  }));
}

export async function createProject(name: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, user_id: user.id, logic_flows: [] })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...data, logic_flows: data.logic_flows ?? [] };
}

export async function saveProject(
  id: string,
  nodes: Node[],
  edges: Edge[]
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ canvas_nodes: nodes, canvas_edges: edges })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function saveLogicFlows(
  id: string,
  logicFlows: LogicFlow[]
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ logic_flows: logicFlows })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ name })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}