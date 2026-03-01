import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/store/projectStore";
import { extractHardwareMap } from "@/lib/hardwareMap";
import { Copy, Download, Code2, RefreshCw, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface GeneratedFile {
  mcuName:  string;
  platform: string;
  filename: string;
  content:  string;
}

interface GenerateCodeResponse {
  files: GeneratedFile[];
}

export default function CodePanel() {
  const { currentProject }        = useProjectStore();
  const [files, setFiles]          = useState<GeneratedFile[]>([]);
  const [activeIdx, setActiveIdx]  = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError]          = useState<string | null>(null);

  async function generate() {
    if (!currentProject) return;
    setGenerating(true);
    setError(null);
    try {
      const hardwareMap = extractHardwareMap(
        currentProject.canvas_nodes,
        currentProject.canvas_edges
      );
      const result = await invoke<GenerateCodeResponse>("generate_code", {
        request: {
          flows:       currentProject.logic_flows ?? [],
          hardwareMap,
        },
      });
      setFiles(result.files);
      setActiveIdx(0);
    } catch (e: any) {
      setError(e?.toString() ?? "Code generation failed");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (currentProject) generate();
  }, [currentProject?.id]);

  const active = files[activeIdx];

  function copyCode() {
    if (active) navigator.clipboard.writeText(active.content);
  }

  function downloadCode() {
    if (!active) return;
    const blob = new Blob([active.content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = active.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-2 px-4 shrink-0">
        {files.length > 0 && files.map((f, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all",
              activeIdx === i
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-600 text-slate-400 hover:bg-slate-800"
            )}
          >
            {f.mcuName}
            <span className="text-[10px] opacity-60">{f.platform}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs rounded transition-colors"
          >
            {generating
              ? <Loader2 size={12} className="animate-spin" />
              : <RefreshCw size={12} />}
            Regenerate
          </button>
          <button
            onClick={copyCode}
            disabled={!active}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs rounded transition-colors"
          >
            <Copy size={12} />
            Copy
          </button>
          <button
            onClick={downloadCode}
            disabled={!active}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <Download size={12} />
            {active ? active.filename : "Export"}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-hidden bg-slate-950">
        {error ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-red-400">
              <p className="text-sm font-medium">Generation failed</p>
              <p className="text-xs text-red-500 max-w-md text-center">{error}</p>
              <button
                onClick={generate}
                className="mt-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded text-xs transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        ) : generating ? (
          <div className="h-full flex items-center justify-center gap-3 text-slate-500">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">Generating firmware…</p>
          </div>
        ) : !active ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-600">
              <Code2 size={48} />
              <p className="text-sm">No code generated yet</p>
              <p className="text-xs text-slate-700">
                Build your logic flow, then click Regenerate
              </p>
            </div>
          </div>
        ) : (
          <pre className="h-full overflow-auto p-6 text-xs text-slate-300 font-mono leading-relaxed">
            {active.content}
          </pre>
        )}
      </div>
    </div>
  );
}