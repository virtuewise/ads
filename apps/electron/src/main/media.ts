// ── Media Import IPC (main process) ──────────────────────────────────────────
// File dialogs and disk reads. The demuxer (engine/demux.ts) and the WebCodecs
// decoder (engine/media.ts) live in the renderer because they need browser
// APIs; the renderer never touches `fs` — it asks this process instead.
//
// See docs/29-MEDIA-PIPELINE.md §1 and docs/17-AI-AGENTS.md.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, ipcMain } from 'electron';

/** Extensions we offer in the import dialog, most-capable first. */
const MEDIA_FILTERS = [
  { name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv'] },
  { name: 'All files', extensions: ['*'] },
];

export interface MediaPickResult {
  canceled: boolean;
  items: Array<{
    path: string;
    name: string;
    /** Raw container bytes, transferred as a plain ArrayBuffer over IPC. */
    data: ArrayBuffer;
  }>;
}

/**
 * Read a media file the project already knows about.
 *
 * A saved project stores where its footage lives, so reopening it re-imports
 * the files by path instead of asking the user to find them again.
 */
export async function readMediaFile(
  _event: Electron.IpcMainInvokeEvent,
  filePath: string,
): Promise<{ ok: boolean; name?: string; data?: ArrayBuffer; error?: string }> {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return { ok: false, error: 'No path given' };
  }
  try {
    const buf = await fs.readFile(filePath);
    return {
      ok: true,
      name: path.basename(filePath),
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function parentWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

/**
 * Open a file dialog and return the chosen clips' bytes.
 *
 * Multiple selection is on because dropping a folder of b-roll in one go is the
 * normal editing workflow. A 4K ProRes clip is hundreds of MB, so this reads
 * whole files into memory deliberately — progressive/streaming reads are the
 * next step once the decoder stops needing a complete container.
 */
export async function pickMediaFiles(event: Electron.IpcMainInvokeEvent): Promise<MediaPickResult> {
  const win = parentWindow(event);
  const options: Electron.OpenDialogOptions = {
    title: 'Import Media',
    properties: ['openFile', 'multiSelections'],
    filters: MEDIA_FILTERS,
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, items: [] };
  }

  const items: MediaPickResult['items'] = [];
  for (const filePath of result.filePaths) {
    try {
      const buf = await fs.readFile(filePath);
      items.push({
        path: filePath,
        name: path.basename(filePath),
        // Copy into a fresh ArrayBuffer: Node's Buffer may be a pool slice.
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      });
    } catch (e) {
      // Skip unreadable files rather than aborting the whole import.
      console.error(`media: could not read ${filePath}:`, e);
    }
  }
  return { canceled: false, items };
}

export function registerMediaIpc(): void {
  ipcMain.handle('media:pick', pickMediaFiles);
  ipcMain.handle('media:read', readMediaFile);
}
