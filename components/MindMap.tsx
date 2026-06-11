"use client";

import {
  Background,
  Controls,
  MiniMap,
  Panel,
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
  useRef,
  useState,
} from "react";
import EditableNode, { type EditableNodeData } from "./EditableNode";
import type { SavedMap } from "@/lib/types";
import { exportToJSON, exportToMarkdown } from "@/lib/export";
import { toPng } from "html-to-image";

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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as any)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        
        <Panel position="top-right" className="flex flex-col items-end">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-md transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-zinc-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 z-50">
                <button
                  type="button"
                  onClick={() => {
                    exportToJSON(
                      nodes.map((n) => ({
                        id: n.id,
                        label: n.data.label,
                        isRoot: n.data.isRoot,
                        x: n.position.x,
                        y: n.position.y,
                      })),
                      edges.map((e) => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        label: typeof e.label === "string" ? e.label : undefined,
                      }))
                    );
                    setDropdownOpen(false);
                  }}
                  className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 transition"
                >
                  <span className="text-sm">📄</span>
                  Export as JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportToMarkdown(
                      nodes.map((n) => ({
                        id: n.id,
                        label: n.data.label,
                        isRoot: n.data.isRoot,
                        x: n.position.x,
                        y: n.position.y,
                      })),
                      edges.map((e) => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        label: typeof e.label === "string" ? e.label : undefined,
                      }))
                    );
                    setDropdownOpen(false);
                  }}
                  className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 transition"
                >
                  <span className="text-sm">📝</span>
                  Export as Markdown
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement;
                    if (viewportEl) {
                      const isDark = document.documentElement.classList.contains("dark");
                      toPng(viewportEl, {
                        backgroundColor: isDark ? "#09090b" : "#fafafa",
                      })
                        .then((dataUrl) => {
                          const link = document.createElement("a");
                          link.download = `mind-map-${Date.now()}.png`;
                          link.href = dataUrl;
                          link.click();
                        })
                        .catch((err) => {
                          console.error("Failed to export image", err);
                        });
                    }
                    setDropdownOpen(false);
                  }}
                  className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 transition"
                >
                  <span className="text-sm">🖼️</span>
                  Export as PNG Image
                </button>
              </div>
            )}
          </div>
        </Panel>
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
