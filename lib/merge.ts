import { radialLayout } from "./layout";
import type { MergeDelta, SavedMap } from "./types";

function rewriteEndpoint(id: string, memoId: string, newIds: Set<string>): string {
  return newIds.has(id) ? `${memoId}-${id}` : id;
}

export function prefixNodeIds(delta: MergeDelta, memoId: string): MergeDelta {
  const newIds = new Set(delta.nodes.map((n) => n.id));

  return {
    nodes: delta.nodes.map((n) => ({
      ...n,
      id: `${memoId}-${n.id}`,
      isRoot: false,
    })),
    edges: delta.edges.map((e) => ({
      source: rewriteEndpoint(e.source, memoId, newIds),
      target: rewriteEndpoint(e.target, memoId, newIds),
      label: e.label,
    })),
  };
}

function edgeKey(
  source: string,
  target: string,
  label?: string
): string {
  return `${source}\0${target}\0${label ?? ""}`;
}

export function mergeGraph(
  existing: SavedMap,
  delta: MergeDelta
): Pick<SavedMap, "edges"> {
  const seenEdges = new Set(
    existing.edges.map((e) => edgeKey(e.source, e.target, e.label))
  );

  const newEdges = delta.edges
    .filter((e) => !seenEdges.has(edgeKey(e.source, e.target, e.label)))
    .map((e, i) => ({
      id: `e-${e.source}-${e.target}-${Date.now()}-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
    }));

  return {
    edges: [...existing.edges, ...newEdges],
  };
}

function boundingBox(nodes: SavedMap["nodes"]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }

  return { minX, maxX, minY, maxY };
}

export function mergeLayout(
  existingNodes: SavedMap["nodes"],
  newNodes: MergeDelta["nodes"],
  newEdges: MergeDelta["edges"],
  memoIndex: number
): SavedMap["nodes"] {
  if (newNodes.length === 0) {
    return existingNodes;
  }

  const laidOut = radialLayout({ nodes: newNodes, edges: newEdges });
  const box = boundingBox(existingNodes);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  const radius = Math.max(width, height) / 2 + 320;
  const angle = ((memoIndex * 72) % 360) * (Math.PI / 180);
  const anchorX = Math.round(centerX + Math.cos(angle) * radius);
  const anchorY = Math.round(centerY + Math.sin(angle) * radius);

  const positionedNew = laidOut.nodes.map((n) => ({
    ...n,
    x: n.x + anchorX,
    y: n.y + anchorY,
  }));

  return [...existingNodes, ...positionedNew];
}
