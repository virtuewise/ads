import {
  getAllCreativeModes,
  getMetaphorsForTerritory,
  VISUAL_METAPHORS,
} from '@printsync/creative-engine';
import { ipcMain } from 'electron';

// Engine-driven IPC: the UI never hardcodes data; it asks the engines.
ipcMain.handle('engine:getModes', async () => {
  const modes = getAllCreativeModes();
  return modes.map((m) => ({
    id: m.mode,
    name: m.name,
    description: m.description,
    territory: m.territories.join(', '),
    territories: m.territories,
    mood: m.default_mood,
    voice: m.default_voice_mode,
    pace: m.default_pace,
    duration: m.typical_duration_seconds,
    formats: m.formats,
    requires3d: m.requires_3d,
    requiresVfx: m.requires_vfx,
  }));
});

ipcMain.handle('engine:getConcepts', async () => {
  // Engine-shaped sample concepts (real concepts come from runDailyCreativeEngine).
  return [
    { title: 'Glass & Light', score: 0.91, territory: 'Precision', mood: 'Minimal' },
    { title: 'Human Impact', score: 0.84, territory: 'HumanImpact', mood: 'Cinematic' },
    { title: 'Scale & Space', score: 0.78, territory: 'Scale', mood: 'Dramatic' },
    { title: 'Playful Motion', score: 0.71, territory: 'Play', mood: 'Playful' },
  ];
});

ipcMain.handle('engine:getMetaphors', async (_e, territory?: string) => {
  const list = territory ? getMetaphorsForTerritory(territory) : VISUAL_METAPHORS;
  return list.slice(0, 12).map((m) => ({
    name: m.name,
    description: m.description,
    territory: m.territories.join(', '),
  }));
});

ipcMain.handle('engine:getStats', async () => {
  const modes = getAllCreativeModes();
  const territories = new Set(modes.flatMap((m) => m.territories));
  return {
    modeCount: modes.length,
    territoryCount: territories.size,
    metaphorCount: VISUAL_METAPHORS.length,
    modesRequiring3d: modes.filter((m) => m.requires_3d).length,
    modesRequiringVfx: modes.filter((m) => m.requires_vfx).length,
  };
});
