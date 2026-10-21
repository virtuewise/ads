import type { CreativeBrief as ProductionBrief } from '@printsync/common';
import {
  CreativeDirector,
  CreativeJudge,
  getAllCreativeModes,
  getMetaphorsForService,
  getMetaphorsForTerritory,
  VISUAL_METAPHORS,
} from '@printsync/creative-engine';
import { buildProductionPlan } from '@printsync/production-orchestrator';
import type { CreativeBrief } from '@printsync/shared';
import { TypographyEngine } from '@printsync/typography-engine';
import { VFXEngine } from '@printsync/vfx-engine';
import {
  CorporateGrammar,
  DetectiveGrammar,
  ExplainerGrammar,
  HeroJourneyGrammar,
  TransformationGrammar,
} from '@printsync/visual-grammar-engine';
import { ipcMain } from 'electron';
import { registerExportIpc } from './export';
import { registerMediaIpc } from './media';
import { registerProjectIpc } from './project';

/**
 * Turn a brief into a full production plan.
 *
 * The plan is the monorepo's output: a script, a storyboard, shots, and plans
 * for motion, effects, typography and sound. The renderer compiles it into the
 * graph it can render — see @printsync/creative-graph.
 */
ipcMain.handle('production:buildPlan', async (_event, brief: ProductionBrief) => {
  const plan = await buildProductionPlan(brief);
  return plan;
});

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

ipcMain.handle('engine:generateConcepts', async (_e, brief: Partial<CreativeBrief>) => {
  const fullBrief: CreativeBrief = {
    objective: brief.objective ?? 'Build brand awareness',
    service: brief.service ?? 'branding',
    audience: brief.audience ?? 'general',
    emotional_objective: brief.emotional_objective ?? 'inspire',
    platform: brief.platform ?? ['social'],
    formats: brief.formats ?? ['16:9'],
    voice_mode: brief.voice_mode,
    creative_mode: brief.creative_mode,
    territory: brief.territory,
    mood: brief.mood,
    visual_style: brief.visual_style,
    pace: brief.pace,
    constraints: brief.constraints,
    reference_campaigns: brief.reference_campaigns,
  };
  const director = new CreativeDirector([]);
  const concepts = director.generateConcepts(fullBrief);
  const judge = new CreativeJudge();
  return concepts.map((c) => {
    try {
      const score = judge.scoreConcept(c);
      return { ...c, score };
    } catch {
      return c;
    }
  });
});

ipcMain.handle('engine:getMetaphors', async (_e, territory?: string) => {
  const list = territory ? getMetaphorsForTerritory(territory) : VISUAL_METAPHORS;
  return list.slice(0, 24).map((m) => ({
    name: m.name,
    description: m.description,
    territory: m.territories.join(', '),
    territories: m.territories,
  }));
});

ipcMain.handle('engine:getMetaphorsForService', async (_e, service: string) => {
  return getMetaphorsForService(service).map((m) => ({
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

ipcMain.handle('engine:getTypographyPresets', async () => {
  const engine = new TypographyEngine();
  return engine.getAllPresets();
});

ipcMain.handle('engine:getVFXEffects', async () => {
  const engine = new VFXEngine();
  return engine.getAllEffects();
});

ipcMain.handle('engine:getVisualGrammars', async () => {
  return [
    ExplainerGrammar,
    CorporateGrammar,
    DetectiveGrammar,
    TransformationGrammar,
    HeroJourneyGrammar,
  ];
});

ipcMain.handle('engine:getConcepts', async () => []);

registerProjectIpc();
registerExportIpc();
registerMediaIpc();
