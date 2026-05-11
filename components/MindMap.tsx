"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import EditableNode, { type EditableNodeData } from "./EditableNode";
import type { SavedMap } from "@/lib/types";

type FlowNode = Node<EditableNodeData>;

export type MindMapValue = {
  nodes: SavedMap["nodes"];
  edges: SavedMap["edges"];
};

type MindMapProps = {
  /** Bumped whenever the parent supplies a fresh map and wants to reset state. */
  resetKey: string | number;
  initialNodes: SavedMap["nodes"];
  initialEdges: SavedMap["edges"];
  onChange?: (value: MindMapValue) => void;
};

const LabelChangeContext = createContext<(id: string, label: string) => void>(
  () => {}
);

export function useLabelChange() {
  return useContext(LabelChangeContext);
}

function buildFlowNodes(input: SavedMap["nodes"]): FlowNode[] {
  return input.map((n) => ({
    id: n.id,
    type: "editable",
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      isRoot: n.isRoot,
    },
  }));
}

function buildFlowEdges(input: SavedMap["edges"]): Edge[] {
  return input.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
  }));
}

function MindMapInner({
  initialNodes,
  initialEdges,
  onChange,
}: Omit<MindMapProps, "resetKey">) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    buildFlowNodes(initialNodes)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    buildFlowEdges(initialEdges)
  );

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n
        )
      );
    },
    [setNodes]
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, id: `e-${params.source}-${params.target}-${Date.now()}` },
          eds
        )
      ),
    [setEdges]
  );

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      editable: EditableNode as unknown as NodeTypes[string],
    }),
    []
  );

  useEffect(() => {
    if (!onChange) return;
    const value: MindMapValue = {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.data.label,
        isRoot: n.data.isRoot,
        x: n.position.x,
        y: n.position.y,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
    };
    onChange(value);
  }, [nodes, edges, onChange]);

  return (
    <LabelChangeContext.Provider value={handleLabelChange}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </LabelChangeContext.Provider>
  );
}

export default function MindMap({ resetKey, ...rest }: MindMapProps) {
  // Remounting via key gives us a clean slate whenever the parent loads a new map.
  return (
    <ReactFlowProvider>
      <MindMapInner key={resetKey} {...rest} />
    </ReactFlowProvider>
  );
}
