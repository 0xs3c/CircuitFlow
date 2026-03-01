import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  ConnectionMode,
  ConnectionLineType,
  MarkerType,
  useOnSelectionChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCircuitStore } from "@/store/circuitStore";
import { useProjectStore } from "@/store/projectStore";
import { saveProject } from "@/lib/projectService";
import { PlacedComponent } from "@/types/circuit";
import ComponentSidebar from "@/components/circuit/ComponentSidebar";
import PropertiesPanel from "@/components/circuit/PropertiesPanel";
import ComponentNode from "@/components/circuit/ComponentNode";
import CommentNode from "@/components/circuit/CommentNode";
import CircuitToolbar, { ToolMode } from "@/components/circuit/CircuitToolbar";
import ContextMenu, {
  componentContextItems,
  canvasContextItems,
  wireContextItems,
} from "@/components/circuit/ContextMenu";
import ShortcutsModal from "@/components/circuit/ShortcutsModal";
import ValidationPanel from "@/components/circuit/ValidationPanel";
import { validateCircuit, ValidationResult } from "@/lib/validateCircuit";
import { DnDProvider, useDnD } from "@/context/DnDContext";

// ── Node types — must be defined outside the component ───────────────────────
const nodeTypes = {
  componentNode: ComponentNode,
  commentNode: CommentNode,
};

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  style: { stroke: "#3b82f6", strokeWidth: 2 },
};

// ── Context menu state ────────────────────────────────────────────────────────
interface CtxMenu {
  x: number;
  y: number;
  type: "node" | "edge" | "canvas";
  targetId?: string;
  flowPos?: { x: number; y: number };
}

// ── Strip non-serializable data before saving ─────────────────────────────────
function serializeNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type === "commentNode") {
      const { onDelete, onTextChange, ...rest } = n.data as any;
      return { ...n, data: rest };
    }
    return n;
  });
}

// ── Restore callbacks after loading ──────────────────────────────────────────
function restoreNodes(
  nodes: Node[],
  setNodes: (fn: (nds: Node[]) => Node[]) => void
): Node[] {
  return nodes.map((n) => {
    if (n.type === "commentNode") {
      return {
        ...n,
        data: {
          ...n.data,
          onDelete: (nodeId: string) => {
            setNodes((nds) => nds.filter((nd) => nd.id !== nodeId));
          },
          onTextChange: (nodeId: string, text: string) => {
            setNodes((nds) =>
              nds.map((nd) =>
                nd.id === nodeId ? { ...nd, data: { ...nd.data, text } } : nd
              )
            );
          },
        },
      };
    }
    return n;
  });
}

