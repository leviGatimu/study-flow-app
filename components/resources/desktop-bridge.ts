"use client";

/**
 * The renderer's side of the library IPC (desktop-app/preload.js).
 *
 * Both calls resolve to `{ ok, error? }` and never throw, so a button can
 * toast the error and move on. Off the desktop the bridge is absent and
 * callers should not render the button at all - see useIsDesktopApp.
 */

type Outcome = { ok: boolean; error?: string };

type LibraryBridge = {
  open: (absolutePath: string) => Promise<Outcome>;
  reveal: (absolutePath: string) => Promise<Outcome>;
};

function bridge(): LibraryBridge | null {
  if (typeof window === "undefined") return null;
  return (window as { electron?: { library?: LibraryBridge } }).electron?.library ?? null;
}

export function canOpenInExplorer(): boolean {
  return bridge() !== null;
}

/** Open a library folder in Windows Explorer. */
export async function openInExplorer(absolutePath: string): Promise<Outcome> {
  const api = bridge();
  if (!api) return { ok: false, error: "Only available in the desktop app." };
  try {
    return await api.open(absolutePath);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Open Explorer with a library file selected. */
export async function revealInExplorer(absolutePath: string): Promise<Outcome> {
  const api = bridge();
  if (!api) return { ok: false, error: "Only available in the desktop app." };
  try {
    return await api.reveal(absolutePath);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** "C:\...\Physics" + "Chapter 1/Worksheets" -> the folder's absolute path. */
export function folderAbsolutePath(subjectFolderPath: string, folder: string): string {
  if (!folder) return subjectFolderPath;
  return `${subjectFolderPath}\\${folder.split("/").join("\\")}`;
}

/** A "/library/..." url -> the file's absolute path under the library root. */
export function libraryFileAbsolutePath(libraryDir: string, url: string): string | null {
  if (!url.startsWith("/library/")) return null;
  try {
    const rel = url.slice("/library/".length).split("/").map(decodeURIComponent);
    return `${libraryDir}\\${rel.join("\\")}`;
  } catch {
    return null;
  }
}
