"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Recorder from "@/components/Recorder";
import MindMap, { type MindMapValue } from "@/components/MindMap";
import { radialLayout } from "@/lib/layout";
import { mergeGraph, mergeLayout, prefixNodeIds } from "@/lib/merge";
import { clearMap, joinTranscripts, loadMap, saveMap } from "@/lib/storage";
import type { ExtractedMap, MergeDelta, SavedMap } from "@/lib/types";

type Status =
  | { kind: "idle" }
  | { kind: "transcribing" }
  | { kind: "extracting" }
  | { kind: "merging" }
  | { kind: "ready" }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

export default function Home() {
  const [map, setMap] = useState<SavedMap | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showTranscript, setShowTranscript] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [syncKey, setSyncKey] = useState(0);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const restored = loadMap();
    if (restored && restored.nodes.length > 0) {
      // localStorage isn't available during SSR, so we hydrate state on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMap(restored);
      setStatus({ kind: "ready" });
    }
    hydratedRef.current = true;
  }, []);

  const handleMapChange = useCallback((value: MindMapValue) => {
    setMap((prev) => {
      if (!prev) return prev;
      const memos = prev.memos ?? [];
      const next: SavedMap = {
        transcript: joinTranscripts(memos),
        memos,
        nodes: value.nodes,
        edges: value.edges,
        updatedAt: Date.now(),
      };
      saveMap(next);
      return next;
    });
  }, []);

  async function handleAudio(file: File) {
    setStatus({ kind: "transcribing" });
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      if (!transcribeRes.ok) {
        const err = await transcribeRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Transcription failed.");
      }
      const { text } = (await transcribeRes.json()) as { text: string };
      if (!text || !text.trim()) {
        throw new Error("Transcription returned no text. Try a longer clip.");
      }

      if (!map || map.nodes.length === 0) {
        setStatus({ kind: "extracting" });
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!extractRes.ok) {
          const err = await extractRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Idea extraction failed.");
        }
        const extracted = (await extractRes.json()) as ExtractedMap;

        const laidOut = radialLayout(extracted);
        const memoId = `memo-${Date.now()}`;
        const memos = [{ id: memoId, transcript: text, addedAt: Date.now() }];
        const next: SavedMap = {
          ...laidOut,
          memos,
          transcript: joinTranscripts(memos),
        };
        setMap(next);
        saveMap(next);
        setResetKey((k) => k + 1);
        setStatus({ kind: "ready" });
        return;
      }

      setStatus({ kind: "merging" });
      const mergeRes = await fetch("/api/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          existing: {
            nodes: map.nodes.map(({ id, label, isRoot }) => ({
              id,
              label,
              isRoot,
            })),
            edges: map.edges.map(({ source, target, label }) => ({
              source,
              target,
              label,
            })),
          },
        }),
      });
      if (!mergeRes.ok) {
        const err = await mergeRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Merge failed.");
      }
      const delta = (await mergeRes.json()) as MergeDelta;

      if (delta.nodes.length === 0) {
        setStatus({
          kind: "info",
          message: "No new ideas to add — your map already covers this memo.",
        });
        return;
      }

      const memoId = `memo-${Date.now()}`;
      const prefixed = prefixNodeIds(delta, memoId);
      const merged = mergeGraph(map, prefixed);
      const memoIndex = (map.memos ?? []).length;
      const nodes = mergeLayout(
        map.nodes,
        prefixed.nodes,
        prefixed.edges,
        memoIndex
      );
      const memos = [
        ...(map.memos ?? []),
        { id: memoId, transcript: text, addedAt: Date.now() },
      ];
      const next: SavedMap = {
        transcript: joinTranscripts(memos),
        memos,
        nodes,
        edges: merged.edges,
        updatedAt: Date.now(),
      };
      setMap(next);
      saveMap(next);
      setSyncKey((k) => k + 1);
      setStatus({ kind: "ready" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong.";
      setStatus({ kind: "error", message });
    }
  }

  function handleClear() {
    clearMap();
    setMap(null);
    setStatus({ kind: "idle" });
    setShowTranscript(false);
    setResetKey((k) => k + 1);
  }

  const busy =
    status.kind === "transcribing" ||
    status.kind === "extracting" ||
    status.kind === "merging";

  const memoCount = map?.memos?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/70 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Semantic Audio Map
              </h1>
              {memoCount > 1 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {memoCount} memos
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {map && map.nodes.length > 0
                ? "Record another memo to grow this map."
                : "Record a voice memo and watch it become an editable mind map."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {map && (
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                New map
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl">
          <Recorder onAudio={handleAudio} disabled={busy} />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {status.kind === "transcribing" && (
              <Spinner label="Transcribing audio..." />
            )}
            {status.kind === "extracting" && (
              <Spinner label="Extracting ideas..." />
            )}
            {status.kind === "merging" && (
              <Spinner label="Merging into map..." />
            )}
            {status.kind === "error" && (
              <p className="text-red-600 dark:text-red-400">{status.message}</p>
            )}
            {status.kind === "info" && (
              <p className="text-amber-700 dark:text-amber-400">
                {status.message}
              </p>
            )}
            {memoCount > 0 && (
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                {showTranscript ? "Hide" : "Show"} transcript
                {memoCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
          {showTranscript && map?.memos && map.memos.length > 0 && (
            <div className="mt-3 max-h-48 space-y-3 overflow-auto">
              {map.memos.map((memo, index) => (
                <div
                  key={memo.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {map.memos.length > 1 && (
                    <div className="border-b border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      Memo {index + 1}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap p-3 text-xs text-zinc-700 dark:text-zinc-300">
                    {memo.transcript}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="flex-1">
        {map && map.nodes.length > 0 ? (
          <div className="h-[calc(100vh-12rem)] min-h-[480px] w-full">
            <MindMap
              resetKey={resetKey}
              syncKey={syncKey}
              initialNodes={map.nodes}
              initialEdges={map.edges}
              onChange={handleMapChange}
            />
          </div>
        ) : (
          <EmptyState busy={busy} />
        )}
      </main>

      <footer className="border-t border-zinc-200 px-6 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        <div className="mx-auto max-w-6xl">
          Tips: drag from a node&apos;s bottom dot to its top dot to connect
          them. Double-click a node to rename. Select and press Backspace to
          delete.
        </div>
      </footer>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200" />
      {label}
    </span>
  );
}

function EmptyState({ busy }: { busy: boolean }) {
  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[480px] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          {busy ? "Working on your map..." : "No map yet"}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {busy
            ? "This usually takes 5-15 seconds."
            : "Record or upload a short voice memo to get started. Ideas, plans, brainstorms - anything spoken works well."}
        </p>
      </div>
    </div>
  );
}
