import { useEffect, useState } from "react";
import {
  Plus, FolderOpen, Trash2, Clock, Loader2,
  CircuitBoard, PenLine, ChevronRight
} from "lucide-react";
import {
  listProjects, createProject, deleteProject,
  renameProject, Project
} from "@/lib/projectService";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { formatDistanceToNow } from "date-fns";

export default function ProjectDashboard() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState("");
  const [error, setError]           = useState<string | null>(null);

  const { setCurrentProject } = useProjectStore();
  const { user, signOut }     = useAuthStore();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newName.trim());
      setCurrentProject(project);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      setProjects((ps) => ps.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    try {
      await renameProject(id, renameVal.trim());
      setProjects((ps) =>
        ps.map((p) => p.id === id ? { ...p, name: renameVal.trim() } : p)
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRenamingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">

      {/* Top bar */}
      <div className="border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <CircuitBoard size={18} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100 tracking-tight">CircuitFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* New project */}
          {showNewInput ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Project name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setShowNewInput(false);
                }}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : null}
                Create
              </button>
              <button
                onClick={() => setShowNewInput(false)}
                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowNewInput(true); setNewName(""); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} />
              New Project
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-slate-800/50 p-4 rounded-2xl mb-4">
              <FolderOpen size={32} className="text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">No projects yet</p>
            <p className="text-slate-600 text-sm mt-1">Create your first project to get started</p>
            <button
              onClick={() => setShowNewInput(true)}
              className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={15} />
              New Project
            </button>
          </div>
        )}

        {/* Project grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => setCurrentProject(project)}
                className="group flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="bg-blue-600/10 p-2 rounded-lg shrink-0">
                    <CircuitBoard size={16} className="text-blue-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {renamingId === project.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={() => handleRename(project.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(project.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-slate-700 border border-slate-500 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-full max-w-xs"
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {project.name}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {(project.canvas_nodes ?? []).length} components
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(project.id);
                      setRenameVal(project.name);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Rename"
                  >
                    <PenLine size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={15} className="text-slate-600 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}