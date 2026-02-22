import { supabase } from "./supabase";
import { Node, Edge } from "@xyflow/react";

export interface Project {
  id: string;
  name: string;
  description?: string;
  canvas_nodes: Node[];
  canvas_edges: Edge[];
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at, updated_at, canvas_nodes, canvas_edges")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProject(name: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
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