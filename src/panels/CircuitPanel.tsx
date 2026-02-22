import { useCallback, useEffect, useRef } from "react";
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
  ConnectionMode,
  ConnectionLineType,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCircuitStore } from "@/store/circuitStore";
import { PlacedComponent } from "@/types/circuit";
import ComponentSidebar from "@/components/circuit/ComponentSidebar";
import PropertiesPanel from "@/components/circuit/PropertiesPanel";
import ComponentNode from "@/components/circuit/ComponentNode";
import { DnDProvider, useDnD } from "@/context/DnDContext";

// CRITICAL: nodeTypes must be defined outside the component
const nodeTypes = { componentNode: ComponentNode };

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  style: { stroke: "#3b82f6", strokeWidth: 2 },
  animated: false,
};

function CircuitCanvas() {
  const { addComponent, selectComponent } = useCircuitStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();
  const {
    draggedDefinition,
    setDraggedDefinition,
    isDragging,
    setIsDragging,
    setMousePos,
  } = useDnD();
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!draggedDefinition || !canvasRef.current) {
        setIsDragging(false);
        setDraggedDefinition(null);
        return;
      }

      const bounds = canvasRef.current.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= bounds.left &&
        e.clientX <= bounds.right &&
        e.clientY >= bounds.top &&
        e.clientY <= bounds.bottom;

      if (isOverCanvas) {
        const position = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

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

        addComponent(draggedDefinition, position);
        setNodes((nds) => [...nds, newNode]);
      }

      setIsDragging(false);
      setDraggedDefinition(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    isDragging,
    draggedDefinition,
    screenToFlowPosition,
    addComponent,
    setNodes,
    setIsDragging,
    setDraggedDefinition,
    setMousePos,
  ]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => selectComponent(node.id),
    [selectComponent]
  );

  const onPaneClick = useCallback(
    () => selectComponent(null),
    [selectComponent]
  );

  return (
    <div className="h-full flex">
      <ComponentSidebar />

      <div className="flex-1 relative" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{ stroke: "#3b82f6", strokeWidth: 2 }}
          snapToGrid
          snapGrid={[16, 16]}
          colorMode="dark"
          deleteKeyCode="Delete"
          elevateEdgesOnSelect
          fitView={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#334155"
          />
          <Controls />
          <MiniMap
            nodeColor="#1d4ed8"
            maskColor="rgba(15, 23, 42, 0.7)"
          />
        </ReactFlow>

        {/* Drag ghost */}
        {isDragging && draggedDefinition && (
          <div className="fixed pointer-events-none z-50 bg-blue-600 text-white text-xs px-3 py-1.5 rounded shadow-lg opacity-80 top-1/2 left-1/2">
            + {draggedDefinition.name}
          </div>
        )}
      </div>

      <PropertiesPanel />
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