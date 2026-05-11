import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import type { ExtractedMap } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You turn a spoken voice memo transcript into a small semantic mind map.

Rules:
- Pick exactly one ROOT node that summarizes the overall topic in 2-5 words.
- Add 4 to 10 IDEA nodes for the most important concepts, plans, questions, or decisions in the memo.
- Each node label must be 2-5 words, in title case, with no trailing punctuation.
- Connect ideas to the root or to each other when they are clearly related; aim for a tree-like shape with a few cross-links allowed.
- Optional edge labels should be 1-3 words describing the relationship (e.g. "supports", "blocks", "example of"). Omit when not informative.
- Node ids must be short slugs (lowercase, hyphens). Edge sources/targets must reference existing node ids.
- Do not invent content not implied by the transcript.`;

const SCHEMA = {
  name: "mind_map",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["nodes", "edges"],
    properties: {
      nodes: {
        type: "array",
        minItems: 2,
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Missing 'text' in request body." },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcript:\n"""\n${text}\n"""`,
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

    const parsed = JSON.parse(raw) as ExtractedMap;

    const ids = new Set(parsed.nodes.map((n) => n.id));
    const edges = parsed.edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target
    );

    const hasRoot = parsed.nodes.some((n) => n.isRoot);
    if (!hasRoot && parsed.nodes.length > 0) {
      parsed.nodes[0].isRoot = true;
    }

    return NextResponse.json({
      nodes: parsed.nodes,
      edges,
    } satisfies ExtractedMap);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to extract mind map.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
