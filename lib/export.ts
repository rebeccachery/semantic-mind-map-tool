import type { SavedMap } from "./types";

/**
 * Exports the mind map data to a JSON file.
 */
export function exportToJSON(nodes: SavedMap["nodes"], edges: SavedMap["edges"]) {
  const data = {
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = `mind-map-${Date.now()}.json`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(url);
}

/**
 * Exports the mind map to a structured Markdown outline.
 */
export function exportToMarkdown(nodes: SavedMap["nodes"], edges: SavedMap["edges"]) {
  // Build adjacency list for traversal: source -> target with edge label
  const adj = new Map<string, Array<{ target: string; label?: string }>>();
  const inDegree = new Map<string, number>();

  // Initialize inDegrees
  nodes.forEach((n) => inDegree.set(n.id, 0));

  edges.forEach((e) => {
    if (!adj.has(e.source)) {
      adj.set(e.source, []);
    }
    adj.get(e.source)!.push({ target: e.target, label: e.label });
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  });

  // Find starting/root nodes (explicit roots, or nodes with no incoming edges)
  const rootNodes = nodes.filter((n) => n.isRoot);
  const entryNodes = rootNodes.length > 0 
    ? rootNodes 
    : nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);

  // If everything is in a cycle or we have no nodes with 0 in-degree, default to the first node
  const starters = entryNodes.length > 0 ? entryNodes : (nodes.length > 0 ? [nodes[0]] : []);

  const visited = new Set<string>();
  let markdown = "# Mind Map Outline\n\n";

  function traverse(nodeId: string, depth: number, edgeLabel?: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const indent = "  ".repeat(depth);
    const relation = edgeLabel ? ` *(relation: ${edgeLabel})*` : "";
    markdown += `${indent}- ${node.label}${relation}\n`;

    const children = adj.get(nodeId) ?? [];
    children.forEach((child) => {
      traverse(child.target, depth + 1, child.label);
    });
  }

  // Traverse hierarchy
  starters.forEach((s) => {
    traverse(s.id, 0);
  });

  // Include any orphaned/unconnected nodes
  const orphans = nodes.filter((n) => !visited.has(n.id));
  if (orphans.length > 0) {
    markdown += "\n## Unconnected / Additional Ideas\n\n";
    orphans.forEach((o) => {
      markdown += `- ${o.label}\n`;
    });
  }

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = `mind-map-${Date.now()}.md`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(url);
}