function CircuitCanvas() {
  const { addComponent, selectComponent } = useCircuitStore();
  const { currentProject, setCurrentProject, updateProjectCanvas } = useProjectStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  // Toolbar state
  const [toolMode, setToolMode]     = useState<ToolMode>("select");
  const [showGrid, setShowGrid]     = useState(true);
  const [snapGrid, setSnapGrid]     = useState(true);
  const [saving, setSaving]         = useState(false);
  const [validating, setValidating] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Validation
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture]   = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Clipboard
  const [clipboard, setClipboard] = useState<Node[]>([]);

  // Selected nodes
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const { draggedDefinition, setDraggedDefinition, setIsDragging, isDragging } = useDnD();

  // Track selection
  useOnSelectionChange({
    onChange: ({ nodes }) => setSelectedNodes(nodes),
  });

  // ── Load canvas when project opens ───────────────────────────────────────
  useEffect(() => {
    if (!currentProject) return;
    const savedNodes = (currentProject.canvas_nodes ?? []) as Node[];
    const savedEdges = (currentProject.canvas_edges ?? []) as Edge[];
    const restored = restoreNodes(savedNodes, setNodes);
    setNodes(restored);
    setEdges(savedEdges);
    setHistory([]);
    setFuture([]);
    setValidationResult(null);
  }, [currentProject?.id]);

  // ── Clear validation when canvas changes ─────────────────────────────────
  useEffect(() => {
    setValidationResult(null);
  }, [nodes.length, edges.length]);

  // ── History helpers ───────────────────────────────────────────────────────
  const pushHistory = useCallback((n: Node[], e: Edge[]) => {
    setHistory((h) => [...h.slice(-49), { nodes: n, edges: e }]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [{ nodes, edges }, ...f.slice(0, 49)]);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      return h.slice(0, -1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, { nodes, edges }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return f.slice(1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  // ── Drag-drop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = () => {};
    const onMouseUp = (e: MouseEvent) => {
      if (!draggedDefinition || !canvasRef.current) {
        setIsDragging(false); setDraggedDefinition(null); return;
      }
      const bounds = canvasRef.current.getBoundingClientRect();
      const over = e.clientX >= bounds.left && e.clientX <= bounds.right
                && e.clientY >= bounds.top  && e.clientY <= bounds.bottom;
      if (over) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const instanceId = `${draggedDefinition.id}-${Date.now()}`;
        const placedComponent: PlacedComponent = {
          instanceId,
          definitionId: draggedDefinition.id,
          definition: draggedDefinition,
          position,
          label: draggedDefinition.name,
        };
        const newNode: Node = {
          id: instanceId,
          type: "componentNode",
          position,
          data: { component: placedComponent },
        };
        pushHistory(nodes, edges);
        addComponent(draggedDefinition, position);
        setNodes((nds) => [...nds, newNode]);
      }
      setIsDragging(false); setDraggedDefinition(null);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, draggedDefinition, nodes, edges, screenToFlowPosition, addComponent, setNodes, pushHistory, setIsDragging, setDraggedDefinition]);

  // ── Connections ───────────────────────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    pushHistory(nodes, edges);
    setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds));
  }, [nodes, edges, setEdges, pushHistory]);

  // ── Delete selected ───────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    pushHistory(nodes, edges);
    setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((eds) => eds.filter(
      (e) => !selectedEdgeIds.has(e.id)
           && !selectedNodeIds.has(e.source)
           && !selectedNodeIds.has(e.target)
    ));
  }, [selectedNodes, nodes, edges, setNodes, setEdges, pushHistory]);

  // ── Add comment ───────────────────────────────────────────────────────────
  const addComment = useCallback((color: string, position?: { x: number; y: number }) => {
    const pos = position ?? screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const id = `comment-${Date.now()}`;
    const newNode: Node = {
      id,
      type: "commentNode",
      position: pos,
      data: {
        color,
        text: "",
        onDelete: (nodeId: string) => {
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        },
        onTextChange: (nodeId: string, text: string) => {
          setNodes((nds) =>
            nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, text } } : n)
          );
        },
      },
    };
    pushHistory(nodes, edges);
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, edges, screenToFlowPosition, setNodes, pushHistory]);

  // ── Duplicate selected ────────────────────────────────────────────────────
  const duplicateSelected = useCallback(() => {
    if (selectedNodes.length === 0) return;
    pushHistory(nodes, edges);
    const duped = selectedNodes.map((n) => ({
      ...n,
      id: `${n.id}-copy-${Date.now()}`,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: false,
    }));
    setNodes((nds) => [...nds, ...duped]);
  }, [selectedNodes, nodes, edges, setNodes, pushHistory]);

  // ── Select all ────────────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setNodes]);

  // ── Highlight node (from validation) ─────────────────────────────────────
  const highlightNode = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, selected: n.id === nodeId }))
    );
  }, [setNodes]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await saveProject(currentProject.id, serializeNodes(nodes), edges);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [currentProject, nodes, edges]);

  // ── Sync canvas to store immediately so other tabs see changes ────────────
  useEffect(() => {
    if (!currentProject) return;
    updateProjectCanvas(serializeNodes(nodes), edges);
  }, [nodes, edges]);

  // ── Auto-save every 5 seconds ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentProject) return;
    const interval = setInterval(() => {
      saveProject(currentProject.id, serializeNodes(nodes), edges)
        .catch(console.error);
    }, 5_000);
    return () => clearInterval(interval);
  }, [currentProject, nodes, edges]);

  // ── Validate ─────────────────────────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    setValidating(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = validateCircuit(nodes, edges);
    setValidationResult(result);
    setValidating(false);
  }, [nodes, edges]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT"
                   || target.tagName === "TEXTAREA"
                   || target.isContentEditable;
      if (isInput) return;

      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (meta && e.key === "z" &&  e.shiftKey) { e.preventDefault(); redo(); }
      if (meta && e.key === "s")                { e.preventDefault(); handleSave(); }
      if (meta && e.key === "a")                { e.preventDefault(); selectAll(); }
      if (meta && e.key === "d")                { e.preventDefault(); duplicateSelected(); }
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "f" || e.key === "F")       fitView({ duration: 400 });
      if (e.key === "g" || e.key === "G")       setShowGrid((v) => !v);
      if (e.key === "v" || e.key === "V")       setToolMode("select");
      if (e.key === "h" || e.key === "H")       setToolMode("pan");
      if (e.key === "c" && !meta)               addComment("yellow");
      if (e.key === "?")                        setShowShortcuts((v) => !v);
      if (e.key === "=" || e.key === "+")       zoomIn();
      if (e.key === "-")                        zoomOut();
      if (e.key === "Escape") {
        setCtxMenu(null);
        setShowShortcuts(false);
        setValidationResult(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo, handleSave, selectAll, duplicateSelected, deleteSelected, fitView, addComment, zoomIn, zoomOut]);

  // ── Context menus ─────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "node", targetId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "edge", targetId: edge.id });
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "canvas", flowPos });
  }, [screenToFlowPosition]);

  const ctxMenuItems = useCallback(() => {
    if (!ctxMenu) return [];
    if (ctxMenu.type === "node") {
      return componentContextItems({
        onDelete: () => {
          pushHistory(nodes, edges);
          setNodes((nds) => nds.filter((n) => n.id !== ctxMenu.targetId));
          setEdges((eds) => eds.filter(
            (e) => e.source !== ctxMenu.targetId && e.target !== ctxMenu.targetId
          ));
        },
        onDuplicate: duplicateSelected,
        onAddComment: () => addComment("yellow"),
      });
    }
    if (ctxMenu.type === "edge") {
      return wireContextItems({
        onDelete: () => {
          pushHistory(nodes, edges);
          setEdges((eds) => eds.filter((e) => e.id !== ctxMenu.targetId));
        },
        onLabel: () => {},
      });
    }
    return canvasContextItems({
      onAddComment: () => addComment("yellow", ctxMenu.flowPos),
      onFitView: () => fitView({ duration: 400 }),
      onSelectAll: selectAll,
      onPaste: () => {},
      hasPaste: clipboard.length > 0,
    });
  }, [ctxMenu, nodes, edges, setNodes, setEdges, pushHistory, duplicateSelected, addComment, fitView, selectAll, clipboard]);

  return (
    <div className="h-full flex flex-col">
      {/* Secondary toolbar */}
      <CircuitToolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        snapToGrid={snapGrid}
        onToggleSnap={() => setSnapGrid((v) => !v)}
        onFitView={() => fitView({ duration: 400 })}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onAddComment={addComment}
        onValidate={handleValidate}
        onSave={handleSave}
        onShowShortcuts={() => setShowShortcuts(true)}
        onOpenDashboard={() => setCurrentProject(null)}
        projectName={currentProject?.name ?? "Untitled"}
        saving={saving}
        validating={validating}
      />

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <ComponentSidebar />

        <div className="flex-1 relative" ref={canvasRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => selectComponent(node.id)}
            onPaneClick={() => { selectComponent(null); setCtxMenu(null); }}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
            panOnDrag={toolMode === "pan"}
            selectionOnDrag={toolMode === "select"}
            snapToGrid={snapGrid}
            snapGrid={[16, 16]}
            colorMode="dark"
            deleteKeyCode={null}
            elevateEdgesOnSelect
            fitView={false}
          >
            <Background
              variant={showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines}
              gap={24}
              size={showGrid ? 1 : 0}
              color="#334155"
            />
            <Controls />
            <MiniMap nodeColor="#1d4ed8" maskColor="rgba(15,23,42,0.7)" />
          </ReactFlow>

          {/* Context menu */}
          {ctxMenu && (
            <ContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              items={ctxMenuItems()}
              onClose={() => setCtxMenu(null)}
            />
          )}

          {/* Validation panel — overlays bottom of canvas */}
          {validationResult && (
            <ValidationPanel
              result={validationResult}
              onClose={() => setValidationResult(null)}
              onHighlightNode={highlightNode}
            />
          )}
        </div>

        <PropertiesPanel />
      </div>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

export default function CircuitPanel() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <CircuitCanvas />
      </DnDProvider>
    </ReactFlowProvider>
  );
}