import type { MemoEntry, SavedMap } from "./types";

const STORAGE_KEY = "semantic-audio-mindmap:current";
const MEMO_SEPARATOR = "\n\n---\n\n";

export function joinTranscripts(memos: MemoEntry[]): string {
  return memos.map((m) => m.transcript).join(MEMO_SEPARATOR);
}

function migrateMap(raw: SavedMap): SavedMap {
  let memos = raw.memos;
  if (!memos || memos.length === 0) {
    if (raw.transcript?.trim()) {
      memos = [
        {
          id: "legacy",
          transcript: raw.transcript,
          addedAt: raw.updatedAt ?? Date.now(),
        },
      ];
    } else {
      memos = [];
    }
  }

  return {
    ...raw,
    memos,
    transcript: joinTranscripts(memos),
  };
}

export function normalizeMap(map: SavedMap): SavedMap {
  const memos = map.memos ?? [];
  return {
    ...map,
    memos,
    transcript: joinTranscripts(memos),
    updatedAt: map.updatedAt ?? Date.now(),
  };
}

export function saveMap(map: SavedMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeMap(map))
    );
  } catch {
    // Storage may be unavailable (private mode, quota); ignore.
  }
}

export function loadMap(): SavedMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateMap(JSON.parse(raw) as SavedMap);
  } catch {
    return null;
  }
}

export function clearMap(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
