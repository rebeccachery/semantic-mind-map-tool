import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import type { MergeDelta } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EXISTING_NODES = 40;

const SYSTEM_PROMPT = `You merge a new spoken voice memo into an existing semantic mind map.

Rules:
- The existing map already has a ROOT node. Do NOT create a new root or duplicate existing ideas.
- Add ONLY new IDEA nodes for concepts in the new transcript that are not already represented in the existing map (minor wording differences count as duplicates).
- Return new nodes only in the "nodes" array. Edge sources/targets may reference existing node ids OR new node ids.
- Prefer connecting new ideas to the most related existing node when appropriate; also connect new nodes to each other when clearly related.
- Each new node label must be 2-5 words, title case, no trailing punctuation.
- New node ids must be short slugs (lowercase, hyphens). Do not reuse existing node ids.
- Optional edge labels should be 1-3 words describing the relationship. Omit when not informative.
- Do not invent content not implied by the new transcript.
- If the new transcript adds no genuinely new ideas, return empty nodes and edges arrays.`;

const SCHEMA = {
  name: "merge_delta",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["nodes", "edges"],
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label", "isRoot"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            isRoot: { type: "boolean" },
          },
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["source", "target", "label"],
          properties: {
            source: { type: "string" },
            target: { type: "string" },
            label: { type: "string" },
          },
        },
      },
    },
  },
} as const;

type ExistingNode = { id: string; label: string; isRoot?: boolean };
type ExistingEdge = { source: string; target: string; label?: string };

function capExistingContext(
  nodes: ExistingNode[],
  edges: ExistingEdge[]
): { nodes: ExistingNode[]; edges: ExistingEdge[]; truncated: boolean } {
  if (nodes.length <= MAX_EXISTING_NODES) {
    return { nodes, edges, truncated: false };
  }

  const root = nodes.find((n) => n.isRoot);
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const ranked = [...nodes]
    .filter((n) => n.id !== root?.id)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

  const kept = root
    ? [root, ...ranked.slice(0, MAX_EXISTING_NODES - 1)]
    : ranked.slice(0, MAX_EXISTING_NODES);
  const keptIds = new Set(kept.map((n) => n.id));
  const keptEdges = edges.filter(
    (e) => keptIds.has(e.source) && keptIds.has(e.target)
  );

  return { nodes: kept, edges: keptEdges, truncated: true };
}

function formatExistingMap(
  nodes: ExistingNode[],
  edges: ExistingEdge[],
  truncated: boolean
): string {
  const nodeLines = nodes
    .map((n) => `- id: ${n.id}, label: "${n.label}"${n.isRoot ? " (ROOT)" : ""}`)
    .join("\n");
  const edgeLines =
    edges.length > 0
      ? edges
          .map(
            (e) =>
              `- ${e.source} -> ${e.target}${e.label ? ` (${e.label})` : ""}`
          )
          .join("\n")
      : "(none)";

  const truncationNote = truncated
    ? "\n(Note: only the most connected nodes are shown; other nodes exist in the full map.)"
    : "";

  return `Existing nodes:\n${nodeLines}\n\nExisting edges:\n${edgeLines}${truncationNote}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string;
      existing?: {
        nodes?: ExistingNode[];
        edges?: ExistingEdge[];
      };
    };

    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Missing 'text' in request body." },
        { status: 400 }
      );
    }

    const existingNodes = body.existing?.nodes ?? [];
    const existingEdges = body.existing?.edges ?? [];
    if (existingNodes.length === 0) {
      return NextResponse.json(
        { error: "Missing 'existing.nodes' — use /api/extract for the first memo." },
        { status: 400 }
      );
    }

    const { nodes: cappedNodes, edges: cappedEdges, truncated } =
      capExistingContext(existingNodes, existingEdges);

    const openai = getOpenAI();
    const existingSummary = formatExistingMap(
      cappedNodes,
      cappedEdges,
      truncated
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${existingSummary}\n\nNew transcript:\n"""\n${text}\n"""`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: SCHEMA,
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Model returned an empty response." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw) as MergeDelta;

    const existingIds = new Set(existingNodes.map((n) => n.id));
    const newNodes = parsed.nodes
      .filter((n) => !n.isRoot)
      .filter((n) => !existingIds.has(n.id));

    const newIds = new Set(newNodes.map((n) => n.id));
    const validIds = new Set([...existingIds, ...newIds]);

    const edges = parsed.edges
      .filter(
        (e) =>
          validIds.has(e.source) &&
          validIds.has(e.target) &&
          e.source !== e.target
      )
      .map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label?.trim() ? e.label.trim() : undefined,
      }));

    return NextResponse.json({
      nodes: newNodes,
      edges,
    } satisfies MergeDelta);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to merge mind map.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
