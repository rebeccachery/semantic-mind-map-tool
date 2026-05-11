import type { SavedMap } from "./types";

const STORAGE_KEY = "semantic-audio-mindmap:current";

export function saveMap(map: SavedMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be unavailable (private mode, quota); ignore.
  }
}

export function loadMap(): SavedMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMap;
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
