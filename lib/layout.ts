import type { ExtractedMap, SavedMap } from "./types";

/**
 * Radial layout: root node at the center, other nodes arranged on a circle.
 * If there are many nodes, splits them across two concentric rings.
 */
export function radialLayout(map: ExtractedMap): SavedMap {
  const root = map.nodes.find((n) => n.isRoot) ?? map.nodes[0];
  const others = map.nodes.filter((n) => n.id !== root?.id);

  const positions = new Map<string, { x: number; y: number }>();

  if (root) positions.set(root.id, { x: 0, y: 0 });

  const ringSize = 8;
  const radii = [260, 460];

  others.forEach((node, index) => {
    const ring = Math.floor(index / ringSize);
    const radius = radii[Math.min(ring, radii.length - 1)];
    const inRing = others.length > ringSize ? ringSize : others.length;
    const offset = ring % 2 === 0 ? 0 : Math.PI / inRing;
    const angle = ((index % ringSize) / inRing) * Math.PI * 2 + offset;
    positions.set(node.id, {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    });
  });

  const nodes: SavedMap["nodes"] = map.nodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      label: n.label,
      isRoot: n.isRoot,
      x: pos.x,
      y: pos.y,
    };
  });

  const edges: SavedMap["edges"] = map.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label && e.label.trim().length > 0 ? e.label : undefined,
  }));

  return {
    transcript: "",
    memos: [],
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}
