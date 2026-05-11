# Semantic Audio Map

A small Next.js prototype that turns a voice memo into an editable mind map.

1. Record audio in the browser (or upload an audio file).
2. The audio is sent to OpenAI Whisper for transcription.
3. GPT extracts the key ideas + relationships as a JSON graph.
4. The graph is rendered with [React Flow](https://reactflow.dev) so you can
   drag nodes around, double-click to rename, drag between handles to add
   connections, and select + Backspace to delete.

The current map is auto-saved to `localStorage` in your browser — refresh and
your work is still there.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- `@xyflow/react` for the mind map canvas
- `openai` SDK (Whisper for transcription, `gpt-4o-mini` with JSON-schema
  structured outputs for idea extraction)

## Getting started

You need Node.js 20+ and an OpenAI API key.

```bash
npm install
```

Create a `.env.local` at the project root:

```bash
OPENAI_API_KEY=sk-...your-key...
```

Then run the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>, click **Record**, speak for ~10–60 seconds, hit
**Stop**, then **Use this recording**. After a few seconds you should see your
mind map.

## Editing the map

- **Rename**: double-click any node, type, press `Enter`.
- **Connect**: drag from the small dot at the bottom of one node to the dot at
  the top of another.
- **Delete**: select a node or edge and press `Backspace` or `Delete`.
- **Re-arrange**: drag nodes anywhere on the canvas.
- **New map**: click **New map** in the header to clear and start over.

## Project layout

```
app/
  page.tsx                  Main UI: orchestrates record -> transcribe -> extract -> render
  api/transcribe/route.ts   POST audio -> { text } via OpenAI Whisper
  api/extract/route.ts      POST text -> { nodes, edges } via GPT structured output
components/
  Recorder.tsx              MediaRecorder + file upload
  MindMap.tsx               React Flow canvas
  EditableNode.tsx          Custom node with inline rename
lib/
  openai.ts                 Shared OpenAI client
  layout.ts                 Radial auto-layout for fresh maps
  storage.ts                localStorage helpers
  types.ts                  Shared types
```

## Notes / known limitations

- Single-user, single-map prototype. There's no auth and no server-side DB.
- Audio is sent to OpenAI; nothing else is stored remotely.
- Browser support for `MediaRecorder` with `audio/webm` is required for
  recording. Uploads accept any format Whisper supports (mp3, m4a, wav, etc.).
- For voice memos longer than ~5 minutes, transcription can take a while; the
  serverless `maxDuration` is set to 60s.

## Useful follow-ups

- Export the map (PNG / JSON / Markdown).
- Merge multiple memos into one growing map.
- Server-side persistence + auth.
- Streaming transcription for long-form content.
