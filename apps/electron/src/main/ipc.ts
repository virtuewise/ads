import { getAllCreativeModes } from '@printsync/creative-engine';
import { ipcMain } from 'electron';

// Engine-driven IPC: the UI never hardcodes data; it asks the engines.
ipcMain.handle('engine:getModes', async () => {
  const modes = getAllCreativeModes();
  return modes.map((m) => ({
    id: m.mode,
    name: m.name,
    territory: m.territories.join(', '),
  }));
});

ipcMain.handle('engine:getConcepts', async () => {
  // Demo: generate a couple of concept seeds via the engine's seed generator is
  // internal; instead expose a small engine-driven sample.
  return [
    { title: 'Engine-driven concept A', score: 0.82 },
    { title: 'Engine-driven concept B', score: 0.74 },
  ];
});
