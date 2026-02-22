import { supabase } from "./supabase";
import { ComponentDefinition, Pin } from "@/types/circuit";

export interface ComponentFilters {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ComponentsResult {
  components: ComponentDefinition[];
  total: number;
  hasMore: boolean;
}

// Map Supabase row to our frontend ComponentDefinition type
function rowToDefinition(row: any): ComponentDefinition {
  const pins: Pin[] = (row.pins ?? []).map((p: any) => ({
    id:       p.id,
    name:     p.name,
    type:     p.type,
    side:     p.side,
    position: p.position,
  }));

  return {
    id:           row.kicad_id,
    name:         row.name,
    category:     row.category,
    manufacturer: row.manufacturer ?? undefined,
    description:  row.description ?? undefined,
    tags:         row.tags ?? [],
    pins,
    width:        row.width  ?? 220,
    height:       row.height ?? 160,
  };
}

export async function fetchComponents(
  filters: ComponentFilters = {}
): Promise<ComponentsResult> {
  const {
    search   = "",
    category = "",
    limit    = 40,
    offset   = 0,
  } = filters;

  let query = supabase
    .from("components")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  // Full-text search on name and description
  if (search.trim()) {
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  // Category filter
  if (category && category !== "All") {
    query = query.eq("category", category);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("componentService.fetchComponents error:", error);
    throw new Error(error.message);
  }

  const components = (data ?? []).map(rowToDefinition);
  const total      = count ?? 0;

  return {
    components,
    total,
    hasMore: offset + limit < total,
  };
}

export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("components")
    .select("category")
    .order("category", { ascending: true });

  if (error) {
    console.error("componentService.fetchCategories error:", error);
    return [];
  }

  // Deduplicate
  const unique = [...new Set((data ?? []).map((r: any) => r.category as string))];
  return unique.filter(Boolean);
}