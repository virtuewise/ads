// ── Project Persistence IPC (main process) ───────────────────────────────────
// File dialogs, disk writes and IPC wiring. The encodings themselves live in
// ./projectCodec so they stay pure and independently testable.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  formatForPath,
  type ProjectFormat,
  parseProject,
  serialize,
  withExtension,
} from './projectCodec';

export type { ProjectFormat } from './projectCodec';

export interface SaveResult {
  canceled: boolean;
  path?: string;
  format?: ProjectFormat;
  bytes?: number;
}

export interface OpenResult {
  canceled: boolean;
  path?: string;
  format?: ProjectFormat;
  doc?: unknown;
}

export async function writeProject(
  filePath: string,
  doc: unknown,
  format: ProjectFormat,
): Promise<number> {
  const buf = serialize(doc, format);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
  return buf.byteLength;
}

export async function readProject(
  filePath: string,
): Promise<{ format: ProjectFormat; doc: unknown }> {
  const buf = await fs.readFile(filePath);
  return parseProject(buf, filePath);
}

function parentWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

const FILTERS = [
  { name: 'Virtue Project (JSON, git-friendly)', extensions: ['vfxproj'] },
  { name: 'Virtue Project (Binary, compact)', extensions: ['vfxproj', 'bin'] },
];

export function registerProjectIpc(): void {
  ipcMain.handle(
    'project:save',
    async (
      event,
      doc: unknown,
      opts?: { path?: string; format?: ProjectFormat },
    ): Promise<SaveResult> => {
      let target = opts?.path;
      let format = opts?.format;
      if (!target) {
        const win = parentWindow(event);
        const rawName =
          (doc as { composition?: { name?: string } })?.composition?.name ?? 'composition';
        const safeName = rawName.replace(/[^a-zA-Z0-9-_ ]+/g, '').trim() || 'composition';
        const options: Electron.SaveDialogOptions = {
          title: 'Save Project',
          defaultPath: `${safeName}.vfxproj`,
          filters: FILTERS,
        };
        const result = win
          ? await dialog.showSaveDialog(win, options)
          : await dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath) return { canceled: true };
        target = result.filePath;
      }
      format = formatForPath(target, format);
      target = withExtension(target, format);
      const bytes = await writeProject(target, doc, format);
      return { canceled: false, path: target, format, bytes };
    },
  );

  ipcMain.handle('project:open', async (event): Promise<OpenResult> => {
    const win = parentWindow(event);
    const options: Electron.OpenDialogOptions = {
      title: 'Open Project',
      properties: ['openFile'],
      filters: FILTERS,
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    const { format, doc } = await readProject(filePath);
    return { canceled: false, path: filePath, format, doc };
  });

  ipcMain.handle(
    'project:write',
    async (_event, filePath: string, doc: unknown, format: ProjectFormat): Promise<SaveResult> => {
      const bytes = await writeProject(filePath, doc, format);
      return { canceled: false, path: filePath, format, bytes };
    },
  );

  ipcMain.handle('project:read', async (_event, filePath: string): Promise<OpenResult> => {
    const { format, doc } = await readProject(filePath);
    return { canceled: false, path: filePath, format, doc };
  });
}
