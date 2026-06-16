export type MindMapNode = {
  id: string;
  label: string;
  isRoot?: boolean;
};

export type MindMapEdge = {
  source: string;
  target: string;
  label?: string;
};

export type ExtractedMap = {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};

export type MemoEntry = {
  id: string;
  transcript: string;
  addedAt: number;
};

export type MergeDelta = {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
};

export type SavedMap = {
  transcript: string;
  memos: MemoEntry[];
  nodes: Array<{
    id: string;
    label: string;
    isRoot?: boolean;
    x: number;
    y: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
  updatedAt: number;
};
