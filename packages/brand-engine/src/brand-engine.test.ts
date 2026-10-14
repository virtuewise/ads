import { describe, expect, it } from 'vitest';
import { BrandEngine } from './engine.js';

describe('BrandEngine', () => {
  const engine = new BrandEngine({
    brandPath: 'brand/printsync',
    historyPath: 'brand/printsync/campaign-history.json',
    autoSave: true,
  });

  it('can be instantiated', () => {
    expect(engine).toBeDefined();
  });

  it('loads brand identity', async () => {
    const context = await engine.load();
    expect(context.identity.name).toBe('PrintSync');
    expect(context.identity.tagline).toBe('Your Vision. Our Precision.');
    expect(context.identity.pillars).toContain('PRECISION');
  });

  it('loads brand personality', async () => {
    const context = await engine.load();
    expect(context.personality.traits).toContain('precise');
    expect(context.personality.traits).toContain('creative');
    expect(context.personality.creativeRule).toBe('Never look generic.');
  });

  it('loads brand voice', async () => {
    const context = await engine.load();
    expect(context.voice.primary).toBe('confident and precise');
    expect(context.voice.avoid).toContain('generic corporate speak');
  });

  it('loads creative DNA', async () => {
    const context = await engine.load();
    expect(context.creativeDNA.territories).toContain('PRECISION');
    expect(context.creativeDNA.territories).toContain('TRANSFORMATION');
    expect(context.creativeDNA.signatures).toContain('Kinetic Typography');
  });

  it('loads visual system', async () => {
    const context = await engine.load();
    expect(context.visualSystem.designPhilosophy).toBe('Ideas becoming physical impact.');
    expect(context.visualSystem.elements).toContain('Technical grids and measurement systems');
  });

  it('loads typography system', async () => {
    const context = await engine.load();
    expect(context.typography.primaryFont).toBe('Inter');
    expect(context.typography.kineticBehaviors).toContain('TYPE-SLAM');
  });

  it('loads color system', async () => {
    const context = await engine.load();
    expect(context.colors.primary).toBe('#C8001C');
    expect(context.colors.secondary).toBe('#373435');
  });

  it('loads motion language', async () => {
    const context = await engine.load();
    expect(context.motion.personalities).toContain('Mechanical');
    expect(context.motion.transitionLanguage).toContain('Match cuts');
  });

  it('loads services', async () => {
    const context = await engine.load();
    expect(context.services.length).toBeGreaterThan(0);
    expect(context.services[0]).toHaveProperty('id');
    expect(context.services[0]).toHaveProperty('name');
    expect(context.services[0]).toHaveProperty('customerProblems');
  });

  it('loads messaging system', async () => {
    const context = await engine.load();
    expect(context.messaging.coreMessages.primary).toBe('Your Vision. Our Precision.');
    expect(context.messaging.valuePropositions.length).toBeGreaterThan(0);
  });

  it('loads forbidden styles', async () => {
    const context = await engine.load();
    expect(context.forbiddenStyles.length).toBeGreaterThan(0);
    expect(context.forbiddenStyles[0]).toHaveProperty('category');
    expect(context.forbiddenStyles[0]).toHaveProperty('indicators');
  });

  it('loads logo rules', async () => {
    const context = await engine.load();
    expect(context.logoRules.filePath).toBe('assets/logo/printsync-official-logo.svg');
    expect(context.logoRules.clearSpace).toContain('25%');
  });

  it('gets service by ID', () => {
    const service = engine.getServiceById('digital-printing');
    expect(service).toBeDefined();
    expect(service?.name).toBe('Digital Printing');
  });

  it('gets services by category', () => {
    const printServices = engine.getServicesByCategory('print');
    expect(printServices.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown service', () => {
    const service = engine.getServiceById('unknown-service');
    expect(service).toBeUndefined();
  });

  it('caches context', async () => {
    const context1 = await engine.load();
    const context2 = await engine.load();
    expect(context1).toBe(context2);
  });

  it('invalidates cache', async () => {
    await engine.load();
    engine.invalidateCache();
    const context = await engine.load();
    expect(context).toBeDefined();
  });
});
